import { assert } from 'chai';

import MockXhr from '../src/MockXhr';
import { newMockXhr, newServer } from '../src/Factories';

describe('Factories', () => {
  describe('newMockXhr()', () => {
    describe('Isolation', () => {
      it('should not return the global MockXhr class', () => {
        const LocalMockXhr = newMockXhr();
        assert.notEqual(LocalMockXhr, MockXhr);
      });

      it('should return different classes on each call', () => {
        const LocalMockXhr1 = newMockXhr();
        const LocalMockXhr2 = newMockXhr();
        assert.notEqual(LocalMockXhr1, LocalMockXhr2);
      });

      it('should isolate MockXMLHttpRequest.onCreate()', () => {
        const LocalMockXhr1 = newMockXhr();
        let onCreate1Count = 0;
        LocalMockXhr1.onCreate = () => {
          onCreate1Count += 1;
        };

        const LocalMockXhr2 = newMockXhr();
        let onCreate2Count = 0;
        LocalMockXhr2.onCreate = () => {
          onCreate2Count += 1;
        };

        const xhr = new LocalMockXhr2();

        assert.instanceOf(xhr, MockXhr);
        assert.strictEqual(onCreate1Count, 0, 'onCreate() from first mock not called');
        assert.strictEqual(onCreate2Count, 1, 'onCreate() from second mock called');
      });

      it('should isolate MockXMLHttpRequest.onSend()', () => {
        let onSend1Count = 0;
        const LocalMockXhr1 = newMockXhr();
        LocalMockXhr1.onSend = () => { onSend1Count += 1; };

        let onSend2Count = 0;
        const LocalMockXhr2 = newMockXhr();
        LocalMockXhr2.onSend = () => { onSend2Count += 1; };

        const xhr = new LocalMockXhr2();
        xhr.open('GET', '/url');
        xhr.send();

        return Promise.resolve(true).then(() => {
          assert.strictEqual(onSend1Count, 0, 'onSend() from first mock not called');
          assert.strictEqual(onSend2Count, 1, 'onSend() from second mock called');
        });
      });

      it('should isolate MockXMLHttpRequest.timeoutEnabled', (done) => {
        try {
          MockXhr.timeoutEnabled = false;
          const LocalMockXhr = newMockXhr();
          const xhr = new LocalMockXhr();
          xhr.open('GET', '/url');
          xhr.send();
          xhr.timeout = 1;
          xhr.addEventListener('timeout', () => { done(); });
        } finally {
          MockXhr.timeoutEnabled = true;
        }
      });
    });

    describe('Hooks', () => {
      it('should call global and local onCreate()', () => {
        try {
          const LocalMockXhr = newMockXhr();
          let onCreateLocalCount = 0;
          LocalMockXhr.onCreate = () => {
            onCreateLocalCount += 1;
          };

          let onCreateCount = 0;
          MockXhr.onCreate = () => {
            onCreateCount += 1;
          };

          const xhr = new LocalMockXhr();

          assert.instanceOf(xhr, MockXhr);
          assert.strictEqual(onCreateCount, 1, 'global onCreate() called');
          assert.strictEqual(onCreateLocalCount, 1, 'local onCreate() called');
        } finally {
          delete MockXhr.onCreate;
        }
      });

      it('should call global onSend(), local onSend() and xhr.onSend()', () => {
        try {
          const LocalMockXhr = newMockXhr();
          const xhr = new LocalMockXhr();

          let paramsOk = true;
          let onSendLocalCount = 0;
          LocalMockXhr.onSend = function onSendLocal(arg) {
            paramsOk &&= this === xhr && arg === xhr;
            onSendLocalCount += 1;
          };

          // Add a "global" onSend callback
          let onSendCount = 0;
          MockXhr.onSend = function onSend(arg) {
            paramsOk &&= this === xhr && arg === xhr;
            onSendCount += 1;
          };

          // Add a request-local onSend callback
          let onSendXhrCount = 0;
          xhr.onSend = function onSendXhr(arg) {
            paramsOk &&= this === xhr && arg === xhr;
            onSendXhrCount += 1;
          };
          xhr.open('GET', '/url');
          xhr.send();

          return Promise.resolve(true).then(() => {
            assert.isTrue(paramsOk, 'correct parameters for callbacks');
            assert.strictEqual(onSendLocalCount, 1, 'subclass onSend callback called');
            assert.strictEqual(onSendCount, 1, '"global" onSend callback called');
            assert.strictEqual(onSendXhrCount, 1, 'request-local onSend callback called');
          });
        } finally {
          delete MockXhr.onSend;
        }
      });
    });

    it('should work with the low-level quick start code', () => {
      const global: any = {};
      function functionToTest(): Promise<any> {
        return new Promise((resolve, reject) => {
          const xhr = new global.XMLHttpRequest() as MockXhr;
          xhr.open('GET', '/my/url');
          xhr.onload = () => resolve(JSON.parse(xhr.response));
          xhr.onerror = () => reject(xhr.statusText);
          xhr.send();
        });
      }

      const MockXhr = newMockXhr();

      // Mock JSON response
      MockXhr.onSend = (xhr: MockXhr) => {
        const responseHeaders = { 'Content-Type': 'application/json' };
        const response = '{ "message": "Success!" }';
        xhr.respond(200, responseHeaders, response);
      };

      try {
        // Install in the global context so "new XMLHttpRequest()" uses the XMLHttpRequest mock
        global.XMLHttpRequest = MockXhr;

        // Do something that send()s an XMLHttpRequest to '/my/url' and returns a Promise
        return functionToTest().then((result) => {
          // Assuming the Promise returned by functionToTest() resolves to the parsed JSON response
          assert.equal(result.message, 'Success!');
        });
      } finally {
        // Remove the mock class from the global context
        delete global.XMLHttpRequest;
      }
    });
  });

  describe('newServer()', () => {
    it('should isolate MockXMLHttpRequest.timeoutEnabled', (done) => {
      const server = newServer();
      server.disableTimeout();
      const xhr = server.xhrFactory();
      xhr.open('GET', '/url');
      // FIXME xhr.send();

      xhr.addEventListener('timeout', () => {
        assert.fail('there should be no timeout event');
      });
      xhr.timeout = 1;

      // Wait to make sure the timeout has no effect
      setTimeout(done, 40);
    });

    it('should work with the quick start code', () => {
      function functionToTest(): Promise<any> {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', '/my/url');
          xhr.onload = () => resolve(JSON.parse(xhr.response));
          xhr.onerror = () => reject(xhr.statusText);
          xhr.send();
        });
      }

      const server = newServer({
        get: ['/my/url', {
          // status: 200 is the default
          headers: { 'Content-Type': 'application/json' },
          body: '{ "message": "Success!" }',
        }],
      });

      try {
        // Install the server's XMLHttpRequest mock in the "global" context.
        // "new XMLHttpRequest()" will then create a mock request to which the server will reply.
        server.install(/* optional context; defaults to globalThis */);

        // Do something that send()s an XMLHttpRequest to '/my/url' and returns a Promise
        return functionToTest().then((result) => {
          // Assuming the Promise returned by functionToTest() resolves to the parsed JSON response
          assert.equal(result.message, 'Success!');
        });
      } finally {
        // Restore the original XMLHttpRequest from the context given to install()
        server.remove();
      }
    });
  });
});
