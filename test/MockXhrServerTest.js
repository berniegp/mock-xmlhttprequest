import { assert } from 'chai';

import MockXhr from '../src/MockXhr';
import MockXhrServer from '../src/MockXhrServer';

describe('MockXhrServer', () => {
  function makeTestHarness() {
    const responses: {
      status?: number,
      headers: Record<string, string>,
      body: any,
      statusText?: string
    }[] = [];

    class MockXhrClass extends MockXhr {
      send(body: any) {
        super.send(body);

        // Hook for the server's response
        this._callOnSend(MockXhrClass.onSend);

        // Make sure to execute after all the onSend() hooks
        Promise.resolve(true).then(() => {
          responses.push({
            status: this.status,
            headers: this.getResponseHeadersHash(),
            body: this.response,
            statusText: this.statusText,
          });
        });
      }
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
      return xhr;
    }

    return { MockXhrClass, responses, doRequest };
  }

  describe('constructor', () => {
    it('should add routes', () => {
      const { MockXhrClass, responses, doRequest } = makeTestHarness();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const server = new MockXhrServer(MockXhrClass, {
        get: ['/get', { status: 200 }],
        'my-method': ['/my-method', { status: 201 }],
        post: ['/post', { status: 404 }],
      });

      doRequest('get', '/get');
      doRequest('my-method', '/my-method');
      doRequest('post', '/post');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(responses.length, 3, 'handlers called');
        assert.strictEqual(responses[0].status, 200);
        assert.strictEqual(responses[1].status, 201);
        assert.strictEqual(responses[2].status, 404);
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

    it('should set and restore XMLHttpRequest on given context', () => {
      const context: any = { XMLHttpRequest: 1 };

      const { MockXhrClass } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.strictEqual(context.XMLHttpRequest, 1, 'XMLHttpRequest property restored');
    });

    it('should set and restore undefined XMLHttpRequest on given context', () => {
      const context: any = { XMLHttpRequest: undefined };

      const { MockXhrClass } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.propertyVal(context, 'XMLHttpRequest', undefined, 'XMLHttpRequest property restored');
    });

    it('should set and delete missing XMLHttpRequest on given context', () => {
      const context: any = {};

      const { MockXhrClass } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.notProperty(context, 'XMLHttpRequest', 'XMLHttpRequest property deleted');
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
      const { MockXhrClass, responses, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.addHandler('method', '/path', response);
      doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(responses.length, 1, 'handler called');
        assert.deepEqual(responses[0], response);
      });
    });

    it('should support callback as handler', () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      let handlerArgument: MockXhr;
      server.addHandler('method', '/path', (xhr) => {
        handlerArgument = xhr;
      });
      const requestXhr = doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(requestXhr, handlerArgument, 'request argument');
      });
    });

    it('should support callback as url matcher', () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      let handlerCallCount = 0;
      const matcher = (url: string) => url.includes('object');
      server.addHandler('method', matcher, () => { handlerCallCount += 1; });
      doRequest('method', '/my/object/somewhere');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(handlerCallCount, 1, 'handler called');
      });
    });

    it('should support regex as url matcher', () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      let handlerCallCount = 0;
      server.addHandler('method', /.*\/object\/.*/i, () => { handlerCallCount += 1; });
      doRequest('method', '/my/object/somewhere');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(handlerCallCount, 1, 'handler called');
      });
    });

    it('should support array of handlers', () => {
      const { MockXhrClass, responses, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };
      const handler = (xhr: MockXhr) => { xhr.respond(404); };

      server.addHandler('method', '/path', [response, handler, response]);
      doRequest('method', '/path');
      doRequest('method', '/path');
      doRequest('method', '/path');
      doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(responses.length, 4, 'handlers called');
        assert.deepEqual(responses[0], response);
        assert.strictEqual(responses[1].status, 404);
        assert.deepEqual(responses[2], response);
        assert.deepEqual(responses[3], response);
      });
    });

    it('should normalize method names as per the XMLHttpRequest spec', () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      let handlerCallCount = 0;
      server.addHandler('get', '/path', () => { handlerCallCount += 1; });
      doRequest('GET', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(handlerCallCount, 1, 'handler called');
      });
    });

    it('should pick first matched handler', () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      let firstHandlerCallCount = 0;
      server.addHandler('method', '/path', () => { firstHandlerCallCount += 1; });
      let secondHandlerCallCount = 0;
      server.addHandler('method', '/path', () => { secondHandlerCallCount += 1; });
      doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(firstHandlerCallCount, 1, 'first handler called');
        assert.strictEqual(secondHandlerCallCount, 0, 'second handler not called');
      });
    });

    it('should coexist with routes given in the constructor', () => {
      const { MockXhrClass, responses, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass, {
        get: ['/get', { status: 200 }],
      });
      server.addHandler('method', '/path', (xhr) => {
        xhr.respond(404);
      });

      doRequest('GET', '/get');
      doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(responses.length, 2, 'handlers called');
        assert.strictEqual(responses[0].status, 200);
        assert.strictEqual(responses[1].status, 404);
      });
    });
  });

  describe('convenience methods', () => {
    const methods = ['get', 'post', 'put', 'delete'] as const;

    methods.forEach((method) => {
      it(`should support ${method}()`, () => {
        const { MockXhrClass, responses, doRequest } = makeTestHarness();
        const server = new MockXhrServer(MockXhrClass);
        const status = 200;

        server[method]('/path', { status });
        doRequest(method, '/path');

        return Promise.resolve(true).then(() => {
          assert.strictEqual(responses.length, 1, 'handler called');
          assert.strictEqual(responses[0].status, status);
        });
      });
    });
  });

  describe('setDefaultHandler()', () => {
    it('should support response hash as handler', () => {
      const { MockXhrClass, responses, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.setDefaultHandler(response);
      doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(responses.length, 1, 'handler called');
        assert.deepEqual(responses[0], response);
      });
    });

    it('should support callback as handler', () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      let handlerArgument: MockXhr;
      server.setDefaultHandler((xhr) => {
        handlerArgument = xhr;
      });
      const requestXhr = doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(requestXhr, handlerArgument, 'request argument');
      });
    });

    it('should support array of handlers', () => {
      const { MockXhrClass, responses, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };
      const handler = (xhr: MockXhr) => { xhr.respond(404); };

      server.setDefaultHandler([response, handler, response]);
      doRequest('method', '/path');
      doRequest('method', '/path');
      doRequest('method', '/path');
      doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(responses.length, 4, 'handlers called');
        assert.deepEqual(responses[0], response);
        assert.strictEqual(responses[1].status, 404);
        assert.deepEqual(responses[2], response);
        assert.deepEqual(responses[3], response);
      });
    });

    it('should have lowest precedence', () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      let handlerCallCount = 0;
      server.addHandler('method', '/path', () => { handlerCallCount += 1; });
      let defaultHandlerCallCount = 0;
      server.setDefaultHandler(() => { defaultHandlerCallCount += 1; });
      doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(handlerCallCount, 1, 'handler called');
        assert.strictEqual(defaultHandlerCallCount, 0, 'default handler should not be called');
      });
    });
  });

  describe('setDefault404()', () => {
    it('should return 404 for unmatched requests', () => {
      const { MockXhrClass, responses, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);

      server.setDefault404();
      doRequest('method', '/path');

      return Promise.resolve(true).then(() => {
        assert.strictEqual(responses.length, 1, 'handler called');
        assert.deepEqual(responses[0].status, 404);
      });
    });
  });

  describe('getRequestLog()', () => {
    it('should return all received requests', () => {
      const { MockXhrClass, doRequest } = makeTestHarness();
      const server = new MockXhrServer(MockXhrClass);
      const handler = (xhr: MockXhr) => { xhr.respond(404); };
      server.addHandler('method', '/path', handler);
      doRequest('method', '/path1');
      doRequest('get', '/path2');
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
