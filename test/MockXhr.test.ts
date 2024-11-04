import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { recordEvents } from './TestUtils.ts';
import HeadersContainer from '../src/HeadersContainer.ts';
import MockXhr from '../src/MockXhr.ts';
import MockXhrRequest from '../src/MockXhrRequest.ts';
import RequestData from '../src/RequestData.ts';
import { upperCaseMethods } from '../src/Utils.ts';
import XhrEventTarget from '../src/XhrEventTarget.ts';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class FormDataMock {}

describe('MockXhr', () => {
  // Asserts that the response is a network error
  function assertNetworkErrorResponse(xhr: MockXhr) {
    assert.strictEqual(xhr.getAllResponseHeaders(), '', 'Response headers');
    assert.strictEqual(xhr.status, 0, 'xhr.status == 0');
    assert.strictEqual(xhr.statusText, '', 'empty xhr.statusText');
    assert.strictEqual(xhr.response, '', 'empty xhr.response');
    assert.strictEqual(xhr.responseText, '', 'empty xhr.responseText');
  }

  function assertSameRequest(req1: RequestData, req2: RequestData) {
    assert.strictEqual(req1.requestHeaders.getAll(), req2.requestHeaders.getAll(), 'headers');
    assert.strictEqual(req1.method, req2.method, 'method');
    assert.strictEqual(req1.url, req2.url, 'url');
    assert.deepEqual(req1.body, req2.body, 'body');
    assert.strictEqual(req1.withCredentials, req2.withCredentials, 'withCredentials');
  }

  describe('states', () => {
    it('should have state constants', () => {
      assert.strictEqual(MockXhr.UNSENT, 0);
      assert.strictEqual(MockXhr.OPENED, 1);
      assert.strictEqual(MockXhr.HEADERS_RECEIVED, 2);
      assert.strictEqual(MockXhr.LOADING, 3);
      assert.strictEqual(MockXhr.DONE, 4);
    });

    it('should have a readyState attribute', () => {
      const xhr = new MockXhr();
      assert.strictEqual(xhr.readyState, MockXhr.UNSENT, 'initial value');
    });

    it('should not call readyState listeners added in dispatchEvent() listeners', () => {
      const xhr = new MockXhr();

      xhr.onreadystatechange = () => {
        xhr.addEventListener('readystatechange', () => {
          assert.fail('listener added in callback should not be called');
        });
      };

      xhr.open('GET', '/url');
    });

    it('should not call readyState listeners removed in dispatchEvent() listeners', () => {
      const xhr = new MockXhr();

      function callback1() {
        xhr.removeEventListener('readystatechange', callback2);
        xhr.removeEventListener('readystatechange', callback3);
        xhr.onreadystatechange = null;
      }
      function callback2() {
        assert.fail('listener added in callback should not be called');
      }
      function callback3() {
        assert.fail('listener added in callback should not be called');
      }
      function callback4() {
        assert.fail('listener added in callback should not be called');
      }
      xhr.addEventListener('readystatechange', callback1);
      xhr.addEventListener('readystatechange', callback2);
      xhr.addEventListener('readystatechange', callback3, { once: true });
      xhr.onreadystatechange = callback4;

      xhr.open('GET', '/url');
    });
  });

  describe('request', () => {
    describe('open()', () => {
      it('should change state', () => {
        const xhr = new MockXhr();
        const events = recordEvents(xhr);

        xhr.open('GET', '/url');

        assert.deepEqual(events, ['readystatechange(1)'], 'readystatechange fired');
      });

      it('should be re-entrant', async () => {
        const xhr = new MockXhr();
        const events = recordEvents(xhr);
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.open('POST', '/url2');
        xhr.send();

        const request = await onSend;
        assert.strictEqual(request.method, 'POST', 'second method');
        assert.strictEqual(request.url, '/url2', 'second url');
        assert.strictEqual(xhr.readyState, MockXhr.OPENED);
        assert.deepEqual(events, [
          'readystatechange(1)',
          'loadstart(0,0,false)',
        ], 'readystatechange fired');
      });

      it('should reject async = false', () => {
        const xhr = new MockXhr();
        const events = recordEvents(xhr);
        assert.throws(() => { xhr.open('GET', '/url', false); }, 'sync false throws');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        assert.throws(() => { xhr.open('GET', '/url', null as any); }, 'sync null throws');
        assert.throws(() => { xhr.open('GET', '/url', undefined); }, 'sync undefined throws');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        assert.throws(() => { xhr.open('GET', '/url', '' as any); }, 'sync empty string throws');
        assert.strictEqual(events.length, 0, 'no events fired');
      });

      it('should reject non-methods', () => {
        const xhr = new MockXhr();
        const tryMethod = (method: string) => {
          return () => { xhr.open(method, '/url'); };
        };
        const events = recordEvents(xhr);
        assert.throws(tryMethod('\\'), 'non-method throws');
        assert.throws(tryMethod(';'), 'non-method throws');
        assert.strictEqual(events.length, 0, 'no events fired');
      });

      it('should reject forbidden methods', () => {
        const xhr = new MockXhr();
        const tryMethod = (method: string) => {
          return () => { xhr.open(method, '/url'); };
        };
        const events = recordEvents(xhr);
        assert.throws(tryMethod('CONNECT'), 'forbidden method throws');
        assert.throws(tryMethod('TRACE'), 'forbidden method throws');
        assert.throws(tryMethod('TRACK'), 'forbidden method throws');
        assert.strictEqual(events.length, 0, 'no events fired');
      });

      it('should normalize method names', async () => {
        const onSends = upperCaseMethods.map((method) => {
          const xhr = new MockXhr();
          xhr.open(method.toLowerCase(), 'url');
          const promise = new Promise<MockXhrRequest>((resolve) => {
            xhr.onSend = resolve;
          });
          xhr.send();
          return promise;
        });

        const requests = await Promise.all(onSends);
        requests.forEach((request, i) => {
          assert.strictEqual(request.method, upperCaseMethods[i]);
        });
      });
    });

    describe('setRequestHeader()', () => {
      it('should record header value', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.setRequestHeader('Head', '1');
        xhr.send();

        const request = await onSend;
        assert.strictEqual(request.requestHeaders.getHeader('HEAD'), '1', 'header is case insensitive');
      });

      it('should record empty header value', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.setRequestHeader('empty-value', '');
        xhr.setRequestHeader('2-empty-values', '');
        xhr.setRequestHeader('2-empty-values', '');
        xhr.setRequestHeader('empty-mid-value', 'a');
        xhr.setRequestHeader('empty-mid-value', '');
        xhr.setRequestHeader('empty-mid-value', 'b');
        xhr.send();

        const request = await onSend;
        assert.strictEqual(request.requestHeaders.getHeader('empty-value'), '');
        assert.strictEqual(request.requestHeaders.getHeader('2-empty-values'), ', ');
        assert.strictEqual(request.requestHeaders.getHeader('empty-mid-value'), 'a, , b');
      });

      it('should throw InvalidStateError if not opened', () => {
        assert.throws(() => {
          new MockXhr().setRequestHeader('Head', '1');
        });
      });

      const forbiddenHeaders = [
        'Accept-Charset',
        'Accept-Encoding',
        'Access-Control-Request-Headers',
        'Access-Control-Request-Method',
        'Connection',
        'Content-Length',
        'Cookie',
        'Cookie2',
        'Date',
        'DNT',
        'Expect',
        'Host',
        'Keep-Alive',
        'Origin',
        'Referer',
        'TE',
        'Trailer',
        'Transfer-Encoding',
        'Upgrade',
        'Via',
      ];
      forbiddenHeaders.forEach((header) => {
        it(`should reject forbidden header ${header}`, async () => {
          const xhr = new MockXhr();
          const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
          xhr.open('GET', '/url');
          xhr.setRequestHeader(header, '1');
          xhr.send();

          const request = await onSend;
          assert.strictEqual(
            request.requestHeaders.getHeader(header),
            null,
            'Forbidden header not set'
          );
        });
      });
    });

    describe('timeout attribute', function () {
      it('can get and set its value', () => {
        const xhr = new MockXhr();
        const timeout = 10;
        assert.strictEqual(xhr.timeout, 0, 'initial value is 0');
        xhr.timeout = timeout;
        assert.strictEqual(xhr.timeout, timeout);
      });

      it('will trigger a timeout if set before send()', (context) => {
        context.mock.timers.enable();
        const xhr = new MockXhr();

        let timedOut = false;
        xhr.addEventListener('timeout', () => { timedOut = true; });
        xhr.open('GET', '/url');
        const events = recordEvents(xhr);
        xhr.timeout = 1;
        xhr.send();

        context.mock.timers.tick(1);

        assert.strictEqual(timedOut, true);
        assert.deepEqual(events, [
          'loadstart(0,0,false)',
          'readystatechange(4)',
          'timeout(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });

      it('will trigger a timeout if set after send()', (context) => {
        context.mock.timers.enable();
        const xhr = new MockXhr();

        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;
        let timedOut = false;
        xhr.addEventListener('timeout', () => { timedOut = true; });

        context.mock.timers.tick(1);

        assert.strictEqual(timedOut, true);
      });

      it('measures timeout delay relative to send()', (context) => {
        context.mock.timers.enable();
        const xhr = new MockXhr();

        xhr.open('GET', '/url');
        xhr.send();

        // Advance the clock relative to send()
        context.mock.timers.tick(20);

        let timedOut = false;
        xhr.ontimeout = () => { timedOut = true; };
        xhr.timeout = 50;
        assert.strictEqual(timedOut, false);

        // Still not timed out. 20 + 29 = 49 < 50
        context.mock.timers.tick(29);
        assert.strictEqual(timedOut, false);

        // 50ms since send()
        context.mock.timers.tick(1);
        assert.strictEqual(timedOut, true);
      });

      it('measures timeout delay relative to send() and clamps to 0', (context) => {
        context.mock.timers.enable();
        const xhr = new MockXhr();

        xhr.open('GET', '/url');
        xhr.send();

        // Advance the clock relative to send()
        context.mock.timers.tick(10);

        let timedOut = false;
        xhr.ontimeout = () => { timedOut = true; };
        xhr.timeout = 10;
        context.mock.timers.tick(0);
        assert.strictEqual(timedOut, true);
      });

      it('has no effect when the response is sent fast enough', async (context) => {
        context.mock.timers.enable();
        const xhr = new MockXhr();

        const onSend = new Promise<MockXhrRequest>((resolve) => {
          xhr.onSend = (request) => {
            request.respond();
            resolve(request);
          };
        });
        let timedOut = false;
        xhr.addEventListener('timeout', () => { timedOut = true; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;

        await onSend;

        // Move past the timeout
        context.mock.timers.tick(20);
        assert.strictEqual(timedOut, false, 'there should be no timeout event');
      });

      it('can be cancelled', (context) => {
        context.mock.timers.enable();
        const xhr = new MockXhr();

        let timedOut = false;
        xhr.addEventListener('timeout', () => { timedOut = true; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;

        context.mock.timers.tick(0);
        xhr.timeout = 0;

        // Wait to make sure the timeout has no effect
        context.mock.timers.tick(20);
        assert.strictEqual(timedOut, false, 'there should be no timeout event');
      });

      it('is cancelled by open()', (context) => {
        context.mock.timers.enable();
        const xhr = new MockXhr();

        let timedOut = false;
        xhr.addEventListener('timeout', () => { timedOut = true; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;
        xhr.open('GET', '/url');

        // Wait to make sure the timeout has no effect
        context.mock.timers.tick(20);
        assert.strictEqual(timedOut, false, 'there should be no timeout event');
      });

      it('can be disabled per instance', (context) => {
        context.mock.timers.enable();
        const xhr = new MockXhr();

        xhr.timeoutEnabled = false;
        let timedOut = false;
        xhr.addEventListener('timeout', () => { timedOut = true; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;

        // Wait to make sure the timeout has no effect
        context.mock.timers.tick(20);
        assert.strictEqual(timedOut, false, 'there should be no timeout event');
      });

      it('can be disabled on subclass', (context) => {
        try {
          context.mock.timers.enable();
          class LocalMockXhr extends MockXhr {}
          const xhr = new LocalMockXhr();

          LocalMockXhr.timeoutEnabled = false;
          let timedOut = false;
          xhr.addEventListener('timeout', () => { timedOut = true; });
          xhr.open('GET', '/url');
          xhr.send();
          xhr.timeout = 1;

          // Wait to make sure the timeout has no effect
          context.mock.timers.tick(20);
          assert.strictEqual(timedOut, false, 'there should be no timeout event');
        } finally {
          MockXhr.timeoutEnabled = true;
        }
      });

      it('can be disabled globally', (context) => {
        try {
          context.mock.timers.enable();
          const xhr = new MockXhr();

          MockXhr.timeoutEnabled = false;
          let timedOut = false;
          xhr.addEventListener('timeout', () => { timedOut = true; });
          xhr.open('GET', '/url');
          xhr.send();
          xhr.timeout = 1;

          // Wait to make sure the timeout has no effect
          context.mock.timers.tick(20);
          assert.strictEqual(timedOut, false, 'there should be no timeout event');
        } finally {
          MockXhr.timeoutEnabled = true;
        }
      });
    });

    describe('withCredentials attribute', () => {
      it('should initially return false', () => {
        const xhr = new MockXhr();
        assert.strictEqual(xhr.withCredentials, false, 'initial value');
      });

      it('should throw if set when state is not unsent or opened or if the send() flag is set', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        assert.throws(() => { xhr.withCredentials = true; });
        request.respond();
        assert.throws(() => { xhr.withCredentials = true; });
      });

      it('can get and set its value', () => {
        const xhr = new MockXhr();
        xhr.withCredentials = true;
        assert.strictEqual(xhr.withCredentials, true, 'value set');
      });
    });

    it('should have an upload attribute', () => {
      const xhr = new MockXhr();
      assert.ok(xhr.upload instanceof XhrEventTarget, 'initial value');
    });

    describe('send()', () => {
      it('should capture RequestData', async () => {
        const xhr = new MockXhr();
        const requestData = new RequestData(
          new HeadersContainer().addHeader('test', 'ok'),
          'POST',
          '/url',
          { body: 'body' },
          true
        );

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open(requestData.method, requestData.url);
        xhr.setRequestHeader('test', 'ok');
        xhr.withCredentials = requestData.withCredentials;
        xhr.send(requestData.body);

        const request = await onSend;
        assertSameRequest(request.requestData, requestData);
      });

      it('should set Content-Type for string body', async () => {
        const xhr = new MockXhr();
        const body = 'body';

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        xhr.send(body);

        const request = await onSend;
        assert.strictEqual(
          request.requestHeaders.getHeader('Content-Type'),
          'text/plain;charset=UTF-8',
          'Content-Type set'
        );
      });

      it('should handle FormData body', async () => {
        // The FormData code path of send() requires FormData in the global context.
        const savedFormData = globalThis.FormData;
        globalThis.FormData = FormDataMock as unknown as typeof globalThis.FormData;
        try {
          const xhr = new MockXhr();
          const body = new FormDataMock();

          const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
          xhr.open('POST', '/url');
          xhr.send(body);

          const request = await onSend;
          assert.strictEqual(
            request.requestHeaders.getHeader('Content-Type'),
            'multipart/form-data; boundary=-----MochXhr1234',
            'Content-Type set'
          );
        } finally {
          globalThis.FormData = savedFormData;
        }
      });

      it('should use body mime type in request header', async () => {
        const xhr = new MockXhr();
        const body = { type: 'image/jpeg' };

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        xhr.send(body);

        const request = await onSend;
        assert.strictEqual(
          request.requestHeaders.getHeader('Content-Type'),
          body.type,
          'Content-Type set'
        );
      });

      it('should not set Content-Type for null body', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        assert.strictEqual(request.body, null, 'Recorded null body');
        assert.strictEqual(
          request.requestHeaders.getHeader('Content-Type'),
          null,
          'Content-Type not set'
        );
      });

      it('should fire loadstart events', () => {
        const xhr = new MockXhr();
        xhr.open('POST', '/url');
        const events = recordEvents(xhr);
        xhr.send('body');

        assert.deepEqual(events, ['loadstart(0,0,false)', 'upload.loadstart(0,4,true)'], 'fired events');
      });

      it('should handle re-open() during loadstart event handler', async () => {
        try {
          const xhr = new MockXhr();

          // Add onSend callbacks
          let onSendCount = 0;
          MockXhr.onSend = () => { onSendCount += 1; };
          let onSendXhrCount = 0;
          xhr.onSend = () => { onSendXhrCount += 1; };

          // re-open() during the loadstart event handler aborts send()
          xhr.open('GET', '/url');
          xhr.addEventListener('loadstart', () => {
            // Open a new request
            xhr.open('GET', '/url');
          });
          xhr.send();

          await Promise.resolve();
          assert.strictEqual(xhr.readyState, MockXhr.OPENED, 'final state OPENED');
          assert.strictEqual(onSendCount, 0, 'onSend() should not be called');
          assert.strictEqual(onSendXhrCount, 0, 'onSend() should not be called');
        } finally {
          delete MockXhr.onSend;
        }
      });
    });

    describe('abort()', () => {
      it('should follow the steps for open()-abort() sequence', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        const events = recordEvents(xhr);
        xhr.abort();

        assert.strictEqual(events.length, 0, 'no abort event');
        assert.strictEqual(xhr.readyState, MockXhr.OPENED, 'final state OPENED');
      });

      it('should follow the steps for open()-send()-abort() sequence', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        const events = recordEvents(xhr);
        xhr.abort();

        assert.deepEqual(events, [
          'readystatechange(4)',
          'abort(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
      });

      it('should follow the steps for open()-send()-HEADERS_RECEIVED-abort() sequence', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        request.setResponseHeaders();
        const events = recordEvents(xhr);
        xhr.abort();
        assert.deepEqual(events, [
          'readystatechange(4)',
          'abort(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
      });

      it('should follow the steps for open()-send()-LOADING-abort() sequence', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        request.setResponseHeaders();
        request.downloadProgress(2, 8);
        const events = recordEvents(xhr);
        xhr.abort();
        assert.deepEqual(events, [
          'readystatechange(4)',
          'abort(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
      });

      it('should follow the steps for open()-send()-DONE-abort() sequence', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        request.respond();
        const events = recordEvents(xhr);
        xhr.abort();
        assert.deepEqual(events, [], 'no fired events');
        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
      });

      it('should fire upload abort for send(body)-abort() sequence', () => {
        const xhr = new MockXhr();
        xhr.open('POST', '/url');
        const events = recordEvents(xhr);
        xhr.send('body');
        xhr.abort();

        assert.deepEqual(events, [
          'loadstart(0,0,false)',
          'upload.loadstart(0,4,true)',
          'readystatechange(4)',
          'upload.abort(0,0,false)',
          'upload.loadend(0,0,false)',
          'abort(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });

      it('should handle abort() during loadstart event handler', async () => {
        try {
          const xhr = new MockXhr();

          // Add onSend callbacks
          let onSendCalled = false;
          xhr.onSend = () => { onSendCalled = true; };
          let onSendXhrCalled = false;
          MockXhr.onSend = () => { onSendXhrCalled = true; };

          // Aborted send() during the loadstart event handler
          xhr.open('GET', '/url');
          xhr.addEventListener('loadstart', () => {
            // Abort the request
            xhr.abort();
          });
          xhr.send();

          await Promise.resolve();
          assert.ok(!onSendCalled, 'onSend() should not be called');
          assert.ok(!onSendXhrCalled, 'onSend() should not be called');
          assert.strictEqual(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
        } finally {
          delete MockXhr.onSend;
        }
      });

      it('should handle nested open() during abort()', () => {
        const xhr = new MockXhr();
        const states: number[] = [];
        let doAbort = false;
        xhr.onreadystatechange = () => {
          states.push(xhr.readyState);
          if (doAbort) {
            xhr.open('GET', '/url');
          }
        };

        xhr.open('GET', '/url');
        xhr.send();
        doAbort = true;
        xhr.abort();

        assert.deepEqual(states, [MockXhr.OPENED, MockXhr.DONE, MockXhr.OPENED]);
      });

      it('should handle nested open()-send() during abort()', () => {
        const xhr = new MockXhr();
        const states: number[] = [];
        let doAbort = false;
        xhr.onreadystatechange = () => {
          states.push(xhr.readyState);
          if (doAbort) {
            doAbort = false;
            xhr.open('GET', '/url');
            xhr.send();
          }
        };

        xhr.open('GET', '/url');
        xhr.send();
        doAbort = true;
        xhr.abort();

        assert.deepEqual(states, [MockXhr.OPENED, MockXhr.DONE, MockXhr.OPENED]);
      });
    });
  });

  describe('response', () => {
    const validResponseTypes = ['', 'arraybuffer', 'blob', 'document', 'json', 'text'] as const;

    it('should have a status attribute', () => {
      const xhr = new MockXhr();
      assert.strictEqual(xhr.status, 0, 'initial value');
    });

    it('should have a statusText attribute', () => {
      const xhr = new MockXhr();
      assert.strictEqual(xhr.statusText, '', 'initial value');
    });

    describe('overrideMimeType()', () => {
      it('should throw if set when state is loading or done', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        request.setResponseHeaders();
        request.downloadProgress(0, 4);
        assert.throws(() => { xhr.overrideMimeType('text/plain'); });
        request.setResponseBody('body');
        assert.throws(() => { xhr.overrideMimeType('text/plain'); });
      });
    });

    describe('responseType attribute', () => {
      it('should initially return the empty string', () => {
        const xhr = new MockXhr();
        assert.strictEqual(xhr.responseType, '', 'initial value');
      });

      it('should throw if set when state is loading or done', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        request.setResponseHeaders();
        request.downloadProgress(0, 4);
        assert.throws(() => { xhr.responseType = 'text'; });
        request.setResponseBody('body');
        assert.throws(() => { xhr.responseType = 'text'; });
      });

      validResponseTypes.forEach((value) => {
        it(`should accept value '${value}'`, () => {
          const xhr = new MockXhr();
          xhr.responseType = value;
          assert.strictEqual(xhr.responseType, value, 'responseType was set');
        });
      });

      it('should ignore invalid values', () => {
        const xhr = new MockXhr();

        // @ts-expect-error We specifically want to test an invalid type here
        xhr.responseType = 'value';
        assert.strictEqual(xhr.responseType, '', 'responseType was not set');
      });
    });

    describe('response attribute', () => {
      it('should be initially empty', () => {
        const xhr = new MockXhr();
        assert.strictEqual(xhr.response, '', 'initial value');
      });

      it('should return the empty string before loading state with text responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        assert.strictEqual(xhr.response, '', 'empty string before loading state');
      });

      it('should return the text response with text responseType', async () => {
        const xhr = new MockXhr();
        const body = 'body';

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        request.setResponseBody(body);
        assert.strictEqual(xhr.response, 'body', 'text response');
      });

      it('should return null if state is not done with non-text responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.responseType = 'json';
        xhr.send();
        assert.strictEqual(xhr.response, null, 'state is not done');
      });

      validResponseTypes.forEach((value) => {
        const data = value === '' || value === 'text' ? ['empty string', ''] : ['null', null];
        it(`should return ${data[0]} with null body and "${value}" responseType`, async () => {
          const xhr = new MockXhr();
          const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
          xhr.open('GET', '/url');
          xhr.responseType = value;
          xhr.send();

          const request = await onSend;
          request.respond();
          assert.strictEqual(xhr.response, data[1], 'responseType was set');
        });
      });

      it('should return the response body as-is with arraybuffer responseType', async () => {
        const xhr = new MockXhr();

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'arraybuffer';
        xhr.send();

        const request = await onSend;
        const body = { body: 'test' };
        request.setResponseBody(body);
        assert.strictEqual(xhr.response, body, 'passthrough response');
      });

      it('should return the response body as-is with blob responseType', async () => {
        const xhr = new MockXhr();

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'blob';
        xhr.send();

        const request = await onSend;
        const body = { body: 'test' };
        request.setResponseBody(body);
        assert.strictEqual(xhr.response, body, 'passthrough response');
      });

      it('should return the response body as-is with document responseType', async () => {
        const xhr = new MockXhr();

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'document';
        xhr.send();

        const request = await onSend;
        const body = { body: 'test' };
        request.setResponseBody(body);
        assert.strictEqual(xhr.response, body, 'passthrough response');
      });

      it('should return the json response with json responseType', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'json';
        xhr.send();

        const request = await onSend;
        request.setResponseBody('{"a": 1}');
        assert.deepEqual(xhr.response, { a: 1 }, 'json response');
      });

      it('should return null for invalid json response with json responseType', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'json';
        xhr.send();

        const request = await onSend;
        request.setResponseBody('{');
        assert.strictEqual(xhr.response, null, 'null response');
      });
    });

    describe('responseText attribute', () => {
      it('should be initially empty', () => {
        const xhr = new MockXhr();
        assert.strictEqual(xhr.responseText, '', 'initial value');
      });

      it('should throw if accessed with non-text responseType', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'json';
        xhr.send();

        const request = await onSend;
        request.respond();
        assert.throws(() => { return xhr.responseText; });
      });

      it('should return the empty string before loading', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        assert.strictEqual(xhr.responseText, '', 'empty string before loading');
      });

      it('should return the text response', async () => {
        const xhr = new MockXhr();

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        const body = 'body';
        request.setResponseBody(body);
        assert.strictEqual(xhr.responseText, body, 'text response');
      });
    });

    describe('responseXML attribute', () => {
      it('should be initially null', () => {
        const xhr = new MockXhr();
        assert.strictEqual(xhr.responseXML, null, 'initial value');
      });

      it('should throw if accessed with non-document responseType', () => {
        const xhr = new MockXhr();
        xhr.responseType = 'json';
        assert.throws(() => { return xhr.responseXML; });
      });

      it('should return null if state is not done', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        assert.strictEqual(xhr.responseXML, null, 'state is not done');
      });

      it('should return the response body as-is with the document responseType', async () => {
        const xhr = new MockXhr();
        xhr.responseType = 'document';

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        const body = { body: 'test' };
        request.setResponseBody(body);
        assert.strictEqual(xhr.responseXML, body, 'passthrough response');
      });
    });
  });

  describe('Lifecycle hooks', () => {
    describe('onCreate()', () => {
      it('should be called', () => {
        try {
          const args: MockXhr[] = [];

          MockXhr.onCreate = (arg) => {
            args.push(arg);
          };

          const xhr = new MockXhr();

          assert.ok(xhr instanceof MockXhr);
          assert.deepEqual(args, [xhr], 'correct parameters for callbacks');
        } finally {
          delete MockXhr.onCreate;
        }
      });
    });

    describe('onSend()', () => {
      it('should be called in order', async () => {
        try {
          class LocalMockXhr extends MockXhr {}
          const xhr = new LocalMockXhr();
          const calls: string[] = [];
          const thisValues: unknown[] = [];
          const argValues: unknown[] = [];

          const onSend = new Promise((resolve) => {
            MockXhr.onSend = function onSend(...args) {
              calls.push('global');
              thisValues.push(this);
              argValues.push(args);
            };

            LocalMockXhr.onSend = function onSendLocal(...args) {
              calls.push('subclass');
              thisValues.push(this);
              argValues.push(args);
            };

            xhr.onSend = function onSendXhr(...args) {
              calls.push('xhr');
              thisValues.push(this);
              argValues.push(args);
              resolve(true);
            };
          });
          xhr.open('GET', '/url');
          xhr.send();

          await onSend;
          const req = xhr.currentRequest;
          assert.ok(req instanceof MockXhrRequest);
          assert.deepEqual(calls, ['global', 'subclass', 'xhr'], 'hooks called in the right order');
          assert.deepEqual(thisValues, [req, req, req], 'correct contexts for callbacks');
          assert.deepEqual(argValues, [[req, xhr], [req, xhr], [req, xhr]], 'correct parameters for callbacks');
        } finally {
          delete MockXhr.onSend;
        }
      });

      it('should call all callback stages even if they are the same function', async () => {
        try {
          class LocalMockXhr extends MockXhr {}
          const xhr = new LocalMockXhr();
          let callCount = 0;

          const onSend = new Promise((resolve) => {
            const onSend = () => {
              if (++callCount === 3) {
                resolve(true);
              }
            };
            MockXhr.onSend = onSend;
            LocalMockXhr.onSend = onSend;
            xhr.onSend = onSend;
          });
          xhr.open('GET', '/url');
          xhr.send();

          await onSend;
          assert.strictEqual(callCount, 3);
        } finally {
          delete MockXhr.onSend;
        }
      });

      it('should defensively copy the callback', async () => {
        try {
          class LocalMockXhr extends MockXhr {}
          const xhr = new LocalMockXhr();
          const calls: string[] = [];

          const onSend = new Promise((resolve) => {
            MockXhr.onSend = () => { calls.push('global'); };
            LocalMockXhr.onSend = () => { calls.push('subclass'); };
            xhr.onSend = () => { calls.push('xhr'); resolve(true); };
          });
          xhr.open('GET', '/url');
          xhr.send();
          delete MockXhr.onSend;
          delete LocalMockXhr.onSend;
          delete xhr.onSend;

          await onSend;
          assert.deepEqual(calls, ['global', 'subclass', 'xhr'], 'hooks called in the right order');
        } finally {
          delete MockXhr.onSend;
        }
      });

      it('should be called for each send() and have versioned requests', async () => {
        const xhr = new MockXhr();
        const requests: RequestData[] = [];

        let status = 200;
        const onSend = new Promise<MockXhrRequest>((resolve) => {
          xhr.onSend = (request) => {
            requests.push(request.requestData);
            request.respond(status++);
            resolve(request);
          };
        });
        xhr.open('GET', '/url1');
        xhr.setRequestHeader('header1', 'val1');
        xhr.send();
        xhr.open('POST', '/url2');
        xhr.setRequestHeader('header2', 'val2');
        xhr.send({ body: 1 });

        await onSend;
        assertSameRequest(requests[0], new RequestData(
          new HeadersContainer().addHeader('header1', 'val1'),
          'GET',
          '/url1'
        ));
        assertSameRequest(requests[1], new RequestData(
          new HeadersContainer().addHeader('header2', 'val2'),
          'POST',
          '/url2',
          { body: 1 }
        ));
        assert.strictEqual(xhr.status, 201, 'received 2nd response');
      });
    });
  });

  describe('MockXhrResponseReceiver interface', () => {
    it('getRequestBodySize() should return the body size', async () => {
      const xhr = new MockXhr();
      const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
      xhr.open('POST', '/url');
      xhr.send('body');

      const request = await onSend;
      assert.strictEqual(request.getRequestBodySize(), 4);
    });

    describe('uploadProgress()', () => {
      it('should fire upload progress events', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        const events = recordEvents(xhr); // Add listeners BEFORE send()
        xhr.send('body');

        const request = await onSend;
        request.uploadProgress(2);
        request.uploadProgress(3);
        assert.deepEqual(events, [
          'loadstart(0,0,false)',
          'upload.loadstart(0,4,true)',
          'upload.progress(2,4,true)',
          'upload.progress(3,4,true)',
        ], 'fired events');
      });

      it('should not fire upload progress events if the upload listener flag is unset', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        xhr.send('body');

        // Add listeners AFTER send()
        const events = recordEvents(xhr);

        const request = await onSend;
        request.uploadProgress(2);
        assert.deepEqual(events, [], 'no fired events');
      });
    });

    describe('respond()', () => {
      it('should set response headers and body', async () => {
        const xhr = new MockXhr();
        const status = 201;
        const headers = { test: 'ok' };
        const responseBody = 'response';
        const statusText = 'all good!';

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        const events = recordEvents(xhr);
        request.respond(status, headers, responseBody, statusText);
        assert.deepEqual(xhr.getResponseHeadersHash(), headers, 'Response headers');
        assert.strictEqual(xhr.status, status, 'xhr.status');
        assert.strictEqual(xhr.statusText, statusText, 'xhr.statusText');
        assert.strictEqual(xhr.response, responseBody, 'xhr.response');
        assert.strictEqual(xhr.responseText, responseBody, 'xhr.responseText');
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          // setResponseHeaders()
          'readystatechange(2)',
          // setResponseBody()
          'readystatechange(3)',
          'progress(8,8,true)',
          'readystatechange(4)',
          'load(8,8,true)',
          'loadend(8,8,true)',
        ], 'fired events');
      });
    });

    describe('setResponseHeaders()', () => {
      it('should set response state and headers', async () => {
        const xhr = new MockXhr();
        const statusText = 'Custom Created';

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        const events = recordEvents(xhr);
        request.setResponseHeaders(201, { 'R-Header': '123' }, statusText);
        assert.strictEqual(xhr.getAllResponseHeaders(), 'r-header: 123\r\n', 'Response headers');
        assert.strictEqual(xhr.status, 201, 'xhr.status');
        assert.strictEqual(xhr.statusText, statusText, 'xhr.statusText');
        assert.strictEqual(xhr.readyState, MockXhr.HEADERS_RECEIVED, 'readyState HEADERS_RECEIVED');
        assert.strictEqual(xhr.response, '', 'no response yet');
        assert.strictEqual(xhr.responseText, '', 'no response yet');
        assert.strictEqual(xhr.readyState, MockXhr.HEADERS_RECEIVED, 'readyState HEADERS_RECEIVED');
        assert.deepEqual(events, ['readystatechange(2)'], 'fired event');
      });

      it('should fire upload progress events for non-empty body', async () => {
        const xhr = new MockXhr();

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');

        // Must add an upload listener before send() for upload progress events to fire
        const events = recordEvents(xhr);
        xhr.send('body');

        const request = await onSend;
        request.setResponseHeaders();
        assert.deepEqual(events, [
          // send()
          'loadstart(0,0,false)',
          'upload.loadstart(0,4,true)',
          // setResponseHeaders()
          'upload.progress(4,4,true)',
          'upload.load(4,4,true)',
          'upload.loadend(4,4,true)',
          'readystatechange(2)',
        ], 'fired events');
      });
    });

    describe('downloadProgress()', () => {
      it('should provide download progress events', async () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.send();

        const request = await onSend;
        request.setResponseHeaders();
        const events = recordEvents(xhr);
        request.downloadProgress(2, 8);
        request.downloadProgress(4, 8);
        assert.strictEqual(xhr.readyState, MockXhr.LOADING, 'readyState LOADING');
        assert.deepEqual(events, [
          // downloadProgress()
          'readystatechange(3)',
          'progress(2,8,true)',
          // downloadProgress()
          'readystatechange(3)',
          'progress(4,8,true)',
        ], 'fired events');
      });
    });

    describe('setResponseBody()', () => {
      it('should set response body and default headers', async () => {
        const xhr = new MockXhr();
        const responseBody = 'response';

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        const events = recordEvents(xhr);
        request.setResponseBody(responseBody);
        assert.strictEqual(xhr.getAllResponseHeaders(), 'content-length: 8\r\n', 'Response headers');
        assert.strictEqual(xhr.status, 200, 'xhr.status');
        assert.strictEqual(xhr.statusText, 'OK', 'xhr.statusText');
        assert.strictEqual(xhr.response, responseBody, 'xhr.response');
        assert.strictEqual(xhr.responseText, responseBody, 'xhr.responseText');
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          // automatic call to setResponseHeaders()
          'readystatechange(2)',
          // respond() events - end of body
          'readystatechange(3)',
          'progress(8,8,true)',
          'readystatechange(4)',
          'load(8,8,true)',
          'loadend(8,8,true)',
        ], 'fired events');
      });

      it('should set response body if called after setResponseHeaders()', async () => {
        const xhr = new MockXhr();
        const responseBody = 'response';

        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        request.setResponseHeaders();
        const events = recordEvents(xhr);
        request.setResponseBody(responseBody);
        assert.strictEqual(xhr.response, responseBody, 'xhr.response');
        assert.strictEqual(xhr.responseText, responseBody, 'xhr.responseText');
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          'readystatechange(3)',
          'progress(8,8,true)',
          'readystatechange(4)',
          'load(8,8,true)',
          'loadend(8,8,true)',
        ], 'fired events');
      });
    });

    describe('setNetworkError()', () => {
      it('should error the request', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        const events = recordEvents(xhr);
        request.setNetworkError();
        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          'readystatechange(4)',
          'error(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });

      it('should error the request after setResponseHeaders()', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        request.setResponseHeaders();
        const events = recordEvents(xhr);
        request.setNetworkError();
        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          'readystatechange(4)',
          'error(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });

      it('should error the request after downloadProgress()', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        request.setResponseHeaders();
        request.downloadProgress(2, 8);
        const events = recordEvents(xhr);
        request.setNetworkError();
        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          'readystatechange(4)',
          'error(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });

      it('should error the request and fire upload events for non-empty body', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        const events = recordEvents(xhr); // Add listeners BEFORE send()
        xhr.send('body');

        const request = await onSend;
        request.setNetworkError();
        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          'loadstart(0,0,false)',
          'upload.loadstart(0,4,true)',
          'readystatechange(4)',
          'upload.error(0,0,false)',
          'upload.loadend(0,0,false)',
          'error(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });
    });

    describe('setRequestTimeout()', () => {
      it('should time out the request', async () => {
        const xhr = new MockXhr();
        let events: string[] = [];
        const onSend = new Promise<MockXhrRequest>((resolve) => {
          xhr.onSend = (request) => {
            events = recordEvents(xhr);
            request.setRequestTimeout();
            resolve(request);
          };
        });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeoutEnabled = false;
        xhr.timeout = 1;

        await onSend;

        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          'readystatechange(4)',
          'timeout(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });

      it('should throw if timeout === 0', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        const request = await onSend;
        assert.throws(() => { request.setRequestTimeout(); });
      });

      it('should time out the request after setResponseHeaders()', async () => {
        const xhr = new MockXhr();

        let events: string[] = [];
        const onSend = new Promise<MockXhrRequest>((resolve) => {
          xhr.onSend = (request) => {
            request.setResponseHeaders();
            events = recordEvents(xhr);
            request.setRequestTimeout();
            resolve(request);
          };
        });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeoutEnabled = false;
        xhr.timeout = 1;

        await onSend;

        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          'readystatechange(4)',
          'timeout(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });

      it('should time out the request after downloadProgress()', async () => {
        const xhr = new MockXhr();

        let events: string[] = [];
        const onSend = new Promise<MockXhrRequest>((resolve) => {
          xhr.onSend = (request) => {
            request.setResponseHeaders();
            request.downloadProgress(2, 8);
            events = recordEvents(xhr);
            request.setRequestTimeout();
            resolve(request);
          };
        });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeoutEnabled = false;
        xhr.timeout = 1;

        await onSend;

        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          'readystatechange(4)',
          'timeout(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });

      it('should time out the request and fire upload events for non-empty body', async () => {
        const xhr = new MockXhr();
        const onSend = new Promise<MockXhrRequest>((resolve) => {
          xhr.onSend = (request) => {
            request.setRequestTimeout();
            resolve(request);
          };
        });
        xhr.open('POST', '/url');
        const events = recordEvents(xhr); // Add listeners BEFORE send()
        xhr.send('body');
        xhr.timeoutEnabled = false;
        xhr.timeout = 1;

        await onSend;

        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        assert.deepEqual(events, [
          'loadstart(0,0,false)',
          'upload.loadstart(0,4,true)',
          'readystatechange(4)',
          'upload.timeout(0,0,false)',
          'upload.loadend(0,0,false)',
          'timeout(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });
    });
  });
});
