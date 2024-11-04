import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { recordEvents } from './TestUtils.ts';
import HeadersContainer from '../src/HeadersContainer.ts';
import MockXhr, { type OnSendCallback } from '../src/MockXhr.ts';
import MockXhrRequest from '../src/MockXhrRequest.ts';
import MockXhrServer from '../src/MockXhrServer.ts';
import RequestData from '../src/RequestData.ts';
import { getBodyByteSize, getStatusText, upperCaseMethods } from '../src/Utils.ts';

import type { RequestHandlerResponse } from '../src/MockXhrServer';

describe('MockXhrServer', () => {
  function makeTestHarness() {
    const loadendPromises: Promise<MockXhr>[] = [];

    class MockXhrClass extends MockXhr {
      static onSend?: OnSendCallback;
    }

    function doRequest(
      method: string,
      url: string,
      headers: Record<string, string> = {},
      body: unknown = null,
      delayedSend = false
    ) {
      const xhr = new MockXhrClass();
      xhr.open(method, url);
      Object.entries(headers).forEach(([name, value]) => { xhr.setRequestHeader(name, value); });
      loadendPromises.push(new Promise((resolve) => {
        xhr.addEventListener('loadend', () => { resolve(xhr); });
      }));

      if (delayedSend) {
        // Run in an empty callstack to give tests a chance to modify the xhr before send().
        // e.g. to add (upload) listeners.
        void Promise.resolve().then(() => { xhr.send(body); });
      } else {
        xhr.send(body);
      }
      return xhr;
    }

    function allResponsesPromise() {
      return Promise.all(loadendPromises);
    }

    return { MockXhrClass, doRequest, allResponsesPromise };
  }

  function assertResponse(xhr: MockXhr, response: Partial<RequestHandlerResponse>) {
    const status = response.status ?? 200;
    assert.strictEqual(xhr.status, status, 'response status');

    const headers = {
      'content-length': String(getBodyByteSize(response.body)),
      ...response.headers,
    };
    assert.deepEqual(xhr.getResponseHeadersHash(), headers, 'response headers');
    assert.strictEqual(xhr.response, response.body ?? '', 'response body');
    assert.strictEqual(xhr.statusText, response.statusText ?? getStatusText(status), 'status text');
  }

  // Asserts that the response is a network error
  function assertNetworkErrorResponse(xhr: MockXhr) {
    assert.strictEqual(xhr.getAllResponseHeaders(), '', 'Response headers');
    assert.strictEqual(xhr.status, 0, 'xhr.status == 0');
    assert.strictEqual(xhr.statusText, '', 'empty xhr.statusText');
    assert.strictEqual(xhr.response, '', 'empty xhr.response');
    assert.strictEqual(xhr.responseText, '', 'empty xhr.responseText');
  }

  describe('constructor', () => {
    it('should add routes', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const handlerFn = (request: MockXhrRequest) => { request.respond(); };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const server = new MockXhrServer(MockXhrClass, {
        'get': ['/get', { status: 200 }],
        'my-method': ['/my-method', { status: 201 }],
        'post': ['/post', [handlerFn, { status: 404 }]],
      });

      doRequest('GET', '/get');
      doRequest('my-method', '/my-method');
      doRequest('POST', '/post');
      doRequest('POST', '/post');

      const xhrs = await allResponsesPromise();
      assert.strictEqual(xhrs[0].status, 200);
      assert.strictEqual(xhrs[1].status, 201);
      assert.strictEqual(xhrs[2].status, 200);
      assert.strictEqual(xhrs[3].status, 404);
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
      assert.ok(server.xhrFactory() instanceof MockXhrClass, 'factory method returns MockXhr');
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
      const context: { XMLHttpRequest?: unknown } = { XMLHttpRequest: 1 };
      const { MockXhrClass } = makeTestHarness();

      const server = new MockXhrServer(MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.strictEqual(context.XMLHttpRequest, 1, 'XMLHttpRequest property restored');
    });

    it('should set and restore undefined XMLHttpRequest on context argument', () => {
      const context: { XMLHttpRequest?: unknown } = { XMLHttpRequest: undefined };
      const { MockXhrClass } = makeTestHarness();

      const server = new MockXhrServer(MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.ok('XMLHttpRequest' in context, 'XMLHttpRequest property restored');
      assert.strictEqual(context.XMLHttpRequest, undefined, 'XMLHttpRequest property restored as undefined');
    });

    it('should set and delete missing XMLHttpRequest on context argument', () => {
      const context: { XMLHttpRequest?: unknown } = {};
      const { MockXhrClass } = makeTestHarness();

      const server = new MockXhrServer(MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.ok(!('XMLHttpRequest' in context), 'XMLHttpRequest property deleted');
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
    it('should support response hash handler', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.addHandler('method', '/path', response);
      const xhr = doRequest('method', '/path');

      await allResponsesPromise();
      assertResponse(xhr, response);
    });

    it('should support Function handler', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      const handlerFn = (request: MockXhrRequest) => { request.respond(201); };
      server.addHandler('method', '/path', handlerFn);
      const xhr = doRequest('method', '/path');

      await allResponsesPromise();
      assert.strictEqual(xhr.status, 201);
    });

    it('should support \'error\' handler', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      server.addHandler('method', '/path', 'error');
      const xhr = doRequest('method', '/path');
      let onerrorRaised = false;
      xhr.onerror = () => { onerrorRaised = true; };

      await allResponsesPromise();
      assertNetworkErrorResponse(xhr);
      assert.ok(onerrorRaised);
    });

    it('should support \'timeout\' handler', async (context) => {
      context.mock.timers.enable();
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      server.addHandler('method', '/path', 'timeout');
      const xhr = doRequest('method', '/path');
      let ontimeoutRaised = false;
      xhr.ontimeout = () => { ontimeoutRaised = true; };
      xhr.timeout = 1;

      context.mock.timers.tick(1);
      await allResponsesPromise();
      assertNetworkErrorResponse(xhr);
      assert.ok(ontimeoutRaised);
    });

    it('should support Function url matcher', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const status = 201;

      const matcher = (url: string) => url.includes('object');
      server.addHandler('method', matcher, { status });
      const xhr = doRequest('method', '/my/object/somewhere');

      await allResponsesPromise();
      assert.strictEqual(xhr.status, status);
    });

    it('should support regex url matcher', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const status = 201;

      server.addHandler('method', /.*\/object\/.*/i, { status });
      const xhr = doRequest('method', '/my/object/somewhere');

      await allResponsesPromise();
      assert.strictEqual(xhr.status, status);
    });

    it('should support array of handlers', async (context) => {
      context.mock.timers.enable();
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };
      const handler = (request: MockXhrRequest) => { request.respond(404); };

      server.addHandler('method', '/path', ['timeout', handler, response]);
      const xhr = doRequest('method', '/path');
      let ontimeoutRaised = false;
      xhr.ontimeout = () => { ontimeoutRaised = true; };
      xhr.timeout = 1;
      doRequest('method', '/path');
      doRequest('method', '/path');
      doRequest('method', '/path');

      context.mock.timers.tick(1);
      const xhrs = await allResponsesPromise();
      assert.ok(ontimeoutRaised);
      assertNetworkErrorResponse(xhrs[0]);
      assert.strictEqual(xhrs[1].status, 404);
      assertResponse(xhrs[2], response);
      assertResponse(xhrs[3], response);
    });

    it('should normalize method names', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const status = 201;

      upperCaseMethods.forEach((method) => {
        method = `${method[0]}${method.slice(1).toLowerCase()}`;
        server.addHandler(method, '/path', { status });
      });
      upperCaseMethods.forEach((method) => doRequest(method.toLowerCase(), '/path'));

      const xhrs = await allResponsesPromise();
      xhrs.forEach((xhr) => {
        assert.strictEqual(xhr.status, status);
      });
    });

    it('should pick first matched handler', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const status = 201;

      server.addHandler('method', '/path', { status });
      server.addHandler('method', '/path', { status: status + 1 });
      const xhr = doRequest('method', '/path');

      await allResponsesPromise();
      assert.strictEqual(xhr.status, status);
    });

    it('should handle having no matching handler', async () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const server = new MockXhrServer(MockXhrClass);

      const xhr = doRequest('method', '/path');

      await Promise.resolve();
      assert.strictEqual(xhr.readyState, MockXhr.OPENED, 'final state UNSENT');
    });

    it('should coexist with routes given in the constructor', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass, {
        get: ['/get', { status: 201 }],
      });
      server.addHandler('method', '/path', (request) => { request.respond(404); });

      doRequest('GET', '/get');
      doRequest('method', '/path');

      const xhrs = await allResponsesPromise();
      assert.strictEqual(xhrs[0].status, 201);
      assert.strictEqual(xhrs[1].status, 404);
    });
  });

  describe('convenience methods', () => {
    const methods = ['get', 'post', 'put', 'delete'] as const;

    methods.forEach((method) => {
      it(`should support ${method}()`, async () => {
        const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
        const server = new MockXhrServer(MockXhrClass);
        const status = 201;

        server[method]('/path', { status });
        const xhr = doRequest(method, '/path');

        await allResponsesPromise();
        assert.strictEqual(xhr.status, status);
      });
    });
  });

  describe('setDefaultHandler()', () => {
    it('should support response hash handler', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.setDefaultHandler(response);
      const xhr = doRequest('method', '/path');

      await allResponsesPromise();
      assertResponse(xhr, response);
    });

    it('should support response hash handler with null body', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = { body: null };

      server.setDefaultHandler(response);
      const xhr = doRequest('method', '/path');

      await allResponsesPromise();
      assertResponse(xhr, response);
    });

    it('should support Function handler', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      const handlerFn = (request: MockXhrRequest) => { request.respond(201); };
      server.setDefaultHandler(handlerFn);
      const xhr = doRequest('method', '/path');

      await allResponsesPromise();
      assert.strictEqual(xhr.status, 201);
    });

    it('should support \'error\' handler', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      server.setDefaultHandler('error');
      const xhr = doRequest('method', '/path');
      let onerrorRaised = false;
      xhr.onerror = () => { onerrorRaised = true; };

      await allResponsesPromise();
      assertNetworkErrorResponse(xhr);
      assert.ok(onerrorRaised);
    });

    it('should support \'timeout\' handler', async (context) => {
      context.mock.timers.enable();
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      server.setDefaultHandler('timeout');
      const xhr = doRequest('method', '/path');
      let ontimeoutRaised = false;
      xhr.ontimeout = () => { ontimeoutRaised = true; };
      xhr.timeout = 1;

      context.mock.timers.tick(1);
      await allResponsesPromise();
      assertNetworkErrorResponse(xhr);
      assert.ok(ontimeoutRaised);
    });

    it('should support array of handlers', async (context) => {
      context.mock.timers.enable();
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };
      const handler = (request: MockXhrRequest) => { request.respond(404); };

      server.setDefaultHandler(['timeout', handler, response]);
      const xhr = doRequest('method', '/path');
      let ontimeoutRaised = false;
      xhr.ontimeout = () => { ontimeoutRaised = true; };
      xhr.timeout = 1;
      doRequest('method', '/path');
      doRequest('method', '/path');
      doRequest('method', '/path');

      context.mock.timers.tick(1);
      const xhrs = await allResponsesPromise();
      assert.ok(ontimeoutRaised);
      assertNetworkErrorResponse(xhrs[0]);
      assert.strictEqual(xhrs[1].status, 404);
      assertResponse(xhrs[2], response);
      assertResponse(xhrs[3], response);
    });

    it('should have lowest precedence', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const status = 201;

      server.addHandler('method', '/path', { status });
      server.setDefaultHandler({ status: status + 1 });
      const xhr = doRequest('method', '/path');

      await allResponsesPromise();
      assert.strictEqual(xhr.status, status);
    });
  });

  describe('setDefault404()', () => {
    it('should return 404 for unmatched requests', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      server.setDefault404();
      const xhr = doRequest('method', '/path');

      await allResponsesPromise();
      assert.strictEqual(xhr.status, 404);
    });
  });

  describe('aborted requests support', () => {
    it('should handle aborted requests', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      let requestData: RequestData | undefined;
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

      await allResponsesPromise();
      assert.ok(requestData);
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

    it('should handle resent aborted requests', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      server.get('/get', {});
      server.setDefault404();

      const xhr = doRequest('GET', '/get');
      xhr.abort();
      xhr.open('GET', '/404-path');
      xhr.send();

      await allResponsesPromise();
      assert.strictEqual(xhr.status, 404);
    });
  });

  describe('progressRate', () => {
    it('should produce upload and download progress events', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.addHandler('method', '/path', response);
      server.progressRate = 3;
      const xhr = doRequest('method', '/path', {}, 'request', true);
      const events = recordEvents(xhr);

      await allResponsesPromise();
      assertResponse(xhr, response);
      assert.deepEqual(events, [
        'loadstart(0,0,false)',
        'upload.loadstart(0,7,true)',
        'upload.progress(3,7,true)',
        'upload.progress(6,7,true)',
        'upload.progress(7,7,true)',
        'upload.load(7,7,true)',
        'upload.loadend(7,7,true)',
        'readystatechange(2)',
        'readystatechange(3)',
        'progress(3,9,true)',
        'readystatechange(3)',
        'progress(6,9,true)',
        'readystatechange(3)',
        'progress(9,9,true)',
        'readystatechange(4)',
        'load(9,9,true)',
        'loadend(9,9,true)',
      ], 'fired events');
    });

    it('should work with empty request and response bodies', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {};

      server.addHandler('GET', '/path', response);
      server.progressRate = 3;
      const xhr = doRequest('GET', '/path', {}, null, true);
      const events = recordEvents(xhr);

      await allResponsesPromise();
      assertResponse(xhr, response);
      assert.deepEqual(events, [
        'loadstart(0,0,false)',
        'readystatechange(2)',
        'readystatechange(3)',
        'progress(0,0,false)',
        'readystatechange(4)',
        'load(0,0,false)',
        'loadend(0,0,false)',
      ], 'fired events');
    });

    it('can be modified while a request is in progress', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.addHandler('method', '/path', response);
      server.progressRate = 2;
      const xhr = doRequest('method', '/path', {}, 'request', true);
      xhr.upload.addEventListener('progress', () => { server.progressRate = 10; }, { once: true });
      xhr.upload.addEventListener('loadend', () => { server.progressRate = 2; }, { once: true });
      xhr.addEventListener('progress', () => { server.progressRate = 0; }, { once: true });
      const events = recordEvents(xhr);

      await allResponsesPromise();
      assertResponse(xhr, response);
      assert.deepEqual(events, [
        'loadstart(0,0,false)',
        'upload.loadstart(0,7,true)',
        'upload.progress(2,7,true)',
        // progressRate = 10
        'upload.progress(7,7,true)',
        'upload.load(7,7,true)',
        'upload.loadend(7,7,true)',
        // progressRate = 2
        'readystatechange(2)',
        'readystatechange(3)',
        'progress(2,9,true)',
        // progressRate = 0
        'readystatechange(3)',
        'progress(9,9,true)',
        'readystatechange(4)',
        'load(9,9,true)',
        'loadend(9,9,true)',
      ], 'fired events');
    });

    it('can be disabled while a request is in progress', async () => {
      const { MockXhrClass, doRequest, allResponsesPromise } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 201,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.addHandler('method', '/path', response);
      server.progressRate = 2;
      const xhr = doRequest('method', '/path', {}, 'request', true);
      xhr.upload.addEventListener('progress', () => { server.progressRate = 0; }, { once: true });
      const events = recordEvents(xhr);

      await allResponsesPromise();
      assertResponse(xhr, response);
      assert.deepEqual(events, [
        'loadstart(0,0,false)',
        'upload.loadstart(0,7,true)',
        'upload.progress(2,7,true)',
        // progressRate = 0
        'upload.progress(7,7,true)',
        'upload.load(7,7,true)',
        'upload.loadend(7,7,true)',
        'readystatechange(2)',
        'readystatechange(3)',
        'progress(9,9,true)',
        'readystatechange(4)',
        'load(9,9,true)',
        'loadend(9,9,true)',
      ], 'fired events');
    });
  });

  describe('getRequestLog()', () => {
    it('should return all received requests', async () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      server.addHandler('method', '/path', (request) => { request.respond(404); });
      doRequest('method', '/path1');
      doRequest('GET', '/path2');
      doRequest('POST', '/post', { header: '123' }, 12345);

      await Promise.resolve();
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
