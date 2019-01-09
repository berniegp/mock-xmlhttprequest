const { assert } = require('chai');

const MockXhr = require('../src/MockXhr');
const { newMockXhr } = require('../src/Factories');

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
  });
});
