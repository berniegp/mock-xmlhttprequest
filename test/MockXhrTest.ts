import { assert } from 'chai';

import HeadersContainer from '../src/HeadersContainer';
import MockXhr from '../src/MockXhr';
import MockXhrRequest from '../src/MockXhrRequest';
import RequestData from '../src/RequestData';
import { upperCaseMethods } from '../src/Utils';
import XhrEventTarget from '../src/XhrEventTarget';
import { XHR_PROGRESS_EVENT_NAMES } from '../src/XhrProgressEventsNames';

import type XhrProgressEvent from '../src/XhrProgressEvent';

describe('MockXhr', () => {
  // Returns an array which contains all events fired by the xhr
  function recordEvents(xhr: MockXhr) {
    const events: string[] = [];
    const makeEventRecorder = (prefix = '') => {
      return (e: XhrProgressEvent) => {
        events.push(`${prefix}${e.type}(${e.loaded},${e.total},${e.lengthComputable})`);
      };
    };
    XHR_PROGRESS_EVENT_NAMES.forEach((event) => {
      xhr.addEventListener(event, makeEventRecorder());
      xhr.upload.addEventListener(event, makeEventRecorder('upload.'));
    });
    xhr.addEventListener('readystatechange', function readystatechange(this: MockXhr) {
      events.push(`readystatechange(${this.readyState})`);
    });
    return events;
  }

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
  });

  describe('request', () => {
    describe('open()', () => {
      it('should change state', () => {
        const xhr = new MockXhr();
        const events = recordEvents(xhr);

        xhr.open('GET', '/url');

        assert.deepEqual(events, ['readystatechange(1)'], 'readystatechange fired');
      });

      it('should be re-entrant', () => {
        const xhr = new MockXhr();
        const events = recordEvents(xhr);
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.open('POST', '/url2');
        xhr.send();

        return done.then((request) => {
          assert.strictEqual(request.method, 'POST', 'second method');
          assert.strictEqual(request.url, '/url2', 'second url');
          assert.strictEqual(xhr.readyState, MockXhr.OPENED);
          assert.deepEqual(events, [
            'readystatechange(1)',
            'loadstart(0,0,false)',
          ], 'readystatechange fired');
        });
      });

      it('should reject async = false', () => {
        const xhr = new MockXhr();
        const events = recordEvents(xhr);
        assert.throws(() => { xhr.open('GET', '/url', false); }, null, null, 'sync false throws');
        assert.throws(() => { xhr.open('GET', '/url', null as any); }, null, null, 'sync null throws');
        assert.throws(() => { xhr.open('GET', '/url', undefined); }, null, null, 'sync undefined throws');
        assert.throws(() => { xhr.open('GET', '/url', '' as any); }, null, null, 'sync empty string throws');
        assert.lengthOf(events, 0, 'no events fired');
      });

      it('should reject non-methods', () => {
        const xhr = new MockXhr();
        const tryMethod = (method: string) => {
          return () => { xhr.open(method, '/url'); };
        };
        const events = recordEvents(xhr);
        assert.throws(tryMethod('\\'), null, null, 'non-method throws');
        assert.throws(tryMethod(';'), null, null, 'non-method throws');
        assert.lengthOf(events, 0, 'no events fired');
      });

      it('should reject forbidden methods', () => {
        const xhr = new MockXhr();
        const tryMethod = (method: string) => {
          return () => { xhr.open(method, '/url'); };
        };
        const events = recordEvents(xhr);
        assert.throws(tryMethod('CONNECT'), null, null, 'forbidden method throws');
        assert.throws(tryMethod('TRACE'), null, null, 'forbidden method throws');
        assert.throws(tryMethod('TRACK'), null, null, 'forbidden method throws');
        assert.lengthOf(events, 0, 'no events fired');
      });

      it('should normalize method names', () => {
        const promises = upperCaseMethods.map((method) => {
          const xhr = new MockXhr();
          xhr.open(method.toLowerCase(), 'url');
          const promise: Promise<MockXhrRequest> = new Promise((resolve) => {
            xhr.onSend = resolve;
          });
          xhr.send();
          return promise;
        });

        return Promise.all(promises).then((requests) => {
          requests.forEach((request, i) => {
            assert.strictEqual(request.method, upperCaseMethods[i]);
          });
        });
      });
    });

    describe('setRequestHeader()', () => {
      it('should record header value', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.setRequestHeader('Head', '1');
        xhr.send();

        return done.then((request) => {
          assert.strictEqual(request.requestHeaders.getHeader('HEAD'), '1', 'header is case insensitive');
        });
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
        it(`should reject forbidden header ${header}`, () => {
          const xhr = new MockXhr();
          const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
          xhr.open('GET', '/url');
          xhr.setRequestHeader(header, '1');
          xhr.send();

          return done.then((request) => {
            assert.strictEqual(
              request.requestHeaders.getHeader(header),
              null,
              'Forbidden header not set'
            );
          });
        });
      });
    });

    describe('timeout attribute', function () {
      this.slow(100);

      function mockSetTimeout() {
        const calls: [Function, number][] = [];
        const mock = (handler: Function, timeout: number) => { calls.push([handler, timeout]); };
        const saved = globalThis.setTimeout;
        globalThis.setTimeout = mock as typeof global.setTimeout;
        return { calls, restore: () => { globalThis.setTimeout = saved; } };
      }

      it('can get and set its value', () => {
        const xhr = new MockXhr();
        const timeout = 10;
        assert.strictEqual(xhr.timeout, 0, 'initial value is 0');
        xhr.timeout = timeout;
        assert.strictEqual(xhr.timeout, timeout);
      });

      it('will trigger a timeout if set before send()', () => {
        const xhr = new MockXhr();
        const done = new Promise((resolve) => { xhr.addEventListener('timeout', resolve); });
        xhr.open('GET', '/url');
        const events = recordEvents(xhr);
        xhr.timeout = 1;
        xhr.send();

        return done.then(() => {
          assert.deepEqual(events, [
            'loadstart(0,0,false)',
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)',
          ], 'fired events');
        });
      });

      it('will trigger a timeout if set after send()', (done) => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;
        xhr.addEventListener('timeout', () => { done(); });
      });

      it('measures timeout delay relative to send()', (done) => {
        const xhr = new MockXhr();
        const delay = 100;

        xhr.open('GET', '/url');
        xhr.send();

        setTimeout(() => {
          const { calls, restore } = mockSetTimeout();
          try {
            xhr.timeout = delay;
          } finally {
            restore();
          }
          const setTimeoutArg = calls[0][1];
          assert.isAtMost(setTimeoutArg, delay - 20);
          done();
        }, 20);
      });

      it('measures timeout delay relative to send() and clamp to 0', (done) => {
        const xhr = new MockXhr();

        xhr.open('GET', '/url');
        xhr.send();

        setTimeout(() => {
          const { calls, restore } = mockSetTimeout();
          try {
            xhr.timeout = 1;
          } finally {
            restore();
          }
          const setTimeoutArg = calls[0][1];
          assert.strictEqual(setTimeoutArg, 0, 'timeout delay clamped to 0');
          done();
        }, 20);
      });

      it('has no effect when the response is sent fast enough', (done) => {
        const xhr = new MockXhr();
        let gotTimeoutEvent = false;

        xhr.onSend = (request) => { request.respond(); };
        xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;

        // Wait to make sure the timeout has no effect
        setTimeout(() => {
          assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
          done();
        }, 20);
      });

      it('can be cancelled', (done) => {
        const xhr = new MockXhr();
        let gotTimeoutEvent = false;

        xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;
        Promise.resolve(true).then(() => { xhr.timeout = 0; });

        // Wait to make sure the timeout has no effect
        setTimeout(() => {
          assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
          done();
        }, 20);
      });

      it('is cancelled by open()', (done) => {
        const xhr = new MockXhr();
        let gotTimeoutEvent = false;

        xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;
        xhr.open('GET', '/url');

        // Wait to make sure the timeout has no effect
        setTimeout(() => {
          assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
          done();
        }, 20);
      });

      it('can be disabled per instance', (done) => {
        const xhr = new MockXhr();
        let gotTimeoutEvent = false;

        xhr.timeoutEnabled = false;
        xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;

        // Wait to make sure the timeout has no effect
        setTimeout(() => {
          assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
          done();
        }, 20);
      });

      it('can be disabled on subclass', (done) => {
        try {
          class LocalMockXhr extends MockXhr {}
          const xhr = new LocalMockXhr();
          let gotTimeoutEvent = false;

          LocalMockXhr.timeoutEnabled = false;
          xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
          xhr.open('GET', '/url');
          xhr.send();
          xhr.timeout = 1;

          // Wait to make sure the timeout has no effect
          setTimeout(() => {
            assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
            done();
          }, 20);
        } finally {
          MockXhr.timeoutEnabled = true;
        }
      });

      it('can be disabled globally', (done) => {
        try {
          const xhr = new MockXhr();
          let gotTimeoutEvent = false;

          MockXhr.timeoutEnabled = false;
          xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
          xhr.open('GET', '/url');
          xhr.send();
          xhr.timeout = 1;

          // Wait to make sure the timeout has no effect
          setTimeout(() => {
            assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
            done();
          }, 20);
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

      it('should throw if set when state is not unsent or opened or if the send() flag is set', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
          assert.throws(() => { xhr.withCredentials = true; });
          request.respond();
          assert.throws(() => { xhr.withCredentials = true; });
        });
      });

      it('can get and set its value', () => {
        const xhr = new MockXhr();
        xhr.withCredentials = true;
        assert.strictEqual(xhr.withCredentials, true, 'value set');
      });
    });

    it('should have an upload attribute', () => {
      const xhr = new MockXhr();
      assert.instanceOf(xhr.upload, XhrEventTarget, 'initial value');
    });

    describe('send()', () => {
      it('should capture RequestData', () => {
        const xhr = new MockXhr();
        const requestData = new RequestData(
          new HeadersContainer().addHeader('test', 'ok'),
          'POST',
          '/url',
          { body: 'body' },
          true
        );

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open(requestData.method, requestData.url);
        xhr.setRequestHeader('test', 'ok');
        xhr.withCredentials = requestData.withCredentials;
        xhr.send(requestData.body);

        return done.then((request) => {
          assertSameRequest(request.requestData, requestData);
        });
      });

      it('should set Content-Type for string body', () => {
        const xhr = new MockXhr();
        const body = 'body';

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        xhr.send(body);

        return done.then((request) => {
          assert.strictEqual(
            request.requestHeaders.getHeader('Content-Type'),
            'text/plain;charset=UTF-8',
            'Content-Type set'
          );
        });
      });

      it('should use body mime type in request header', () => {
        const xhr = new MockXhr();
        const body = { type: 'image/jpeg' };

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        xhr.send(body);

        return done.then((request) => {
          assert.strictEqual(
            request.requestHeaders.getHeader('Content-Type'),
            body.type,
            'Content-Type set'
          );
        });
      });

      it('should not set Content-Type for null body', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
          assert.strictEqual(request.body, null, 'Recorded null body');
          assert.strictEqual(
            request.requestHeaders.getHeader('Content-Type'),
            null,
            'Content-Type not set'
          );
        });
      });

      it('should fire loadstart events', () => {
        const xhr = new MockXhr();
        xhr.open('POST', '/url');
        const events = recordEvents(xhr);
        xhr.send('body');

        assert.deepEqual(events, ['loadstart(0,0,false)', 'upload.loadstart(0,4,true)'], 'fired events');
      });

      it('should handle re-open() during loadstart event handler', () => {
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

          return Promise.resolve(true).then(() => {
            assert.strictEqual(xhr.readyState, MockXhr.OPENED, 'final state OPENED');
            assert.strictEqual(onSendCount, 0, 'onSend() should not be called');
            assert.strictEqual(onSendXhrCount, 0, 'onSend() should not be called');
          });
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

        assert.lengthOf(events, 0, 'no abort event');
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

      it('should follow the steps for open()-send()-HEADERS_RECEIVED-abort() sequence', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
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
      });

      it('should follow the steps for open()-send()-LOADING-abort() sequence', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
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
      });

      it('should follow the steps for open()-send()-DONE-abort() sequence', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
          request.respond();
          const events = recordEvents(xhr);
          xhr.abort();

          assert.deepEqual(events, [], 'no fired events');
          assertNetworkErrorResponse(xhr);
          assert.strictEqual(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
        });
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

      it('should handle abort() during loadstart event handler', () => {
        try {
          const xhr = new MockXhr();

          // Add onSend callbacks
          let onSendCalled = false;
          xhr.onSend = () => {
            onSendCalled = true;
          };
          let onSendXhrCalled = false;
          MockXhr.onSend = () => {
            onSendXhrCalled = true;
          };

          // Aborted send() during the loadstart event handler
          xhr.open('GET', '/url');
          xhr.addEventListener('loadstart', () => {
            // Abort the request
            xhr.abort();
          });
          xhr.send();

          return Promise.resolve(true).then(() => {
            assert.isFalse(onSendCalled, 'onSend() should not be called');
            assert.isFalse(onSendXhrCalled, 'onSend() should not be called');
            assert.strictEqual(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
          });
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
      it('should throw if set when state is loading or done', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
          request.setResponseHeaders();
          request.downloadProgress(0, 4);
          assert.throws(() => { xhr.overrideMimeType('text/plain'); });
          request.setResponseBody('body');
          assert.throws(() => { xhr.overrideMimeType('text/plain'); });
        });
      });
    });

    describe('responseType attribute', () => {
      it('should initially return the empty string', () => {
        const xhr = new MockXhr();
        assert.strictEqual(xhr.responseType, '', 'initial value');
      });

      it('should throw if set when state is loading or done', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
          request.setResponseHeaders();
          request.downloadProgress(0, 4);
          assert.throws(() => { xhr.responseType = 'text'; });
          request.setResponseBody('body');
          assert.throws(() => { xhr.responseType = 'text'; });
        });
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

        // @ts-ignore
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

      it('should return the text response with text responseType', () => {
        const xhr = new MockXhr();
        const body = 'body';

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
          request.setResponseBody(body);
          assert.strictEqual(xhr.response, 'body', 'text response');
        });
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
        it(`should return ${data[0]} with null body and "${value}" responseType`, () => {
          const xhr = new MockXhr();
          const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
          xhr.open('GET', '/url');
          xhr.responseType = value;
          xhr.send();

          return done.then((request) => {
            request.respond();
            assert.strictEqual(xhr.response, data[1], 'responseType was set');
          });
        });
      });

      it('should return the response body as-is with arraybuffer responseType', () => {
        const xhr = new MockXhr();

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'arraybuffer';
        xhr.send();

        return done.then((request) => {
          const body = { body: 'test' };
          request.setResponseBody(body);
          assert.strictEqual(xhr.response, body, 'passthrough response');
        });
      });

      it('should return the response body as-is with blob responseType', () => {
        const xhr = new MockXhr();

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'blob';
        xhr.send();

        return done.then((request) => {
          const body = { body: 'test' };
          request.setResponseBody(body);
          assert.strictEqual(xhr.response, body, 'passthrough response');
        });
      });

      it('should return the response body as-is with document responseType', () => {
        const xhr = new MockXhr();

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'document';
        xhr.send();

        return done.then((request) => {
          const body = { body: 'test' };
          request.setResponseBody(body);
          assert.strictEqual(xhr.response, body, 'passthrough response');
        });
      });

      it('should return the json response with json responseType', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'json';
        xhr.send();

        return done.then((request) => {
          request.setResponseBody('{"a": 1}');
          assert.deepEqual(xhr.response, { a: 1 }, 'json response');
        });
      });

      it('should return null for invalid json response with json responseType', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'json';
        xhr.send();

        return done.then((request) => {
          request.setResponseBody('{');
          assert.strictEqual(xhr.response, null, 'null response');
        });
      });
    });

    describe('responseText attribute', () => {
      it('should be initially empty', () => {
        const xhr = new MockXhr();
        assert.strictEqual(xhr.responseText, '', 'initial value');
      });

      it('should throw if accessed with non-text responseType', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.responseType = 'json';
        xhr.send();

        return done.then((request) => {
          request.respond();
          assert.throws(() => { return xhr.responseText; });
        });
      });

      it('should return the empty string before loading', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        assert.strictEqual(xhr.responseText, '', 'empty string before loading');
      });

      it('should return the text response', () => {
        const xhr = new MockXhr();

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
          const body = 'body';
          request.setResponseBody(body);
          assert.strictEqual(xhr.responseText, body, 'text response');
        });
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

      it('should return the response body as-is with the document responseType', () => {
        const xhr = new MockXhr();
        xhr.responseType = 'document';

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
          const body = { body: 'test' };
          request.setResponseBody(body);
          assert.strictEqual(xhr.responseXML, body, 'passthrough response');
        });
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

          assert.instanceOf(xhr, MockXhr);
          assert.deepEqual(args, [xhr], 'correct parameters for callbacks');
        } finally {
          delete MockXhr.onCreate;
        }
      });
    });

    describe('onSend()', () => {
      it('should be called in order', () => {
        try {
          class LocalMockXhr extends MockXhr {}
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

      it('should call all callback stages even if they are the same function', () => {
        try {
          class LocalMockXhr extends MockXhr {}
          const xhr = new LocalMockXhr();
          let callCount = 0;

          const done = new Promise((resolve) => {
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

          return done.then(() => {
            assert.strictEqual(callCount, 3);
          });
        } finally {
          delete MockXhr.onSend;
        }
      });

      it('should defensively copy the callback', () => {
        try {
          class LocalMockXhr extends MockXhr {}
          const xhr = new LocalMockXhr();
          const calls: string[] = [];

          const done = new Promise((resolve) => {
            MockXhr.onSend = () => { calls.push('global'); };
            LocalMockXhr.onSend = () => { calls.push('subclass'); };
            xhr.onSend = () => { calls.push('xhr'); resolve(true); };
          });
          xhr.open('GET', '/url');
          xhr.send();
          delete MockXhr.onSend;
          delete LocalMockXhr.onSend;
          delete xhr.onSend;

          return done.then(() => {
            assert.deepEqual(calls, ['global', 'subclass', 'xhr'], 'hooks called in the right order');
          });
        } finally {
          delete MockXhr.onSend;
        }
      });

      it('should be called for each send() and have versioned requests', () => {
        const xhr = new MockXhr();
        const requests: RequestData[] = [];

        let status = 200;
        xhr.onSend = (request) => {
          requests.push(request.requestData);
          request.respond(status++);
        };
        xhr.open('GET', '/url1');
        xhr.setRequestHeader('header1', 'val1');
        xhr.send();
        xhr.open('POST', '/url2');
        xhr.setRequestHeader('header2', 'val2');
        xhr.send({ body: 1 });

        return Promise.resolve(true).then(() => {
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
  });

  describe('MockXhrResponseReceiver interface', () => {
    it('getRequestBodySize() should return the body size', () => {
      const xhr = new MockXhr();
      const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
      xhr.open('POST', '/url');
      xhr.send('body');

      return done.then((request) => {
        assert.strictEqual(request.getRequestBodySize(), 4);
      });
    });

    describe('uploadProgress()', () => {
      it('should fire upload progress events', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        const events = recordEvents(xhr); // Add listeners BEFORE send()
        xhr.send('body');

        return done.then((request) => {
          request.uploadProgress(2);
          request.uploadProgress(3);
          assert.deepEqual(events, [
            'loadstart(0,0,false)',
            'upload.loadstart(0,4,true)',
            'upload.progress(2,4,true)',
            'upload.progress(3,4,true)',
          ], 'fired events');
        });
      });

      it('should not fire upload progress events if the upload listener flag is unset', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        xhr.send('body');

        // Add listeners AFTER send()
        const events = recordEvents(xhr);

        return done.then((request) => {
          request.uploadProgress(2);
          assert.deepEqual(events, [], 'no fired events');
        });
      });
    });

    describe('respond()', () => {
      it('should set response headers and body', () => {
        const xhr = new MockXhr();
        const status = 201;
        const headers = { test: 'ok' };
        const responseBody = 'response';
        const statusText = 'all good!';

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
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
    });

    describe('setResponseHeaders()', () => {
      it('should set response state and headers', () => {
        const xhr = new MockXhr();
        const statusText = 'Custom Created';

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
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
      });

      it('should fire upload progress events for non-empty body', () => {
        const xhr = new MockXhr();

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');

        // Must add an upload listener before send() for upload progress events to fire
        const events = recordEvents(xhr);
        xhr.send('body');

        return done.then((request) => {
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
    });

    describe('downloadProgress()', () => {
      it('should provide download progress events', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.send();

        return done.then((request) => {
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
    });

    describe('setResponseBody()', () => {
      it('should set response body and default headers', () => {
        const xhr = new MockXhr();
        const responseBody = 'response';

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
          const events = recordEvents(xhr);
          request.setResponseBody(responseBody);

          assert.strictEqual(xhr.getAllResponseHeaders(), '', 'Response headers');
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
      });

      it('should set response body if called after setResponseHeaders()', () => {
        const xhr = new MockXhr();
        const responseBody = 'response';

        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
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
    });

    describe('setNetworkError()', () => {
      it('should error the request', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
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
      });

      it('should error the request after setResponseHeaders()', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
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
      });

      it('should error the request after downloadProgress()', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
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
      });

      it('should error the request and fire upload events for non-empty body', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        const events = recordEvents(xhr); // Add listeners BEFORE send()
        xhr.send('body');

        return done.then((request) => {
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
    });

    describe('setRequestTimeout()', () => {
      it('should time out the request', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeoutEnabled = false;
        xhr.timeout = 1;

        return done.then((request) => {
          const events = recordEvents(xhr);
          request.setRequestTimeout();

          assertNetworkErrorResponse(xhr);
          assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
          assert.deepEqual(events, [
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)',
          ], 'fired events');
        });
      });

      it('should throw if timeout === 0', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();

        return done.then((request) => {
          assert.throws(() => request.setRequestTimeout());
        });
      });

      it('should time out the request after setResponseHeaders()', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeoutEnabled = false;
        xhr.timeout = 1;

        return done.then((request) => {
          request.setResponseHeaders();
          const events = recordEvents(xhr);
          request.setRequestTimeout();

          assertNetworkErrorResponse(xhr);
          assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
          assert.deepEqual(events, [
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)',
          ], 'fired events');
        });
      });

      it('should time out the request after downloadProgress()', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeoutEnabled = false;
        xhr.timeout = 1;

        return done.then((request) => {
          request.setResponseHeaders();
          request.downloadProgress(2, 8);
          const events = recordEvents(xhr);
          request.setRequestTimeout();

          assertNetworkErrorResponse(xhr);
          assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
          assert.deepEqual(events, [
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)',
          ], 'fired events');
        });
      });

      it('should time out the request and fire upload events for non-empty body', () => {
        const xhr = new MockXhr();
        const done: Promise<MockXhrRequest> = new Promise((resolve) => { xhr.onSend = resolve; });
        xhr.open('POST', '/url');
        const events = recordEvents(xhr); // Add listeners BEFORE send()
        xhr.send('body');
        xhr.timeoutEnabled = false;
        xhr.timeout = 1;

        return done.then((request) => {
          request.setRequestTimeout();

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
});
