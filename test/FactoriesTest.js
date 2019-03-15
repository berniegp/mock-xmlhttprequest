'use strict';

const { assert } = require('chai');

const MockXhr = require('../src/MockXhr');
const { newMockXhr, newServer } = require('../src/Factories');

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
        let onCreate1Called = false;
        LocalMockXhr1.onCreate = () => {
          onCreate1Called = true;
        };

        const LocalMockXhr2 = newMockXhr();
        let onCreate2Called = false;
        LocalMockXhr2.onCreate = () => {
          onCreate2Called = true;
        };

        const xhr = new LocalMockXhr2();

        assert.isOk(xhr);
        assert.isNotOk(onCreate1Called, 'onCreate() from first mock not called');
        assert.isOk(onCreate2Called, 'onCreate() from second mock called');
      });

      it('should isolate MockXMLHttpRequest.onSend()', (done) => {
        let onSend1Called = false;

        const LocalMockXhr1 = newMockXhr();
        LocalMockXhr1.onSend = () => {
          onSend1Called = true;
        };

        const LocalMockXhr2 = newMockXhr();
        LocalMockXhr2.onSend = () => {
          // Wait for the call stack to clear before asserting that the other
          // hook is not called.
          setTimeout(() => {
            assert.isNotOk(onSend1Called, 'onCreate() from first mock not called');
            done();
          }, 0);
        };

        const xhr = new LocalMockXhr2();
        xhr.open('GET', '/url');
        xhr.send();
      });

      it('should isolate MockXMLHttpRequest.timeoutEnabled', (done) => {
        try {
          MockXhr.timeoutEnabled = false;
          const LocalMockXhr = newMockXhr();
          const xhr = new LocalMockXhr();
          xhr.open('GET', '/url');
          xhr.send();
          xhr.timeout = 1;
          xhr.addEventListener('timeout', () => {
            done();
          });
        } finally {
          MockXhr.timeoutEnabled = true;
        }
      });
    });

    describe('Hooks', () => {
      it('should call global and local onCreate()', () => {
        try {
          const LocalMockXhr = newMockXhr();
          let onCreateLocalCalled = false;
          LocalMockXhr.onCreate = () => {
            onCreateLocalCalled = true;
          };

          let onCreateCalled = false;
          MockXhr.onCreate = () => {
            onCreateCalled = true;
          };

          const xhr = new LocalMockXhr();

          assert.isOk(xhr);
          assert.isOk(onCreateCalled, 'global onCreate() called');
          assert.isOk(onCreateLocalCalled, 'local onCreate() called');
        } finally {
          delete MockXhr.onCreate;
        }
      });

      it('should call global onSend(), local onSend() and xhr.onSend()', (done) => {
        try {
          let onSendCalled = false;
          let onSendLocalCalled = false;
          let onSendXhrCalled = false;

          const LocalMockXhr = newMockXhr();
          const xhr = new LocalMockXhr();
          LocalMockXhr.onSend = function onSendLocal(arg) {
            assert.equal(this, xhr, 'context');
            assert.equal(arg, xhr, 'argument');
            onSendLocalCalled = true;
            if (onSendCalled && onSendLocalCalled && onSendXhrCalled) {
              done();
            }
          };

          // Add a "global" onSend callback
          MockXhr.onSend = function onSend(arg) {
            assert.equal(this, xhr, 'context');
            assert.equal(arg, xhr, 'argument');
            onSendCalled = true;
            if (onSendCalled && onSendLocalCalled && onSendXhrCalled) {
              done();
            }
          };

          // Add a request-local onSend callback
          xhr.onSend = function onSendXhr(arg) {
            assert.equal(this, xhr, 'context');
            assert.equal(arg, xhr, 'argument');
            onSendXhrCalled = true;
            if (onSendCalled && onSendLocalCalled && onSendXhrCalled) {
              done();
            }
          };
          xhr.open('GET', '/url');
          xhr.send();
        } finally {
          delete MockXhr.onSend;
        }
      });
    });

    it('should work with the quick start code', (done) => {
      const MockXMLHttpRequest = newMockXhr();

      // Mock JSON response
      MockXMLHttpRequest.onSend = (xhr) => {
        const responseHeaders = { 'Content-Type': 'application/json' };
        const response = '{ "message": "Success!" }';
        xhr.respond(200, responseHeaders, response);
      };

      function someAjaxMethod(XMLHttpRequest) {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', '/my/url');
          xhr.onload = () => resolve(JSON.parse(xhr.response));
          xhr.onerror = () => reject(xhr.statusText);
          xhr.send();
        });
      }

      const global = {};

      // Install in the global context so "new XMLHttpRequest()" uses the XMLHttpRequest mock
      global.XMLHttpRequest = MockXMLHttpRequest;

      // Do something that send()s an XMLHttpRequest to '/my/url'
      someAjaxMethod(global.XMLHttpRequest).then((result) => {
        assert.equal(result.message, 'Success!');
        done();
      });

      // Remove the mock class from the global context
      delete global.XMLHttpRequest;
    });
  });

  describe('newServer()', () => {
    it('should isolate MockXMLHttpRequest.timeoutEnabled', (done) => {
      const server = newServer();
      server.disableTimeout();
      const LocalMockXhr = server.xhrMock;
      const xhr = new LocalMockXhr();
      xhr.open('GET', '/url');

      xhr.addEventListener('timeout', () => {
        assert.isOk(false, 'there should be no timeout event');
      });
      xhr.timeout = 1;

      // Wait to make sure the timeout has no effect
      setTimeout(() => { done(); }, 40);
    });

    it('should work with the quick start code', (done) => {
      const server = newServer({
        get: ['/my/url', {
          // status: 200 is the default
          headers: { 'Content-Type': 'application/json' },
          body: '{ "message": "Success!" }',
        }],
      });

      function someAjaxMethod() {
        return new Promise((resolve, reject) => {
          // eslint-disable-next-line no-undef
          const xhr = new XMLHttpRequest();
          xhr.open('GET', '/my/url');
          xhr.onload = () => resolve(JSON.parse(xhr.response));
          xhr.onerror = () => reject(xhr.statusText);
          xhr.send();
        });
      }

      try {
        // Install the server's XMLHttpRequest mock in the "global" context.
        // "new XMLHttpRequest()" will then create a mock request to which the server will reply.
        server.install();

        // Do something that send()s an XMLHttpRequest to '/my/url'
        someAjaxMethod().then((result) => {
          assert.equal(result.message, 'Success!');
          done();
        });
      } finally {
        // Restore the original XMLHttpRequest from the context given to install()
        server.remove();
      }
    });
  });
});
