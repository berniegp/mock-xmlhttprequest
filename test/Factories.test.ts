import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import MockXhr from '../src/MockXhr.ts';
import MockXhrRequest from '../src/MockXhrRequest.ts';
import { newMockXhr, newServer } from '../src/Factories.ts';

interface Globals { XMLHttpRequest?: typeof XMLHttpRequest }

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

        assert.ok(xhr instanceof MockXhr);
        assert.strictEqual(onCreate1Count, 0, 'onCreate() from first mock not called');
        assert.strictEqual(onCreate2Count, 1, 'onCreate() from second mock called');
      });

      it('should isolate MockXMLHttpRequest.onSend()', async () => {
        let onSend1Count = 0;
        const LocalMockXhr1 = newMockXhr();
        LocalMockXhr1.onSend = () => { onSend1Count += 1; };

        let onSend2Count = 0;
        const LocalMockXhr2 = newMockXhr();
        LocalMockXhr2.onSend = () => { onSend2Count += 1; };

        const xhr = new LocalMockXhr2();
        xhr.open('GET', '/url');
        xhr.send();

        await Promise.resolve();
        assert.strictEqual(onSend1Count, 0, 'onSend() from first mock not called');
        assert.strictEqual(onSend2Count, 1, 'onSend() from second mock called');
      });

      it('should isolate MockXMLHttpRequest.timeoutEnabled', (context) => {
        try {
          context.mock.timers.enable();
          MockXhr.timeoutEnabled = false;
          const LocalMockXhr = newMockXhr();
          const xhr = new LocalMockXhr();
          let timedOut = false;
          xhr.addEventListener('timeout', () => { timedOut = true; });
          xhr.open('GET', '/url');
          xhr.send();
          xhr.timeout = 1;

          context.mock.timers.tick(1);
          assert.strictEqual(timedOut, true);
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

          assert.ok(xhr instanceof MockXhr);
          assert.deepEqual(calls, ['global', 'subclass'], 'hooks called in the right order');
          assert.deepEqual(args, [xhr, xhr], 'correct parameters for callbacks');
        } finally {
          delete MockXhr.onCreate;
        }
      });

      it('onSend()', async () => {
        try {
          const LocalMockXhr = newMockXhr();
          const xhr = new LocalMockXhr();
          const calls: string[] = [];
          const thisValues: MockXhrRequest[] = [];
          const args: MockXhrRequest[] = [];

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
          };

          xhr.open('GET', '/url');
          xhr.send();

          await Promise.resolve();
          const req = xhr.currentRequest;
          assert.ok(req instanceof MockXhrRequest);
          assert.deepEqual(calls, ['global', 'subclass', 'xhr'], 'hooks called in the right order');
          assert.deepEqual(thisValues, [req, req, req], 'correct contexts for callbacks');
          assert.deepEqual(args, [req, req, req], 'correct parameters for callbacks');
        } finally {
          delete MockXhr.onSend;
        }
      });
    });

    it('should work with the low-level quick start code', async () => {
      const global: Globals = {};
      function functionToTest(): Promise<{ message: string }> {
        return new Promise((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const xhr = new global.XMLHttpRequest!() as MockXhr;
          xhr.open('GET', '/my/url');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          xhr.onload = () => { resolve(JSON.parse(xhr.response)); };
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          xhr.onerror = () => { reject(xhr.statusText); };
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
        // Install in the global context so "new XMLHttpRequest()" creates MockXhr instances
        global.XMLHttpRequest = MockXhr;

        // Do something that send()s an XMLHttpRequest to '/my/url' and returns a Promise
        // that resolves to the parsed JSON response
        const result = await functionToTest();
        assert.equal(result.message, 'Success!');
      } finally {
        // Restore the original XMLHttpRequest
        delete global.XMLHttpRequest;
      }
    });
  });

  describe('newServer()', () => {
    it('should isolate MockXMLHttpRequest.timeoutEnabled', (context) => {
      context.mock.timers.enable();
      const server = newServer();
      const xhr = server.xhrFactory();

      server.disableTimeout();
      let timedOut = false;
      xhr.addEventListener('timeout', () => { timedOut = true; });
      xhr.open('GET', '/url');
      xhr.send();
      xhr.timeout = 1;

      // Wait to make sure the timeout has no effect
      context.mock.timers.tick(20);
      assert.strictEqual(timedOut, false, 'there should be no timeout event');
    });

    it('should work with the quick start code', async () => {
      function functionToTest(): Promise<{ message: string }> {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', '/my/url');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          xhr.onload = () => { resolve(JSON.parse(xhr.response)); };
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          xhr.onerror = () => { reject(xhr.statusText); };
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
        // that resolves to the parsed JSON response
        const result = await functionToTest();
        assert.equal(result.message, 'Success!');
      } finally {
        // Restore the original XMLHttpRequest
        server.remove();
      }
    });
  });
});
