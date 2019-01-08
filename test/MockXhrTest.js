const { assert } = require('chai');

const MockXhr = require('../src/MockXhr');

describe('MockXhr', () => {
  const xhrEvents = [
    'loadstart',
    'progress',
    'abort',
    'error',
    'load',
    'timeout',
    'loadend',
  ];

  // Returns an array which contains all events fired by the xhr
  function recordEvents(xhr) {
    const events = [];
    const recordEvent = (e, prefix) => {
      prefix = prefix ? 'upload.' : '';
      events.push(`${prefix}${e.type}(${e.loaded},${e.total},${e.lengthComputable})`);
    };
    const recordUploadEvent = (event) => { recordEvent(event, 'upload'); };
    xhrEvents.forEach((event) => {
      xhr.addEventListener(event, recordEvent);
      xhr.upload.addEventListener(event, recordUploadEvent);
    });
    xhr.addEventListener('readystatechange', function readystatechange() {
      events.push(`readystatechange(${this.readyState})`);
    });
    return events;
  }

  // Asserts that the response is a network error
  function assertNetworkErrorResponse(xhr) {
    assert.equal(xhr.getAllResponseHeaders(), '', 'Response headers');
    assert.equal(xhr.status, 0, 'xhr.status == 0');
    assert.equal(xhr.statusText, '', 'empty xhr.statusText');
    assert.equal(xhr.response, '', 'empty xhr.response');
    assert.equal(xhr.responseText, '', 'empty xhr.responseText');
  }

  it('should have state constants', () => {
    assert.equal(MockXhr.UNSENT, 0);
    assert.equal(MockXhr.OPENED, 1);
    assert.equal(MockXhr.HEADERS_RECEIVED, 2);
    assert.equal(MockXhr.LOADING, 3);
    assert.equal(MockXhr.DONE, 4);
  });

  it('should have supported attributes', () => {
    const xhr = new MockXhr();

    assert.isOk(xhr.upload);
    assert.equal(xhr.readyState, MockXhr.UNSENT);
    assertNetworkErrorResponse(xhr);
  });

  const readOnlyAttributes = [
    'upload', 'readyState', 'status', 'statusText', 'response', 'responseText',
  ];
  readOnlyAttributes.forEach((attribute) => {
    it(`${attribute} should be readonly`, () => {
      const xhr = new MockXhr();
      const initial = xhr[attribute];
      xhr[attribute] = 'testing';
      assert.equal(xhr[attribute], initial);
    });
  });

  describe('open()', () => {
    it('should record url and method', () => {
      const xhr = new MockXhr();

      xhr.open('get', '/url');

      assert.equal(xhr.method, 'GET', 'upper-case method');
      assert.equal(xhr.url, '/url');
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

      assert.equal(xhr.method, 'POST', 'second method');
      assert.equal(xhr.url, '/url2', 'second url');
      assert.equal(xhr.readyState, MockXhr.OPENED);
      assert.deepEqual(events, ['readystatechange(1)'], 'readystatechange fired');
    });

    it('should reject forbidden methods', () => {
      const xhr = new MockXhr();
      const events = recordEvents(xhr);

      const tryMethod = (method) => {
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
      assert.equal(xhr.requestHeaders.getHeader('HEAD'), '1', 'header is case-insensitive');
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
        assert.equal(xhr.requestHeaders.getHeader(header), null,
          'Forbidden header not set');
      });
    });
  });

  describe('send()', () => {
    it('should record the request body', () => {
      const xhr = new MockXhr();
      xhr.open('POST', '/url');
      const body = {
        body: 'body',
      };

      xhr.send(body);

      assert.equal(xhr.body, body, 'Recorded request body');
    });

    it('should set Content-Type for string body', () => {
      const xhr = new MockXhr();
      xhr.open('POST', '/url');

      xhr.send('body');

      assert.equal(xhr.requestHeaders.getHeader('Content-Type'),
        'text/plain;charset=UTF-8', 'Content-Type set');
    });

    it('should use body mime type in request header', () => {
      const xhr = new MockXhr();
      xhr.open('POST', '/url');
      const body = {
        type: 'image/jpeg',
      };

      xhr.send(body);

      assert.equal(xhr.requestHeaders.getHeader('Content-Type'), body.type,
        'Content-Type set');
    });

    it('should not set Content-Type for null body', () => {
      const xhr = new MockXhr();
      xhr.open('GET', '/url');

      xhr.send();

      assert.equal(xhr.body, null, 'Recorded null body');
      assert.equal(xhr.requestHeaders.getHeader('Content-Type'), null,
        'Content-Type not set');
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
        xhr.onSend = () => {
          assert.isOk(false, 'onSend() should not be called for aborted send()');
        };
        MockXhr.onSend = () => {
          assert.isOk(false, 'onSend() should not be called for aborted send()');
        };

        // Aborted send() during the loadstart event handler
        xhr.open('GET', '/url');
        xhr.addEventListener('loadstart', () => {
          // Open a new request
          xhr.open('GET', '/url');
        });
        xhr.send();

        assert.equal(xhr.readyState, MockXhr.OPENED, 'final state OPENED');
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
      assert.equal(xhr.readyState, MockXhr.OPENED, 'final state OPENED');
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
      assert.equal(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
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
      assert.equal(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
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
      assert.equal(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
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
      assert.equal(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
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
        xhr.onSend = () => {
          assert.isOk(false, 'onSend() should not be called for aborted send()');
        };
        MockXhr.onSend = () => {
          assert.isOk(false, 'onSend() should not be called for aborted send()');
        };

        // Aborted send() during the loadstart event handler
        xhr.open('GET', '/url');
        xhr.addEventListener('loadstart', () => {
          // Open a new request
          xhr.abort();
        });
        xhr.send();

        assert.equal(xhr.readyState, MockXhr.UNSENT, 'final state UNSENT');
      } finally {
        delete MockXhr.onSend;
      }
    });

    it('should handle nested open() during abort()', () => {
      const xhr = new MockXhr();
      const states = [];
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
      const states = [];
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

  describe('Hooks', () => {
    it('should call MockXMLHttpRequest.onCreate()', () => {
      try {
        let onCreateCalled = false;
        MockXhr.onCreate = () => {
          onCreateCalled = true;
        };

        const xhr = new MockXhr();

        assert.isOk(xhr);
        assert.isOk(onCreateCalled, 'onCreate() called');
      } finally {
        delete MockXhr.onCreate;
      }
    });

    it('should call MockXMLHttpRequest.onSend()', (done) => {
      try {
        const xhr = new MockXhr();

        // Add a "global" onSend callback
        MockXhr.onSend = function onSend(arg) {
          assert.equal(this, xhr, 'context');
          assert.equal(arg, xhr, 'argument');
          done();
        };

        xhr.open('GET', '/url');
        xhr.send();
      } finally {
        delete MockXhr.onSend;
      }
    });

    it('should call xhr.onSend() method', (done) => {
      const xhr = new MockXhr();

      // Add a request-local onSend callback
      xhr.onSend = function onSend(arg) {
        assert.equal(this, xhr, 'context');
        assert.equal(arg, xhr, 'argument');
        done();
      };

      xhr.open('GET', '/url');
      xhr.send();
    });

    it('should call MockXMLHttpRequest.onSend() and xhr.onSend()', (done) => {
      try {
        const xhr = new MockXhr();
        let onSendCalled = false;
        let onSendXhrCalled = false;

        // Add a "global" onSend callback
        MockXhr.onSend = () => {
          onSendCalled = true;
          if (onSendCalled && onSendXhrCalled) {
            done();
          }
        };

        // Add a request-local onSend callback
        xhr.onSend = () => {
          onSendXhrCalled = true;
          if (onSendCalled && onSendXhrCalled) {
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

  describe('Mock responses', () => {
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

      assert.equal(xhr.getAllResponseHeaders(), 'r-header: 123\r\n', 'Response headers');
      assert.equal(xhr.status, 201, 'xhr.status');
      assert.equal(xhr.statusText, 'Created', 'xhr.statusText');
      assert.equal(xhr.response, responseBody, 'xhr.response');
      assert.equal(xhr.responseText, responseBody, 'xhr.responseText');
      assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
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

      assert.equal(xhr.getAllResponseHeaders(), 'r-header: 123\r\n', 'Response headers');
      assert.equal(xhr.status, 201, 'xhr.status');
      assert.equal(xhr.statusText, 'Created', 'xhr.statusText');
      assert.equal(xhr.response, responseBody, 'xhr.response');
      assert.equal(xhr.responseText, responseBody, 'xhr.responseText');
      assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
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

      assert.equal(xhr.getAllResponseHeaders(), 'r-header: 123\r\n', 'Response headers');
      assert.equal(xhr.status, 201, 'xhr.status');
      assert.equal(xhr.statusText, statusText, 'xhr.statusText');
      assert.equal(xhr.readyState, MockXhr.HEADERS_RECEIVED, 'readyState HEADERS_RECEIVED');
      assert.equal(xhr.response, '', 'no response yet');
      assert.equal(xhr.responseText, '', 'no response yet');
      assert.equal(xhr.readyState, MockXhr.HEADERS_RECEIVED, 'readyState HEADERS_RECEIVED');
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
      assert.equal(xhr.readyState, MockXhr.LOADING, 'readyState LOADING');
    });

    it('setResponseBody() should set response state, headers and body', () => {
      const xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      const responseBody = 'response';

      xhr.setResponseBody(responseBody);

      assert.equal(xhr.getAllResponseHeaders(), '', 'Response headers');
      assert.equal(xhr.status, 200, 'xhr.status');
      assert.equal(xhr.statusText, 'OK', 'xhr.statusText');
      assert.equal(xhr.response, responseBody, 'xhr.response');
      assert.equal(xhr.responseText, responseBody, 'xhr.responseText');
      assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
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
        assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
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
          assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
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
          assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
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

describe('MockXhr.newMockXhr()', () => {
  describe('Isolation', () => {
    it('should not return the global MockXhr object', () => {
      const LocalMockXhr = MockXhr.newMockXhr();
      assert.notEqual(LocalMockXhr, MockXhr);
    });

    it('should return different objects on each call', () => {
      const LocalMockXhr1 = MockXhr.newMockXhr();
      const LocalMockXhr2 = MockXhr.newMockXhr();
      assert.notEqual(LocalMockXhr1, LocalMockXhr2);
    });

    it('should isolate MockXMLHttpRequest.onCreate()', () => {
      const LocalMockXhr1 = MockXhr.newMockXhr();
      let onCreate1Called = false;
      LocalMockXhr1.onCreate = () => {
        onCreate1Called = true;
      };

      const LocalMockXhr2 = MockXhr.newMockXhr();
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

      const LocalMockXhr1 = MockXhr.newMockXhr();
      LocalMockXhr1.onSend = () => {
        onSend1Called = true;
      };

      const LocalMockXhr2 = MockXhr.newMockXhr();
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
        const LocalMockXhr = MockXhr.newMockXhr();
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

        const LocalMockXhr = MockXhr.newMockXhr();
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
