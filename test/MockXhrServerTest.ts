import { assert } from 'chai';

import HeadersContainer from '../src/HeadersContainer';
import MockXhr, { type OnSendCallback } from '../src/MockXhr';
import MockXhrRequest from '../src/MockXhrRequest';
import MockXhrServer from '../src/MockXhrServer';
import RequestData from '../src/RequestData';
import { getStatusText, upperCaseMethods } from '../src/Utils';

import type { RequestHandlerResponse } from '../src/MockXhrServer';

describe('MockXhrServer', () => {
  function makeTestHarness() {
    const onSendPromises: Promise<MockXhr>[] = [];

    class MockXhrClass extends MockXhr {
      static onSend?: OnSendCallback;
    }

    function doRequest(
      method: string,
      url: string,
      headers: Record<string, string> = {},
      body: any = null
    ) {
      const xhr = new MockXhrClass();
      xhr.open(method, url);
      Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
      xhr.send(body);
      onSendPromises.push(new Promise((resolve) => {
        xhr.addEventListener('loadend', () => resolve(xhr));
      }));
      return xhr;
    }

    function waitForResponses() {
      return Promise.all(onSendPromises);
    }

    return { MockXhrClass, doRequest, waitForResponses };
  }

  function assertResponse(xhr: MockXhr, response: Partial<RequestHandlerResponse>) {
    const status = response.status ?? 200;
    assert.strictEqual(xhr.status, status, 'response status');
    assert.deepEqual(xhr.getResponseHeadersHash(), response.headers ?? {}, 'response headers');
    assert.strictEqual(xhr.response, response.body ?? null, 'response body');
    assert.strictEqual(xhr.statusText, response.statusText ?? getStatusText(status), 'status text');
  }

  describe('constructor', () => {
    it('should add routes', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const handlerFn = (request: MockXhrRequest) => { request.respond(); };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const server = new MockXhrServer(MockXhrClass, {
        get: ['/get', { status: 200 }],
        'my-method': ['/my-method', { status: 201 }],
        post: ['/post', [handlerFn, { status: 404 }]],
      });

      doRequest('GET', '/get');
      doRequest('my-method', '/my-method');
      doRequest('POST', '/post');
      doRequest('POST', '/post');

      return waitForResponses().then((xhrs) => {
        assert.strictEqual(xhrs[0].status, 200);
        assert.strictEqual(xhrs[1].status, 201);
        assert.strictEqual(xhrs[2].status, 200);
        assert.strictEqual(xhrs[3].status, 404);
      });
    });
  });

  describe('MockXhr access', () => {
    it('should expose the MockXhr class', () => {
      const { MockXhrClass } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      assert.strictEqual(server.MockXhr, MockXhrClass, 'MockXhr class exposed');
    });

    it('should provide a factory method for MockXhr', () => {
      const { MockXhrClass } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      assert.instanceOf(server.xhrFactory(), MockXhrClass, 'factory method returns MockXhr');
    });
  });

  describe('install() and remove()', () => {
    it('should set and restore XMLHttpRequest on default global context', () => {
      const savedGlobalXMLHttpRequest = globalThis.XMLHttpRequest;
      try {
        const mockGlobalType = {};
        globalThis.XMLHttpRequest = mockGlobalType as unknown as typeof XMLHttpRequest;
        const { MockXhrClass } = makeTestHarness();

        const server = new MockXhrServer(MockXhrClass).install();
        assert.strictEqual(globalThis.XMLHttpRequest, MockXhrClass, 'XMLHttpRequest type replaced');

        server.remove();
        assert.strictEqual(globalThis.XMLHttpRequest, mockGlobalType, 'XMLHttpRequest type restored');
      } finally {
        globalThis.XMLHttpRequest = savedGlobalXMLHttpRequest;
      }
    });

    it('should set and restore XMLHttpRequest on context argument', () => {
      const context: any = { XMLHttpRequest: 1 };
      const { MockXhrClass } = makeTestHarness();

      const server = new MockXhrServer(MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.strictEqual(context.XMLHttpRequest, 1, 'XMLHttpRequest property restored');
    });

    it('should set and restore undefined XMLHttpRequest on context argument', () => {
      const context: any = { XMLHttpRequest: undefined };
      const { MockXhrClass } = makeTestHarness();

      const server = new MockXhrServer(MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.isTrue('XMLHttpRequest' in context, 'XMLHttpRequest property restored');
      assert.isUndefined(context.XMLHttpRequest, 'XMLHttpRequest property restored as undefined');
    });

    it('should set and delete missing XMLHttpRequest on context argument', () => {
      const context: any = {};
      const { MockXhrClass } = makeTestHarness();

      const server = new MockXhrServer(MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.isFalse('XMLHttpRequest' in context, 'XMLHttpRequest property deleted');
    });

    it('should throw if remove() is called without install()', () => {
      const { MockXhrClass } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      assert.throws(() => { server.remove(); });
    });

    it('should throw if remove() is called twice', () => {
      const { MockXhrClass } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      server.install({});
      server.remove();
      assert.throws(() => { new MockXhrServer(MockXhrClass).remove(); });
    });
  });

  describe('addHandler()', () => {
    it('should support response hash as handler', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.addHandler('method', '/path', response);
      const xhr = doRequest('method', '/path');

      return waitForResponses().then(() => {
        assertResponse(xhr, response);
      });
    });

    it('should support callback as handler', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      const handlerFn = (request: MockXhrRequest) => { request.respond(201); };
      server.addHandler('method', '/path', handlerFn);
      const xhr = doRequest('method', '/path');

      return waitForResponses().then(() => {
        assert.strictEqual(xhr.status, 201);
      });
    });

    it('should support callback as url matcher', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const status = 201;

      const matcher = (url: string) => url.includes('object');
      server.addHandler('method', matcher, { status });
      const xhr = doRequest('method', '/my/object/somewhere');

      return waitForResponses().then(() => {
        assert.strictEqual(xhr.status, status);
      });
    });

    it('should support regex as url matcher', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const status = 201;

      server.addHandler('method', /.*\/object\/.*/i, { status });
      const xhr = doRequest('method', '/my/object/somewhere');

      return waitForResponses().then(() => {
        assert.strictEqual(xhr.status, status);
      });
    });

    it('should support array of handlers', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };
      const handler = (request: MockXhrRequest) => { request.respond(404); };

      server.addHandler('method', '/path', [response, handler, response]);
      doRequest('method', '/path');
      doRequest('method', '/path');
      doRequest('method', '/path');
      doRequest('method', '/path');

      return waitForResponses().then((xhrs) => {
        assertResponse(xhrs[0], response);
        assert.strictEqual(xhrs[1].status, 404);
        assertResponse(xhrs[2], response);
        assertResponse(xhrs[3], response);
      });
    });

    it('should normalize method names', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const status = 201;

      upperCaseMethods.forEach((method) => {
        method = `${method[0]}${method.slice(1).toLowerCase()}`;
        server.addHandler(method, '/path', { status });
      });
      upperCaseMethods.forEach((method) => doRequest(method.toLowerCase(), '/path'));

      return waitForResponses().then((xhrs) => {
        xhrs.forEach((xhr) => {
          assert.strictEqual(xhr.status, status);
        });
      });
    });

    it('should pick first matched handler', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const status = 201;

      server.addHandler('method', '/path', { status });
      server.addHandler('method', '/path', { status: status + 1 });
      const xhr = doRequest('method', '/path');

      return waitForResponses().then(() => {
        assert.strictEqual(xhr.status, status);
      });
    });

    it('should handle having no matching handler', () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const server = new MockXhrServer(MockXhrClass);

      const xhr = doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(xhr.readyState, MockXhr.OPENED, 'final state UNSENT');
      });
    });

    it('should coexist with routes given in the constructor', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass, {
        get: ['/get', { status: 201 }],
      });
      server.addHandler('method', '/path', (request) => { request.respond(404); });

      doRequest('GET', '/get');
      doRequest('method', '/path');

      return waitForResponses().then((xhrs) => {
        assert.strictEqual(xhrs[0].status, 201);
        assert.strictEqual(xhrs[1].status, 404);
      });
    });
  });

  describe('convenience methods', () => {
    const methods = ['get', 'post', 'put', 'delete'] as const;

    methods.forEach((method) => {
      it(`should support ${method}()`, () => {
        const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
        const server = new MockXhrServer(MockXhrClass);
        const status = 201;

        server[method]('/path', { status });
        const xhr = doRequest(method, '/path');

        return waitForResponses().then(() => {
          assert.strictEqual(xhr.status, status);
        });
      });
    });
  });

  describe('setDefaultHandler()', () => {
    it('should support response hash as handler', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.setDefaultHandler(response);
      const xhr = doRequest('method', '/path');

      return waitForResponses().then(() => {
        assertResponse(xhr, response);
      });
    });

    it('should support callback as handler', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      const handlerFn = (request: MockXhrRequest) => { request.respond(201); };
      server.setDefaultHandler(handlerFn);
      const xhr = doRequest('method', '/path');

      return waitForResponses().then(() => {
        assert.strictEqual(xhr.status, 201);
      });
    });

    it('should support array of handlers', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };
      const handler = (request: MockXhrRequest) => { request.respond(404); };

      server.setDefaultHandler([response, handler, response]);
      doRequest('method', '/path');
      doRequest('method', '/path');
      doRequest('method', '/path');
      doRequest('method', '/path');

      return waitForResponses().then((xhrs) => {
        assertResponse(xhrs[0], response);
        assert.strictEqual(xhrs[1].status, 404);
        assertResponse(xhrs[2], response);
        assertResponse(xhrs[3], response);
      });
    });

    it('should have lowest precedence', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const status = 201;

      server.addHandler('method', '/path', { status });
      server.setDefaultHandler({ status: status + 1 });
      const xhr = doRequest('method', '/path');

      return waitForResponses().then(() => {
        assert.strictEqual(xhr.status, status);
      });
    });
  });

  describe('setDefault404()', () => {
    it('should return 404 for unmatched requests', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      server.setDefault404();
      const xhr = doRequest('method', '/path');

      return waitForResponses().then(() => {
        assert.strictEqual(xhr.status, 404);
      });
    });
  });

  describe('aborted requests support', () => {
    it('should handle aborted requests', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      let requestData: RequestData;
      server.get('/get', (request) => {
        requestData = new RequestData(
          new HeadersContainer(request.requestHeaders),
          request.method,
          request.url,
          request.body,
          request.withCredentials
        );
        request.respond();
      });
      const xhr = doRequest('GET', '/get');
      xhr.abort();

      return waitForResponses().then(() => {
        assert.strictEqual(requestData.requestHeaders.getAll(), '');
        assert.strictEqual(requestData.method, 'GET');
        assert.strictEqual(requestData.url, '/get');
        assert.deepEqual(requestData.body, null);
        assert.strictEqual(requestData.withCredentials, false);
        assert.strictEqual(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
        assert.strictEqual(xhr.getAllResponseHeaders(), '', 'Response headers');
        assert.strictEqual(xhr.status, 0, 'xhr.status == 0');
        assert.strictEqual(xhr.statusText, '', 'empty xhr.statusText');
        assert.strictEqual(xhr.response, '', 'empty xhr.response');
        assert.strictEqual(xhr.responseText, '', 'empty xhr.responseText');
      });
    });

    it('should handle resent aborted requests', () => {
      const { MockXhrClass, doRequest, waitForResponses } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      server.get('/get', {});
      server.setDefault404();

      const xhr = doRequest('GET', '/get');
      xhr.abort();
      xhr.open('GET', '/404-path');
      xhr.send();

      return waitForResponses().then(() => {
        assert.strictEqual(xhr.status, 404);
      });
    });
  });

  describe('getRequestLog()', () => {
    it('should return all received requests', () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      server.addHandler('method', '/path', (request) => { request.respond(404); });
      doRequest('method', '/path1');
      doRequest('GET', '/path2');
      doRequest('POST', '/post', { header: '123' }, 12345);

      return Promise.resolve(true).then(() => {
        const log = server.getRequestLog();
        assert.strictEqual(log.length, 3, 'handler called');
        assert.deepEqual(log[0], {
          method: 'method', url: '/path1', headers: {}, body: null,
        });
        assert.deepEqual(log[1], {
          method: 'GET', url: '/path2', headers: {}, body: null,
        });
        assert.deepEqual(log[2], {
          method: 'POST', url: '/post', headers: { header: '123' }, body: 12345,
        });
      });
    });
  });
});
