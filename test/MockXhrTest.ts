import { assert } from 'chai';

import MockXhr from '../src/MockXhr';
import XhrEventTarget from '../src/XhrEventTarget';
import { XHR_PROGRESS_EVENT_NAMES } from '../src/XhrProgressEventsNames';

import type XhrProgressEvent from '../src/XhrProgressEvent';

// Temporary fix until https://github.com/DefinitelyTyped/DefinitelyTyped/pull/61161 is merged
declare global {
  namespace Chai {
    interface AssertStatic {
      throws(
        fn: () => void,
        errMsgMatcher?: RegExp | string,
        ignored?: any,
        message?: string
      ) : void;
      throws(
        fn: () => void,
        errorLike?: ErrorConstructor | Error | null,
        errMsgMatcher?: RegExp | string | null,
        message?: string,
      ): void;
    }
  }
}

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
      it('should record url and method', () => {
        const xhr = new MockXhr();

        xhr.open('get', '/url');

        assert.strictEqual(xhr.method, 'GET', 'upper-case method');
        assert.strictEqual(xhr.url, '/url');
      });

      it('should change state', () => {
        const xhr = new MockXhr();
        const events = recordEvents(xhr);

        xhr.open('get', '/url');

        assert.deepEqual(events, ['readystatechange(1)'], 'readystatechange fired');
      });

      it('should be re-entrant', () => {
        const xhr = new MockXhr();
        const events = recordEvents(xhr);

        xhr.open('get', '/url');
        xhr.open('post', '/url2');

        assert.strictEqual(xhr.method, 'POST', 'second method');
        assert.strictEqual(xhr.url, '/url2', 'second url');
        assert.strictEqual(xhr.readyState, MockXhr.OPENED);
        assert.deepEqual(events, ['readystatechange(1)'], 'readystatechange fired');
      });

      it('should reject forbidden methods', () => {
        const xhr = new MockXhr();
        const events = recordEvents(xhr);

        const tryMethod = (method: string) => {
          return () => { xhr.open(method, '/url'); };
        };
        assert.throws(tryMethod('CONNECT'), null, null, 'forbidden method throws');
        assert.throws(tryMethod('TRACE'), null, null, 'forbidden method throws');
        assert.throws(tryMethod('TRACK'), null, null, 'forbidden method throws');
        assert.lengthOf(events, 0, 'no events fired');
      });
    });

    describe('setRequestHeader()', () => {
      it('should record header value', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');

        xhr.setRequestHeader('Head', '1');
        assert.strictEqual(xhr.requestHeaders.getHeader('HEAD'), '1', 'header is case-insensitive');
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
          xhr.open('GET', '/url');
          xhr.setRequestHeader(header, '1');
          assert.strictEqual(
            xhr.requestHeaders.getHeader(header),
            null,
            'Forbidden header not set'
          );
        });
      });
    });

    describe('timeout attribute', function () {
      this.slow(250);

      it('can get and set its value', () => {
        const xhr = new MockXhr();
        const timeout = 10;
        assert.strictEqual(xhr.timeout, 0, 'initial value is 0');
        xhr.timeout = timeout;
        assert.strictEqual(xhr.timeout, timeout);
      });

      it('will trigger a timeout if set before send()', (done) => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        const events = recordEvents(xhr);
        xhr.timeout = 1;
        xhr.addEventListener('timeout', () => {
          assert.deepEqual(events, [
            'loadstart(0,0,false)',
            'readystatechange(4)',
            'timeout(0,0,false)',
          ], 'fired events');
          done();
        });

        xhr.send();
      });

      it('will trigger a timeout if set after send()', (done) => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        xhr.timeout = 1;
        xhr.addEventListener('timeout', () => { done(); });
      });

      it('delay is measured relative to send()', (done) => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();

        const delay = 100;
        setTimeout(() => {
          const setTimeoutAt = Date.now();
          xhr.timeout = delay;
          xhr.addEventListener('timeout', () => {
            const actualDelay = Date.now() - setTimeoutAt;
            assert.isBelow(actualDelay, delay, 'timeout delay relative to start of request');
            done();
          });
        }, delay);
      });

      it('has no effect when the response is sent fast enough', (done) => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();

        let gotTimeoutEvent = false;
        xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
        xhr.timeout = 40;

        xhr.respond();

        // Wait to make sure the timeout has no effect
        setTimeout(() => {
          assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
          done();
        }, 100);
      });

      it('can be cancelled', (done) => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();

        let gotTimeoutEvent = false;
        xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
        xhr.timeout = 40;
        Promise.resolve(true).then(() => { xhr.timeout = 0; });

        // Wait to make sure the timeout has no effect
        setTimeout(() => {
          assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
          done();
        }, 100);
      });

      it('can be disabled per instance', (done) => {
        const xhr = new MockXhr();
        xhr.timeoutEnabled = false;
        xhr.open('GET', '/url');
        xhr.send();

        let gotTimeoutEvent = false;
        xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
        xhr.timeout = 1;

        // Wait to make sure the timeout has no effect
        setTimeout(() => {
          assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
          done();
        }, 40);
      });

      it('can be disabled globally', (done) => {
        try {
          MockXhr.timeoutEnabled = false;
          const xhr = new MockXhr();
          xhr.open('GET', '/url');
          xhr.send();

          let gotTimeoutEvent = false;
          xhr.addEventListener('timeout', () => { gotTimeoutEvent = true; });
          xhr.timeout = 1;

          // Wait to make sure the timeout has no effect
          setTimeout(() => {
            assert.isFalse(gotTimeoutEvent, 'there should be no timeout event');
            done();
          }, 40);
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
        xhr.open('GET', '/url');
        xhr.send();
        assert.throws(() => { xhr.withCredentials = true; });
        xhr.respond();
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
      assert.instanceOf(xhr.upload, XhrEventTarget, 'initial value');
    });

    describe('send()', () => {
      it('should record the request body', () => {
        const xhr = new MockXhr();
        xhr.open('POST', '/url');
        const body = {
          body: 'body',
        };

        xhr.send(body);

        assert.strictEqual(xhr.body, body, 'Recorded request body');
      });

      it('should set Content-Type for string body', () => {
        const xhr = new MockXhr();
        xhr.open('POST', '/url');

        xhr.send('body');

        assert.strictEqual(
          xhr.requestHeaders.getHeader('Content-Type'),
          'text/plain;charset=UTF-8',
          'Content-Type set'
        );
      });

      it('should use body mime type in request header', () => {
        const xhr = new MockXhr();
        xhr.open('POST', '/url');
        const body = {
          type: 'image/jpeg',
        };

        xhr.send(body);

        assert.strictEqual(
          xhr.requestHeaders.getHeader('Content-Type'),
          body.type,
          'Content-Type set'
        );
      });

      it('should not set Content-Type for null body', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');

        xhr.send();

        assert.strictEqual(xhr.body, null, 'Recorded null body');
        assert.strictEqual(
          xhr.requestHeaders.getHeader('Content-Type'),
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
        xhr.open('GET', '/url');
        xhr.send();
        xhr.setResponseHeaders();
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

      it('should follow the steps for open()-send()-LOADING-abort() sequence', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        xhr.setResponseHeaders();
        xhr.downloadProgress(2, 8);
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

      it('should follow the steps for open()-send()-DONE-abort() sequence', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        xhr.respond();

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

      it('should handle abort() during loadstart event handler', () => {
        try {
          const xhr = new MockXhr();

          // Add onSend callbacks
          let onSendCount = 0;
          xhr.onSend = () => {
            onSendCount += 1;
          };
          let onSendXhrCount = 0;
          MockXhr.onSend = () => {
            onSendXhrCount += 1;
          };

          // Aborted send() during the loadstart event handler
          xhr.open('GET', '/url');
          xhr.addEventListener('loadstart', () => {
            // Abort the request
            xhr.abort();
          });
          xhr.send();

          return Promise.resolve(true).then(() => {
            assert.strictEqual(onSendCount, 0, 'onSend() should not be called');
            assert.strictEqual(onSendXhrCount, 0, 'onSend() should not be called');
            assert.strictEqual(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
          });
        } finally {
          delete MockXhr.onSend;
        }
      });

      it('should handle nested open() during abort()', () => {
        const xhr = new MockXhr();
        const states: number[] = [];
        let abortFlag = false;
        xhr.onreadystatechange = () => {
          states.push(xhr.readyState);
          if (abortFlag) {
            xhr.open('GET', '/url');
          }
        };

        xhr.open('GET', '/url');
        xhr.send();
        abortFlag = true;
        xhr.abort();

        assert.deepEqual(states, [MockXhr.OPENED, MockXhr.DONE, MockXhr.OPENED]);
      });

      it('should handle nested open()-send() during abort()', () => {
        const xhr = new MockXhr();
        const states: number[] = [];
        let abortFlag = false;
        xhr.onreadystatechange = () => {
          states.push(xhr.readyState);
          if (abortFlag) {
            abortFlag = false;
            xhr.open('GET', '/url');
            xhr.send();
          }
        };

        xhr.open('GET', '/url');
        xhr.send();
        abortFlag = true;
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
        xhr.open('GET', '/url');
        xhr.send();
        xhr.setResponseHeaders();
        xhr.downloadProgress(0, 4);
        assert.throws(() => { xhr.overrideMimeType('text/plain'); });
        xhr.setResponseBody('body');
        assert.throws(() => { xhr.overrideMimeType('text/plain'); });
      });
    });

    describe('responseType attribute', () => {
      it('should initially return the empty string', () => {
        const xhr = new MockXhr();
        assert.strictEqual(xhr.responseType, '', 'initial value');
      });

      it('should throw if set when state is loading or done', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        xhr.setResponseHeaders();
        xhr.downloadProgress(0, 4);
        assert.throws(() => { xhr.responseType = 'text'; });
        xhr.setResponseBody('body');
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

      it('should return the empty string before loading with text responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        assert.strictEqual(xhr.response, '', 'empty string before loading');
      });

      it('should return the text response with text responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        xhr.setResponseBody('body');
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
        it(`should return ${data[0]} with null body and "${value}" responseType`, () => {
          const xhr = new MockXhr();
          xhr.open('GET', '/url');
          xhr.responseType = value;
          xhr.send();
          xhr.respond();
          assert.strictEqual(xhr.response, data[1], 'responseType was set');
        });
      });

      it('should return the response body as-is with arraybuffer responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.responseType = 'arraybuffer';
        xhr.send();
        const body = { body: 'test' };
        xhr.setResponseBody(body);
        assert.strictEqual(xhr.response, body, 'passthrough response');
      });

      it('should return the response body as-is with blob responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.responseType = 'blob';
        xhr.send();
        const body = { body: 'test' };
        xhr.setResponseBody(body);
        assert.strictEqual(xhr.response, body, 'passthrough response');
      });

      it('should return the response body as-is with document responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.responseType = 'document';
        xhr.send();
        const body = { body: 'test' };
        xhr.setResponseBody(body);
        assert.strictEqual(xhr.response, body, 'passthrough response');
      });

      it('should return the json response with json responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.responseType = 'json';
        xhr.send();
        xhr.setResponseBody('{"a": 1}');
        assert.deepEqual(xhr.response, { a: 1 }, 'json response');
      });

      it('should return null for invalid json response with json responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.responseType = 'json';
        xhr.send();
        xhr.setResponseBody('{');
        assert.strictEqual(xhr.response, null, 'null response');
      });
    });

    describe('responseText attribute', () => {
      it('should be initially empty', () => {
        const xhr = new MockXhr();
        assert.strictEqual(xhr.responseText, '', 'initial value');
      });

      it('should throw if accessed with non-text responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.responseType = 'json';
        xhr.send();
        xhr.respond();
        assert.throws(() => { return xhr.responseText; });
      });

      it('should return the empty string before loading', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        assert.strictEqual(xhr.responseText, '', 'empty string before loading');
      });

      it('should return the text response', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        xhr.setResponseBody('body');
        assert.strictEqual(xhr.responseText, 'body', 'text response');
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

      it('should return the response body as-is with document responseType', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.responseType = 'document';
        xhr.send();
        const body = { body: 'test' };
        xhr.setResponseBody(body);
        assert.strictEqual(xhr.responseXML, body, 'passthrough response');
      });
    });
  });

  describe('Hooks', () => {
    it('should call MockXhr.onCreate()', () => {
      try {
        let onCreateCount = 0;
        MockXhr.onCreate = () => {
          onCreateCount += 1;
        };

        const xhr = new MockXhr();

        assert.instanceOf(xhr, MockXhr);
        assert.strictEqual(onCreateCount, 1, 'onCreate() called');
      } finally {
        delete MockXhr.onCreate;
      }
    });

    it('should call MockXhr.onSend()', () => {
      try {
        const xhr = new MockXhr();

        // Add a "global" onSend callback
        let onSendContext: any;
        let onSendArg: any;
        MockXhr.onSend = function onSend(arg) {
          onSendContext = this;
          onSendArg = arg;
        };

        xhr.open('GET', '/url');
        xhr.send();

        return Promise.resolve(true).then(() => {
          assert.strictEqual(onSendContext, xhr, 'context');
          assert.strictEqual(onSendArg, xhr, 'argument');
        });
      } finally {
        delete MockXhr.onSend;
      }
    });

    it('should call xhr.onSend() method', () => {
      const xhr = new MockXhr();

      // Add a request-local onSend callback
      let onSendContext: any;
      let onSendArg: any;
      xhr.onSend = function onSend(arg) {
        onSendContext = this;
        onSendArg = arg;
      };

      xhr.open('GET', '/url');
      xhr.send();

      return Promise.resolve(true).then(() => {
        assert.strictEqual(onSendContext, xhr, 'context');
        assert.strictEqual(onSendArg, xhr, 'argument');
      });
    });

    it('should call MockXhr.onSend() and xhr.onSend()', () => {
      try {
        const xhr = new MockXhr();

        // Add onSend callbacks
        let onSendCount = 0;
        MockXhr.onSend = () => { onSendCount += 1; };
        let onSendXhrCount = 0;
        xhr.onSend = () => { onSendXhrCount += 1; };

        xhr.open('GET', '/url');
        xhr.send();

        return Promise.resolve(true).then(() => {
          assert.strictEqual(onSendCount, 1, 'called "global" onSend callback');
          assert.strictEqual(onSendXhrCount, 1, 'called request-local onSend callback');
        });
      } finally {
        delete MockXhr.onSend;
      }
    });
  });

  describe('Mock responses', () => {
    it('getRequestBodySize() should return the body size', () => {
      const xhr = new MockXhr();
      xhr.open('POST', '/url');
      xhr.send('body');

      assert.strictEqual(xhr.getRequestBodySize(), 4);
    });

    it('uploadProgress() should fire upload progress events', () => {
      const xhr = new MockXhr();
      xhr.open('POST', '/url');
      const events = recordEvents(xhr);
      xhr.send('body');

      xhr.uploadProgress(2);
      xhr.uploadProgress(3);

      assert.deepEqual(events, [
        'loadstart(0,0,false)',
        'upload.loadstart(0,4,true)',
        'upload.progress(2,4,true)',
        'upload.progress(3,4,true)',
      ], 'fired events');
    });

    it('uploadProgress() should not fire upload progress events if the upload listener flag is unset', () => {
      const xhr = new MockXhr();
      xhr.open('POST', '/url');
      xhr.send('body');

      // Add listeners AFTER the send() call
      const events = recordEvents(xhr);

      xhr.uploadProgress(2);

      assert.deepEqual(events, [], 'no fired events');
    });

    it('respond() should set response state, headers and body', () => {
      const xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      const responseBody = 'response';

      xhr.respond(201, { 'R-Header': '123' }, responseBody);

      assert.strictEqual(xhr.getAllResponseHeaders(), 'r-header: 123\r\n', 'Response headers');
      assert.strictEqual(xhr.status, 201, 'xhr.status');
      assert.strictEqual(xhr.statusText, 'Created', 'xhr.statusText');
      assert.strictEqual(xhr.response, responseBody, 'xhr.response');
      assert.strictEqual(xhr.responseText, responseBody, 'xhr.responseText');
      assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
    });

    it('respond() should fire upload progress events', () => {
      const xhr = new MockXhr();
      xhr.open('POST', '/url');
      const events = recordEvents(xhr);
      xhr.send('body');

      xhr.respond();

      assert.deepEqual(events, [
        'loadstart(0,0,false)',
        'upload.loadstart(0,4,true)',
        // respond() events - headers
        'upload.progress(4,4,true)',
        'upload.load(4,4,true)',
        'upload.loadend(4,4,true)',
        'readystatechange(2)',
        // respond() events - end of body
        'readystatechange(3)',
        'progress(0,0,false)',
        'readystatechange(4)',
        'load(0,0,false)',
        'loadend(0,0,false)',
      ], 'fired events');
    });

    it('respond() should set response state, headers and body', () => {
      const xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      const responseBody = 'response';

      xhr.respond(201, { 'R-Header': '123' }, responseBody);

      assert.strictEqual(xhr.getAllResponseHeaders(), 'r-header: 123\r\n', 'Response headers');
      assert.strictEqual(xhr.status, 201, 'xhr.status');
      assert.strictEqual(xhr.statusText, 'Created', 'xhr.statusText');
      assert.strictEqual(xhr.response, responseBody, 'xhr.response');
      assert.strictEqual(xhr.responseText, responseBody, 'xhr.responseText');
      assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
    });

    it('respond() should not fire upload progress events if the upload listener flag is unset', () => {
      const xhr = new MockXhr();
      xhr.open('POST', '/url');
      xhr.send('body');

      // Add listeners AFTER the send() call
      const events = recordEvents(xhr);

      xhr.respond();

      assert.deepEqual(events, [
        'readystatechange(2)',
        // respond() events - end of body
        'readystatechange(3)',
        'progress(0,0,false)',
        'readystatechange(4)',
        'load(0,0,false)',
        'loadend(0,0,false)',
      ], 'fired events');
    });

    it('respond() with response body should fire progress events', () => {
      const xhr = new MockXhr();
      xhr.open('POST', '/url');
      xhr.send('body');
      const events = recordEvents(xhr);

      xhr.respond(200, null, 'response');

      assert.deepEqual(events, [
        'readystatechange(2)',
        // respond() events - end of body
        'readystatechange(3)',
        'progress(8,8,true)',
        'readystatechange(4)',
        'load(8,8,true)',
        'loadend(8,8,true)',
      ], 'fired events');
    });

    it('respond() with send(null) should not fire upload progress events', () => {
      const xhr = new MockXhr();
      xhr.open('GET', '/url');
      const events = recordEvents(xhr);
      xhr.send();

      xhr.respond();

      assert.deepEqual(events, [
        'loadstart(0,0,false)',
        // respond() events - headers
        'readystatechange(2)',
        // respond() events - end of body
        'readystatechange(3)',
        'progress(0,0,false)',
        'readystatechange(4)',
        'load(0,0,false)',
        'loadend(0,0,false)',
      ], 'fired events');
    });

    it('setResponseHeaders() should set response state and headers', () => {
      const xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      const statusText = 'Custom Created';

      xhr.setResponseHeaders(201, { 'R-Header': '123' }, statusText);

      assert.strictEqual(xhr.getAllResponseHeaders(), 'r-header: 123\r\n', 'Response headers');
      assert.strictEqual(xhr.status, 201, 'xhr.status');
      assert.strictEqual(xhr.statusText, statusText, 'xhr.statusText');
      assert.strictEqual(xhr.readyState, MockXhr.HEADERS_RECEIVED, 'readyState HEADERS_RECEIVED');
      assert.strictEqual(xhr.response, '', 'no response yet');
      assert.strictEqual(xhr.responseText, '', 'no response yet');
      assert.strictEqual(xhr.readyState, MockXhr.HEADERS_RECEIVED, 'readyState HEADERS_RECEIVED');
    });

    it('setResponseHeaders() should fire readystatechange', () => {
      const xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      const events = recordEvents(xhr);

      xhr.setResponseHeaders();

      assert.deepEqual(events, ['readystatechange(2)'], 'fired event');
    });

    it('downloadProgress() should provide download progress events', () => {
      const xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      xhr.setResponseHeaders();
      const events = recordEvents(xhr);

      xhr.downloadProgress(2, 8);
      xhr.downloadProgress(4, 8);

      assert.deepEqual(events, [
        // downloadProgress()
        'readystatechange(3)',
        'progress(2,8,true)',
        // downloadProgress()
        'readystatechange(3)',
        'progress(4,8,true)',
      ], 'fired events');
      assert.strictEqual(xhr.readyState, MockXhr.LOADING, 'readyState LOADING');
    });

    it('setResponseBody() should set response state, headers and body', () => {
      const xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      const responseBody = 'response';

      xhr.setResponseBody(responseBody);

      assert.strictEqual(xhr.getAllResponseHeaders(), '', 'Response headers');
      assert.strictEqual(xhr.status, 200, 'xhr.status');
      assert.strictEqual(xhr.statusText, 'OK', 'xhr.statusText');
      assert.strictEqual(xhr.response, responseBody, 'xhr.response');
      assert.strictEqual(xhr.responseText, responseBody, 'xhr.responseText');
      assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
    });

    it('setResponseBody() should fire progress events', () => {
      const xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      const responseBody = 'response';
      const events = recordEvents(xhr);

      xhr.setResponseBody(responseBody);

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

    describe('setNetworkError()', () => {
      it('should reset state', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();

        xhr.setNetworkError();

        assertNetworkErrorResponse(xhr);
        assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
      });

      it('with request body should fire upload events', () => {
        const xhr = new MockXhr();
        xhr.open('POST', '/url');
        const events = recordEvents(xhr);
        xhr.send('body');

        xhr.setNetworkError();

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

      it('with request body should not fire upload events if the upload listener flag is unset', () => {
        const xhr = new MockXhr();
        xhr.open('POST', '/url');
        xhr.send('body');

        // Add listeners AFTER the send() call
        const events = recordEvents(xhr);

        xhr.setNetworkError();

        assert.deepEqual(events, [
          'readystatechange(4)',
          'error(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });

      it('without request body should not fire upload events', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        const events = recordEvents(xhr);
        xhr.send();

        xhr.setNetworkError();

        assert.deepEqual(events, [
          'loadstart(0,0,false)',
          'readystatechange(4)',
          'error(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });

      it('should work after setResponseHeaders()', () => {
        const xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        const events = recordEvents(xhr);
        xhr.setResponseHeaders();

        xhr.setNetworkError();

        assert.deepEqual(events, [
          'readystatechange(2)',
          'readystatechange(4)',
          'error(0,0,false)',
          'loadend(0,0,false)',
        ], 'fired events');
      });
    });

    describe('setRequestTimeout()', () => {
      describe('during request', () => {
        it('should reset state', () => {
          const xhr = new MockXhr();
          xhr.open('GET', '/url');
          xhr.send();

          xhr.setRequestTimeout();

          assertNetworkErrorResponse(xhr);
          assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        });

        it('with request body should fire upload events', () => {
          const xhr = new MockXhr();
          xhr.open('POST', '/url');
          const events = recordEvents(xhr);
          xhr.send('body');

          xhr.setRequestTimeout();

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

        it('with request body should not fire upload events if the upload listener flag is unset', () => {
          const xhr = new MockXhr();
          xhr.open('POST', '/url');
          xhr.send('body');

          // Add listeners AFTER the send() call
          const events = recordEvents(xhr);

          xhr.setRequestTimeout();

          assert.deepEqual(events, [
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)',
          ], 'fired events');
        });

        it('without request body should not fire upload events', () => {
          const xhr = new MockXhr();
          xhr.open('GET', '/url');
          const events = recordEvents(xhr);
          xhr.send();

          xhr.setRequestTimeout();

          assert.deepEqual(events, [
            'loadstart(0,0,false)',
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)',
          ], 'fired events');
        });

        it('should work after setResponseHeaders()', () => {
          const xhr = new MockXhr();
          xhr.open('GET', '/url');
          xhr.send();
          const events = recordEvents(xhr);
          xhr.setResponseHeaders();

          xhr.setRequestTimeout();

          assert.deepEqual(events, [
            'readystatechange(2)',
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)',
          ], 'fired events');
        });
      });

      describe('during response', () => {
        it('should reset state', () => {
          const xhr = new MockXhr();
          xhr.open('GET', '/url');
          xhr.send();
          xhr.setResponseHeaders();

          xhr.setRequestTimeout();

          assertNetworkErrorResponse(xhr);
          assert.strictEqual(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        });

        it('should fire timeout event', () => {
          const xhr = new MockXhr();
          xhr.open('POST', '/url');
          xhr.send('body');
          xhr.setResponseHeaders();
          const events = recordEvents(xhr);

          xhr.setRequestTimeout();

          assert.deepEqual(events, [
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)',
          ], 'fired events');
        });
      });
    });
  });
});
