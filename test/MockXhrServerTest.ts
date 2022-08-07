import { assert } from 'chai';

import MockXhr, { type OnSendCallback } from '../src/MockXhr';
import MockXhrServer from '../src/MockXhrServer';

describe('MockXhrServer', () => {
  function makeTestHarness() {
    const responses: {
      status?: number,
      headers: Record<string, string>,
      body: any,
      statusText?: string
    }[] = [];

    const onSendPromises: Promise<unknown>[] = [];

    class MockXhrClass extends MockXhr {
      static onSend?: OnSendCallback;

      send(body: any = null) {
        super.send(body);

        // Hook for the server's response
        const { onSend } = MockXhrClass;
        if (onSend) {
          onSendPromises.push(Promise.resolve(true)
            .then(() => onSend.call(this, this))
            .then(() => {
              responses.push({
                status: this.status,
                headers: this.getResponseHeadersHash(),
                body: this.response,
                statusText: this.statusText,
              });
            }));
        }
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

    function waitForServer() {
      return Promise.all(onSendPromises);
    }

    return {
      MockXhrClass,
      responses,
      doRequest,
      waitForServer,
    };
  }

  describe('constructor', () => {
    it('should add routes', () => {
      const harness = makeTestHarness();
      const handlerFn = (xhr: MockXhr) => { xhr.respond(); };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const server = new MockXhrServer(harness.MockXhrClass, {
        get: ['/get', { status: 200 }],
        'my-method': ['/my-method', { status: 201 }],
        post: ['/post', [handlerFn, { status: 404 }]],
      });

      harness.doRequest('get', '/get');
      harness.doRequest('my-method', '/my-method');
      harness.doRequest('post', '/post');
      harness.doRequest('post', '/post');

      return harness.waitForServer().then(() => {
        assert.strictEqual(harness.responses.length, 4, 'handlers called');
        assert.strictEqual(harness.responses[0].status, 200);
        assert.strictEqual(harness.responses[1].status, 201);
        assert.strictEqual(harness.responses[2].status, 200);
        assert.strictEqual(harness.responses[3].status, 404);
      });
    });
  });

  describe('MockXhr access', () => {
    it('should expose the MockXhr class', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);
      assert.strictEqual(server.MockXhr, harness.MockXhrClass, 'MockXhr class exposed');
    });

    it('should provide a factory method for MockXhr', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);
      assert.instanceOf(server.xhrFactory(), harness.MockXhrClass, 'factory method returns MockXhr');
    });
  });

  describe('install() and remove()', () => {
    it('should set and restore XMLHttpRequest on default global context', () => {
      const savedGlobalXMLHttpRequest = globalThis.XMLHttpRequest;
      try {
        const mockGlobalType = {};
        globalThis.XMLHttpRequest = mockGlobalType as unknown as typeof XMLHttpRequest;
        const harness = makeTestHarness();

        const server = new MockXhrServer(harness.MockXhrClass).install();
        assert.strictEqual(globalThis.XMLHttpRequest, harness.MockXhrClass, 'XMLHttpRequest type replaced');

        server.remove();
        assert.strictEqual(globalThis.XMLHttpRequest, mockGlobalType, 'XMLHttpRequest type restored');
      } finally {
        globalThis.XMLHttpRequest = savedGlobalXMLHttpRequest;
      }
    });

    it('should set and restore XMLHttpRequest on context argument', () => {
      const context: any = { XMLHttpRequest: 1 };
      const harness = makeTestHarness();

      const server = new MockXhrServer(harness.MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, harness.MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.strictEqual(context.XMLHttpRequest, 1, 'XMLHttpRequest property restored');
    });

    it('should set and restore undefined XMLHttpRequest on context argument', () => {
      const context: any = { XMLHttpRequest: undefined };
      const harness = makeTestHarness();

      const server = new MockXhrServer(harness.MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, harness.MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.isTrue('XMLHttpRequest' in context, 'XMLHttpRequest property restored');
      assert.isUndefined(context.XMLHttpRequest, 'XMLHttpRequest property restored as undefined');
    });

    it('should set and delete missing XMLHttpRequest on context argument', () => {
      const context: any = {};
      const harness = makeTestHarness();

      const server = new MockXhrServer(harness.MockXhrClass).install(context);
      assert.strictEqual(context.XMLHttpRequest, harness.MockXhrClass, 'XMLHttpRequest property replaced');

      server.remove();
      assert.isFalse('XMLHttpRequest' in context, 'XMLHttpRequest property deleted');
    });

    it('should throw if remove() is called without install()', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);
      assert.throws(() => { server.remove(); });
    });

    it('should throw if remove() is called twice', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);
      server.install({});
      server.remove();
      assert.throws(() => { new MockXhrServer(harness.MockXhrClass).remove(); });
    });
  });

  describe('addHandler()', () => {
    it('should support response hash as handler', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.addHandler('method', '/path', response);
      harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(harness.responses.length, 1, 'handler called');
        assert.deepEqual(harness.responses[0], response);
      });
    });

    it('should support callback as handler', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);

      let handlerArgument: MockXhr;
      server.addHandler('method', '/path', (xhr) => { handlerArgument = xhr; });
      const requestXhr = harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(requestXhr, handlerArgument, 'request argument');
      });
    });

    it('should support callback as url matcher', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);

      let handlerCallCount = 0;
      const matcher = (url: string) => url.includes('object');
      server.addHandler('method', matcher, () => { handlerCallCount += 1; });
      harness.doRequest('method', '/my/object/somewhere');

      return harness.waitForServer().then(() => {
        assert.strictEqual(handlerCallCount, 1, 'handler called');
      });
    });

    it('should support regex as url matcher', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);

      let handlerCallCount = 0;
      server.addHandler('method', /.*\/object\/.*/i, () => { handlerCallCount += 1; });
      harness.doRequest('method', '/my/object/somewhere');

      return harness.waitForServer().then(() => {
        assert.strictEqual(handlerCallCount, 1, 'handler called');
      });
    });

    it('should support array of handlers', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };
      const handler = (xhr: MockXhr) => { xhr.respond(404); };

      server.addHandler('method', '/path', [response, handler, response]);
      harness.doRequest('method', '/path');
      harness.doRequest('method', '/path');
      harness.doRequest('method', '/path');
      harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(harness.responses.length, 4, 'handlers called');
        assert.deepEqual(harness.responses[0], response);
        assert.strictEqual(harness.responses[1].status, 404);
        assert.deepEqual(harness.responses[2], response);
        assert.deepEqual(harness.responses[3], response);
      });
    });

    it('should normalize method names as per the XMLHttpRequest spec', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);

      let handlerCallCount = 0;
      server.addHandler('get', '/path', () => { handlerCallCount += 1; });
      harness.doRequest('GET', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(handlerCallCount, 1, 'handler called');
      });
    });

    it('should pick first matched handler', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);

      let firstHandlerCallCount = 0;
      server.addHandler('method', '/path', () => { firstHandlerCallCount += 1; });
      let secondHandlerCallCount = 0;
      server.addHandler('method', '/path', () => { secondHandlerCallCount += 1; });
      harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(firstHandlerCallCount, 1, 'first handler called');
        assert.strictEqual(secondHandlerCallCount, 0, 'second handler not called');
      });
    });

    it('should handle when there is no matching handler', () => {
      const harness = makeTestHarness();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const server = new MockXhrServer(harness.MockXhrClass);

      const xhr = harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(xhr.readyState, MockXhr.OPENED, 'final state UNSENT');
      });
    });

    it('should coexist with routes given in the constructor', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass, {
        get: ['/get', { status: 200 }],
      });
      server.addHandler('method', '/path', (xhr) => { xhr.respond(404); });

      harness.doRequest('GET', '/get');
      harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(harness.responses.length, 2, 'handlers called');
        assert.strictEqual(harness.responses[0].status, 200);
        assert.strictEqual(harness.responses[1].status, 404);
      });
    });
  });

  describe('convenience methods', () => {
    const methods = ['get', 'post', 'put', 'delete'] as const;

    methods.forEach((method) => {
      it(`should support ${method}()`, () => {
        const harness = makeTestHarness();
        const server = new MockXhrServer(harness.MockXhrClass);
        const status = 200;

        server[method]('/path', { status });
        harness.doRequest(method, '/path');

        return harness.waitForServer().then(() => {
          assert.strictEqual(harness.responses.length, 1, 'handler called');
          assert.strictEqual(harness.responses[0].status, status);
        });
      });
    });
  });

  describe('setDefaultHandler()', () => {
    it('should support response hash as handler', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.setDefaultHandler(response);
      harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(harness.responses.length, 1, 'handler called');
        assert.deepEqual(harness.responses[0], response);
      });
    });

    it('should support callback as handler', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);

      let handlerArgument: MockXhr;
      server.setDefaultHandler((xhr) => {
        handlerArgument = xhr;
      });
      const requestXhr = harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(requestXhr, handlerArgument, 'request argument');
      });
    });

    it('should support array of handlers', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };
      const handler = (xhr: MockXhr) => { xhr.respond(404); };

      server.setDefaultHandler([response, handler, response]);
      harness.doRequest('method', '/path');
      harness.doRequest('method', '/path');
      harness.doRequest('method', '/path');
      harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(harness.responses.length, 4, 'handlers called');
        assert.deepEqual(harness.responses[0], response);
        assert.strictEqual(harness.responses[1].status, 404);
        assert.deepEqual(harness.responses[2], response);
        assert.deepEqual(harness.responses[3], response);
      });
    });

    it('should have lowest precedence', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);

      let handlerCallCount = 0;
      server.addHandler('method', '/path', () => { handlerCallCount += 1; });
      let defaultHandlerCallCount = 0;
      server.setDefaultHandler(() => { defaultHandlerCallCount += 1; });
      harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(handlerCallCount, 1, 'handler called');
        assert.strictEqual(defaultHandlerCallCount, 0, 'default handler should not be called');
      });
    });
  });

  describe('setDefault404()', () => {
    it('should return 404 for unmatched requests', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);

      server.setDefault404();
      harness.doRequest('method', '/path');

      return harness.waitForServer().then(() => {
        assert.strictEqual(harness.responses.length, 1, 'handler called');
        assert.deepEqual(harness.responses[0].status, 404);
      });
    });
  });

  describe('getRequestLog()', () => {
    it('should return all received requests', () => {
      const harness = makeTestHarness();
      const server = new MockXhrServer(harness.MockXhrClass);
      server.addHandler('method', '/path', (xhr) => { xhr.respond(404); });
      harness.doRequest('method', '/path1');
      harness.doRequest('get', '/path2');
      harness.doRequest('POST', '/post', { header: '123' }, 12345);

      return harness.waitForServer().then(() => {
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
