import { assert } from 'chai';

import MockXhr from '../src/MockXhr';
import MockXhrRequest from '../src/MockXhrRequest';
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

        return Promise.resolve().then(() => {
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

    describe('Lifecycle hooks', () => {
      it('onCreate()', () => {
        try {
          const LocalMockXhr = newMockXhr();
          const calls: string[] = [];
          const args: MockXhr[] = [];

          MockXhr.onCreate = (arg) => {
            calls.push('global');
            args.push(arg);
          };

          LocalMockXhr.onCreate = (arg) => {
            calls.push('subclass');
            args.push(arg);
          };

          const xhr = new LocalMockXhr();

          assert.instanceOf(xhr, MockXhr);
          assert.deepEqual(calls, ['global', 'subclass'], 'hooks called in the right order');
          assert.deepEqual(args, [xhr, xhr], 'correct parameters for callbacks');
        } finally {
          delete MockXhr.onCreate;
        }
      });

      it('onSend()', () => {
        try {
          const LocalMockXhr = newMockXhr();
          const xhr = new LocalMockXhr();
          const calls: string[] = [];
          const thisValues: MockXhrRequest[] = [];
          const args: MockXhrRequest[] = [];

          const done = new Promise((resolve) => {
            MockXhr.onSend = function onSend(arg) {
              calls.push('global');
              thisValues.push(this);
              args.push(arg);
            };

            LocalMockXhr.onSend = function onSendLocal(arg) {
              calls.push('subclass');
              thisValues.push(this);
              args.push(arg);
            };

            xhr.onSend = function onSendXhr(arg) {
              calls.push('xhr');
              thisValues.push(this);
              args.push(arg);
              resolve(true);
            };
          });

          xhr.open('GET', '/url');
          xhr.send();

          return done.then(() => {
            const req = xhr.currentRequest;
            assert.instanceOf(req, MockXhrRequest);
            assert.deepEqual(calls, ['global', 'subclass', 'xhr'], 'hooks called in the right order');
            assert.deepEqual(thisValues, [req, req, req], 'correct contexts for callbacks');
            assert.deepEqual(args, [req, req, req], 'correct parameters for callbacks');
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

      // Get a "local" MockXhr subclass
      const MockXhr = newMockXhr();

      // Mock JSON response
      MockXhr.onSend = (request) => {
        const responseHeaders = { 'Content-Type': 'application/json' };
        const response = '{ "message": "Success!" }';
        request.respond(200, responseHeaders, response);
      };

      try {
        // Install in the global context so "new XMLHttpRequest()" uses the XMLHttpRequest mock
        global.XMLHttpRequest = MockXhr;

        // Do something that send()s an XMLHttpRequest to '/my/url' and returns a Promise
        return functionToTest().then((result) => {
          // This assumes the returned Promise resolves to the parsed JSON response
          assert.equal(result.message, 'Success!');
        });
      } finally {
        // Restore the original XMLHttpRequest
        delete global.XMLHttpRequest;
      }
    });
  });

  describe('newServer()', () => {
    it('should isolate MockXMLHttpRequest.timeoutEnabled', (done) => {
      const server = newServer();
      const xhr = server.xhrFactory();
      let gotTimeoutEvent = false;

      server.disableTimeout();
      xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
      xhr.open('GET', '/url');
      xhr.send();
      xhr.timeout = 1;

      // Wait to make sure the timeout has no effect
      setTimeout(() => {
        assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
        done();
      }, 40);
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
        // Installs the server's XMLHttpRequest mock in the "global" context.
        // After this, "new XMLHttpRequest()" creates a mock request to which the server replies.
        server.install(/* optional context; defaults to globalThis */);

        // Do something that send()s an XMLHttpRequest to '/my/url' and returns a Promise
        return functionToTest().then((result) => {
          // This assumes the returned Promise resolves to the parsed JSON response
          assert.equal(result.message, 'Success!');
        });
      } finally {
        // Restore the original XMLHttpRequest
        server.remove();
      }
    });
  });
});
