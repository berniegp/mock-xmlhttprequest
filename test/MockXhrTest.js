var assert = require('chai').assert;

var MockXhr = require('../src/MockXhr');

describe('MockXhr', function() {
  var xhrEvents = [
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
    var events = [];
    var recordEvent = function(e, prefix) {
      prefix = prefix ? 'upload.' : '';
      events.push(prefix + e.type + '(' + e.loaded + ',' + e.total +
        ',' + e.lengthComputable +')');
    };
    var recordUploadEvent = function(event) {
      recordEvent(event, 'upload');
    };
    for (var i = 0; i < xhrEvents.length; i++) {
      xhr.addEventListener(xhrEvents[i], recordEvent);
      xhr.upload.addEventListener(xhrEvents[i], recordUploadEvent);
    }
    xhr.addEventListener('readystatechange', function() {
      events.push('readystatechange(' + this.readyState + ')');
    });
    return events;
  }

  it('should have state constants', function() {
    assert.equal(MockXhr.UNSENT, 0);
    assert.equal(MockXhr.OPENED, 1);
    assert.equal(MockXhr.HEADERS_RECEIVED, 2);
    assert.equal(MockXhr.LOADING, 3);
    assert.equal(MockXhr.DONE, 4);
  });

  it('should have supported attributes', function() {
    var xhr = new MockXhr();

    assert.isOk(xhr.upload);
    assert.equal(xhr.readyState, MockXhr.UNSENT);
    assert.equal(xhr.status, 0);
    assert.equal(xhr.statusText, '');
    assert.equal(xhr.responseType, '');
    assert.equal(xhr.response, '');
    assert.equal(xhr.responseText, '');
  });

  var readOnlyAttributes = [
    'upload', 'readyState', 'status', 'statusText', 'response', 'responseText'
  ];
  readOnlyAttributes.forEach(function(attribute) {
    it(attribute + ' should be readonly', function() {
      var xhr = new MockXhr();
      var initial = xhr[attribute];
      xhr[attribute] = 'testing';
      assert.equal(xhr[attribute], initial);
    });
  });

  describe('open()', function() {
    it('should record url and method', function() {
      var xhr = new MockXhr();

      xhr.open('get', '/url');

      assert.equal(xhr.method, 'GET', 'upper-case method');
      assert.equal(xhr.url, '/url');
    });

    it('should change state', function() {
      var xhr = new MockXhr();
      var events = recordEvents(xhr);

      xhr.open('get', '/url');

      assert.deepEqual(events, ['readystatechange(1)'], 'readystatechange fired');
    });

    it('should be re-entrant', function() {
      var xhr = new MockXhr();
      var events = recordEvents(xhr);

      xhr.open('get', '/url');
      xhr.open('post', '/url2');

      assert.equal(xhr.method, 'POST', 'second method');
      assert.equal(xhr.url, '/url2', 'second url');
      assert.equal(xhr.readyState, MockXhr.OPENED);
      assert.deepEqual(events, ['readystatechange(1)'], 'readystatechange fired');
    });

    it('should reject forbidden methods', function() {
      var xhr = new MockXhr();
      var events = recordEvents(xhr);

      var tryMethod = function(method) {
        return function() { xhr.open(method, '/url'); };
      };
      assert.throws(tryMethod('CONNECT'), null, null, 'forbidden method throws');
      assert.throws(tryMethod('TRACE'), null, null, 'forbidden method throws');
      assert.throws(tryMethod('TRACK'), null, null, 'forbidden method throws');
      assert.lengthOf(events, 0, 'no events dispatched');
    });
  });

  describe('setRequestHeader()', function() {
    it('should record header value', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');

      xhr.setRequestHeader('Head', '1');
      assert.equal(xhr.requestHeaders.getHeader('HEAD'), '1', 'header is case-insensitive');
    });

    it('should throw InvalidStateError if not opened', function() {
      assert.throws(function() {
        new MockXhr().setRequestHeader('Head', '1');
      });
    });

    var forbiddenHeaders = [
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
    forbiddenHeaders.forEach(function(header) {
      it('should reject forbidden header ' + header, function() {
        var xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.setRequestHeader(header, '1');
        assert.equal(xhr.requestHeaders.getHeader(header), null,
          'Forbidden header not set');
      });
    });
  });

  describe('send()', function() {
    it('should record the request body', function() {
      var xhr = new MockXhr();
      xhr.open('POST', '/url');
      var body = {
        body: 'body',
      };

      xhr.send(body);

      assert.equal(xhr.body, body, 'Recorded request body');
    });

    it('should set Content-Type for string body', function() {
      var xhr = new MockXhr();
      xhr.open('POST', '/url');

      xhr.send('body');

      assert.equal(xhr.requestHeaders.getHeader('Content-Type'),
        'text/plain;charset=UTF-8', 'Content-Type set');
    });

    it('should use body mime type in request header', function() {
      var xhr = new MockXhr();
      xhr.open('POST', '/url');
      var body = {
        type: 'image/jpeg',
      };

      xhr.send(body);

      assert.equal(xhr.requestHeaders.getHeader('Content-Type'), body.type,
        'Content-Type set');
    });

    it('should not set Content-Type for null body', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');

      xhr.send();

      assert.equal(xhr.body, null, 'Recorded null body');
      assert.equal(xhr.requestHeaders.getHeader('Content-Type'), null,
        'Content-Type not set');
    });

    it('should fire loadstart events', function() {
      var xhr = new MockXhr();
      xhr.open('POST', '/url');
      var events = recordEvents(xhr);

      xhr.send('body');

      assert.deepEqual(events, ['loadstart(0,0,false)', 'upload.loadstart(0,4,true)']);
    });
  });

  describe('abort()', function() {
    it('should not fire an abort event on open()-abort()', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');
      var events = recordEvents(xhr);

      xhr.abort();

      assert.lengthOf(events, 0, 'no abort event');
      assert.equal(xhr.readyState, MockXhr.OPENED, 'final state OPENED');
    });

    it('should fire progress events and an abort event on send()-abort()', function() {
      var xhr = new MockXhr();
      xhr.open('POST', '/url');
      var events = recordEvents(xhr);
      xhr.send('body');

      xhr.abort();

      assert.deepEqual(events, [
        'loadstart(0,0,false)',
        'upload.loadstart(0,4,true)',
        'readystatechange(4)',
        'upload.abort(0,0,false)',
        'upload.loadend(0,0,false)',
        'abort(0,0,false)',
        'loadend(0,0,false)'
      ], 'fired events');
      assert.equal(xhr.readyState, MockXhr.UNSENT);
    });

    it('should fire progress events and an abort event on send(null)-abort()', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');
      var events = recordEvents(xhr);
      xhr.send();

      xhr.abort();

      assert.deepEqual(events, [
        'loadstart(0,0,false)',
        'readystatechange(4)',
        'abort(0,0,false)',
        'loadend(0,0,false)'
      ], 'fired events');
      assert.equal(xhr.readyState, MockXhr.UNSENT);
    });

    it('should handle nested open() during abort()', function() {
      var xhr = new MockXhr();
      var states = [];
      var abortFlag = false;
      xhr.onreadystatechange = function() {
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
      assert.equal(xhr.readyState, MockXhr.OPENED);
    });

    it('should handle nested open()-send() during abort()', function() {
      var xhr = new MockXhr();
      var states = [];
      var abortFlag = false;
      xhr.onreadystatechange = function() {
        states.push(xhr.readyState);
        if (abortFlag) {
          abortFlag =false;
          xhr.open('GET', '/url');
          xhr.send();
        }
      };

      xhr.open('GET', '/url');
      xhr.send();
      abortFlag = true;
      xhr.abort();

      assert.deepEqual(states, [MockXhr.OPENED, MockXhr.DONE, MockXhr.OPENED]);
      assert.equal(xhr.readyState, MockXhr.OPENED);
    });
  });

  describe('Hooks', function() {
    it('should call MockXMLHttpRequest.onCreate()', function() {
      try {
        var onCreateCalled = false;
        MockXhr.onCreate = function() {
          onCreateCalled = true;
        };
        new MockXhr();
        assert.isOk(onCreateCalled, 'onCreate() called');
      } finally {
        delete MockXhr.onCreate;
      }
    });

    it('should call MockXMLHttpRequest.onSend()', function(done) {
      try {
        var xhr;

        // Add a "global" onSend callback
        MockXhr.onSend = function(arg) {
          assert.equal(this, xhr, 'context');
          assert.equal(arg, xhr, 'argument');
          done();
        };
        xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
      } finally {
        delete MockXhr.onSend;
      }
    });

    it('should call xhr.onSend() method', function(done) {
      var xhr = new MockXhr();

      // Add a request-local onSend callback
      xhr.onSend = function(arg) {
        assert.equal(this, xhr, 'context');
        assert.equal(arg, xhr, 'argument');
        done();
      };
      xhr.open('GET', '/url');
      xhr.send();
    });

    it('should call MockXMLHttpRequest.onSend() and xhr.onSend()', function(done) {
      try {
        var xhr;
        var onSendCalled = false;
        var onSendXhrCalled = false;

        // Add a "global" onSend callback
        MockXhr.onSend = function(arg) {
          assert.equal(this, xhr, 'context');
          assert.equal(arg, xhr, 'argument');
          onSendCalled = true;
          if (onSendCalled && onSendXhrCalled)
          {
            done();
          }
        };
        xhr = new MockXhr();

        // Add a request-local onSend callback
        xhr.onSend = function(arg) {
          assert.equal(this, xhr, 'context');
          assert.equal(arg, xhr, 'argument');
          onSendXhrCalled = true;
          if (onSendCalled && onSendXhrCalled)
          {
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

  describe('Mock responses', function() {
    it('uploadProgress() should fire upload progress events', function() {
      var xhr = new MockXhr();
      xhr.open('POST', '/url');
      var events = recordEvents(xhr);
      xhr.send('body');

      xhr.uploadProgress(2);
      xhr.uploadProgress(3);

      assert.deepEqual(events, [
        'loadstart(0,0,false)',
        'upload.loadstart(0,4,true)',
        'upload.progress(2,4,true)',
        'upload.progress(3,4,true)'
      ]);
    });

    it('uploadProgress() should not fire upload progress events if the upload listener flag is unset', function() {
      var xhr = new MockXhr();
      xhr.open('POST', '/url');
      xhr.send('body');

      // Add listeners AFTER the send() call
      var events = recordEvents(xhr);

      xhr.uploadProgress(2);

      assert.deepEqual(events, []);
    });

    it('respond() should set response state, headers and body', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      var responseBody = 'response';

      xhr.respond(201, {'R-Header': '123'}, responseBody);

      assert.equal(xhr.getAllResponseHeaders(), 'r-header: 123', 'Response headers');
      assert.equal(xhr.status, 201, 'xhr.status');
      assert.equal(xhr.statusText, 'Created', 'xhr.statusText');
      assert.equal(xhr.response, responseBody, 'xhr.response');
      assert.equal(xhr.responseText, responseBody, 'xhr.responseText');
      assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
    });

    it('respond() should fire upload progress events', function() {
      var xhr = new MockXhr();
      xhr.open('POST', '/url');
      var events = recordEvents(xhr);
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
        'loadend(0,0,false)'
      ]);
    });

    it('respond() should set response state, headers and body', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      var responseBody = 'response';

      xhr.respond(201, {'R-Header': '123'}, responseBody);

      assert.equal(xhr.getAllResponseHeaders(), 'r-header: 123', 'Response headers');
      assert.equal(xhr.status, 201, 'xhr.status');
      assert.equal(xhr.statusText, 'Created', 'xhr.statusText');
      assert.equal(xhr.response, responseBody, 'xhr.response');
      assert.equal(xhr.responseText, responseBody, 'xhr.responseText');
      assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
    });

    it('respond() should not fire upload progress events if the upload listener flag is unset', function() {
      var xhr = new MockXhr();
      xhr.open('POST', '/url');
      xhr.send('body');

      // Add listeners AFTER the send() call
      var events = recordEvents(xhr);

      xhr.respond();

      assert.deepEqual(events, [
        'readystatechange(2)',
        // respond() events - end of body
        'readystatechange(3)',
        'progress(0,0,false)',
        'readystatechange(4)',
        'load(0,0,false)',
        'loadend(0,0,false)'
      ]);
    });

    it('respond() with response body should fire progress events', function() {
      var xhr = new MockXhr();
      xhr.open('POST', '/url');
      xhr.send('body');
      var events = recordEvents(xhr);

      xhr.respond(200, null, 'response');

      assert.deepEqual(events, [
        'readystatechange(2)',
        // respond() events - end of body
        'readystatechange(3)',
        'progress(8,8,true)',
        'readystatechange(4)',
        'load(8,8,true)',
        'loadend(8,8,true)'
      ]);
    });

    it('respond() with send(null) should not fire upload progress events', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');
      var events = recordEvents(xhr);
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
        'loadend(0,0,false)'
      ]);
    });

    it('setResponseHeaders() should set response state and headers', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      var statusText = 'Custom Created';

      xhr.setResponseHeaders(201, {'R-Header': '123'}, statusText);

      assert.equal(xhr.getAllResponseHeaders(), 'r-header: 123', 'Response headers');
      assert.equal(xhr.status, 201, 'xhr.status');
      assert.equal(xhr.statusText, statusText, 'xhr.statusText');
      assert.equal(xhr.readyState, MockXhr.HEADERS_RECEIVED, 'readyState HEADERS_RECEIVED');
      assert.equal(xhr.response, '', 'no response yet');
      assert.equal(xhr.responseText, '', 'no response yet');
      assert.equal(xhr.readyState, MockXhr.HEADERS_RECEIVED, 'readyState HEADERS_RECEIVED');
    });

    it('setResponseHeaders() should fire readystatechange', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      var events = recordEvents(xhr);

      xhr.setResponseHeaders();

      assert.deepEqual(events, ['readystatechange(2)']);
    });

    it('downloadProgress() should provide download progress events', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      xhr.setResponseHeaders();
      var events = recordEvents(xhr);

      xhr.downloadProgress(2, 8);
      xhr.downloadProgress(4, 8);

      assert.deepEqual(events, [
        // downloadProgress()
        'readystatechange(3)',
        'progress(2,8,true)',
        // downloadProgress()
        'readystatechange(3)',
        'progress(4,8,true)'
      ]);
      assert.equal(xhr.readyState, MockXhr.LOADING, 'readyState LOADING');
    });

    it('setResponseBody() should set response state, headers and body', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      var responseBody = 'response';

      xhr.setResponseBody(responseBody);

      assert.equal(xhr.getAllResponseHeaders(), '', 'Response headers');
      assert.equal(xhr.status, 200, 'xhr.status');
      assert.equal(xhr.statusText, 'OK', 'xhr.statusText');
      assert.equal(xhr.response, responseBody, 'xhr.response');
      assert.equal(xhr.responseText, responseBody, 'xhr.responseText');
      assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
    });

    it('setResponseBody() should fire progress events', function() {
      var xhr = new MockXhr();
      xhr.open('GET', '/url');
      xhr.send();
      var responseBody = 'response';
      var events = recordEvents(xhr);

      xhr.setResponseBody(responseBody);

      assert.deepEqual(events, [
        // automatic call to setResponseHeaders()
        'readystatechange(2)',
        // respond() events - end of body
        'readystatechange(3)',
        'progress(8,8,true)',
        'readystatechange(4)',
        'load(8,8,true)',
        'loadend(8,8,true)'
      ]);
    });

    describe('setNetworkError()', function() {
      it('should reset state', function() {
        var xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();

        xhr.setNetworkError();

        assert.equal(xhr.getAllResponseHeaders(), '', 'Response headers');
        assert.equal(xhr.status, 0, 'xhr.status');
        assert.equal(xhr.statusText, '', 'xhr.statusText');
        assert.equal(xhr.response, '', 'xhr.response');
        assert.equal(xhr.responseText, '', 'xhr.responseText');
        assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
      });

      it('with request body should fire upload events', function() {
        var xhr = new MockXhr();
        xhr.open('POST', '/url');
        var events = recordEvents(xhr);
        xhr.send('body');

        xhr.setNetworkError();

        assert.deepEqual(events, [
          'loadstart(0,0,false)',
          'upload.loadstart(0,4,true)',
          'readystatechange(4)',
          'upload.error(0,0,false)',
          'upload.loadend(0,0,false)',
          'error(0,0,false)',
          'loadend(0,0,false)'
        ]);
      });

      it('with request body should not fire upload events if the upload listener flag is unset', function() {
        var xhr = new MockXhr();
        xhr.open('POST', '/url');
        xhr.send('body');

        // Add listeners AFTER the send() call
        var events = recordEvents(xhr);

        xhr.setNetworkError();

        assert.deepEqual(events, [
          'readystatechange(4)',
          'error(0,0,false)',
          'loadend(0,0,false)'
        ]);
      });

      it('without request body should not fire upload events', function() {
        var xhr = new MockXhr();
        xhr.open('GET', '/url');
        var events = recordEvents(xhr);
        xhr.send();

        xhr.setNetworkError();

        assert.deepEqual(events, [
          'loadstart(0,0,false)',
          'readystatechange(4)',
          'error(0,0,false)',
          'loadend(0,0,false)'
        ]);
      });

      it('should work after setResponseHeaders()', function() {
        var xhr = new MockXhr();
        xhr.open('GET', '/url');
        xhr.send();
        var events = recordEvents(xhr);
        xhr.setResponseHeaders();

        xhr.setNetworkError();

        assert.deepEqual(events, [
          'readystatechange(2)',
          'readystatechange(4)',
          'error(0,0,false)',
          'loadend(0,0,false)'
        ]);
      });
    });

    describe('setRequestTimeout()', function() {
      describe('during request', function() {
        it('should reset state', function() {
          var xhr = new MockXhr();
          xhr.open('GET', '/url');
          xhr.send();

          xhr.setRequestTimeout();

          assert.equal(xhr.getAllResponseHeaders(), '', 'Response headers');
          assert.equal(xhr.status, 0, 'xhr.status');
          assert.equal(xhr.statusText, '', 'xhr.statusText');
          assert.equal(xhr.response, '', 'xhr.response');
          assert.equal(xhr.responseText, '', 'xhr.responseText');
          assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        });

        it('with request body should fire upload events', function() {
          var xhr = new MockXhr();
          xhr.open('POST', '/url');
          var events = recordEvents(xhr);
          xhr.send('body');

          xhr.setRequestTimeout();

          assert.deepEqual(events, [
            'loadstart(0,0,false)',
            'upload.loadstart(0,4,true)',
            'readystatechange(4)',
            'upload.timeout(0,0,false)',
            'upload.loadend(0,0,false)',
            'timeout(0,0,false)',
            'loadend(0,0,false)'
          ]);
        });

        it('with request body should not fire upload events if the upload listener flag is unset', function() {
          var xhr = new MockXhr();
          xhr.open('POST', '/url');
          xhr.send('body');

          // Add listeners AFTER the send() call
          var events = recordEvents(xhr);

          xhr.setRequestTimeout();

          assert.deepEqual(events, [
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)'
          ]);
        });

        it('without request body should not fire upload events', function() {
          var xhr = new MockXhr();
          xhr.open('GET', '/url');
          var events = recordEvents(xhr);
          xhr.send();

          xhr.setRequestTimeout();

          assert.deepEqual(events, [
            'loadstart(0,0,false)',
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)'
          ]);
        });

        it('should work after setResponseHeaders()', function() {
          var xhr = new MockXhr();
          xhr.open('GET', '/url');
          xhr.send();
          var events = recordEvents(xhr);
          xhr.setResponseHeaders();

          xhr.setRequestTimeout();

          assert.deepEqual(events, [
            'readystatechange(2)',
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)'
          ]);
        });
      });

      describe('during response', function() {
        it('should reset state', function() {
          var xhr = new MockXhr();
          xhr.open('GET', '/url');
          xhr.send();
          xhr.setResponseHeaders();

          xhr.setRequestTimeout();

          assert.equal(xhr.getAllResponseHeaders(), '', 'Response headers');
          assert.equal(xhr.status, 0, 'xhr.status');
          assert.equal(xhr.statusText, '', 'xhr.statusText');
          assert.equal(xhr.response, '', 'xhr.response');
          assert.equal(xhr.responseText, '', 'xhr.responseText');
          assert.equal(xhr.readyState, MockXhr.DONE, 'readyState DONE');
        });

        it('should fire timeout event', function() {
          var xhr = new MockXhr();
          xhr.open('POST', '/url');
          xhr.send('body');
          xhr.setResponseHeaders();
          var events = recordEvents(xhr);

          xhr.setRequestTimeout();

          assert.deepEqual(events, [
            'readystatechange(4)',
            'timeout(0,0,false)',
            'loadend(0,0,false)'
          ]);
        });
      });
    });
  });
});

describe('MockXhr.newMockXhr()', function() {
  describe('Isolation', function() {
    it('should not return the global MockXhr object', function() {
      var LocalMockXhr = MockXhr.newMockXhr();
      assert.notEqual(LocalMockXhr, MockXhr);
    });

    it('should return different objects on each call', function() {
      var LocalMockXhr1 = MockXhr.newMockXhr();
      var LocalMockXhr2 = MockXhr.newMockXhr();
      assert.notEqual(LocalMockXhr1, LocalMockXhr2);
    });

    it('should isolate MockXMLHttpRequest.onCreate()', function() {
      var LocalMockXhr1 = MockXhr.newMockXhr();
      var onCreate1Called = false;
      LocalMockXhr1.onCreate = function() {
        onCreate1Called = true;
      };

      var LocalMockXhr2 = MockXhr.newMockXhr();
      var onCreate2Called = false;
      LocalMockXhr2.onCreate = function() {
        onCreate2Called = true;
      };

      new LocalMockXhr2();

      assert.isNotOk(onCreate1Called, 'onCreate() from first mock not called');
      assert.isOk(onCreate2Called, 'onCreate() from second mock called');
    });

    it('should isolate MockXMLHttpRequest.onSend()', function(done) {
      var xhr;
      var onSend1Called = false;

      var LocalMockXhr1 = MockXhr.newMockXhr();
      LocalMockXhr1.onSend = function() {
        onSend1Called = true;
        assert.isNotOk(onSend1Called, 'onCreate() from first mock not called');
      };

      var LocalMockXhr2 = MockXhr.newMockXhr();
      LocalMockXhr2.onSend = function() {
        // Wait for the callstack to clear before asserting that the other
        // hook is not called.
        setTimeout(function() {
          assert.isNotOk(onSend1Called, 'onCreate() from first mock not called');
          done();
        }, 0);
      };

      xhr = new LocalMockXhr2();
      xhr.open('GET', '/url');
      xhr.send();
    });
  });

  describe('Hooks', function() {
    it('should call global and local onCreate()', function() {
      try {
        var onCreateCalled = false;
        MockXhr.onCreate = function() {
          onCreateCalled = true;
        };

        var LocalMockXhr = MockXhr.newMockXhr();
        var onCreateLocalCalled = false;
        LocalMockXhr.onCreate = function() {
          onCreateLocalCalled = true;
        };

        new LocalMockXhr();

        assert.isOk(onCreateCalled, 'global onCreate() called');
        assert.isOk(onCreateLocalCalled, 'local onCreate() called');
      } finally {
        delete MockXhr.onCreate;
      }
    });

    it('should call global and local onSend()', function(done) {
      try {
        var xhr;
        var onSendCalled = false;
        var onSendLocalCalled = false;

        // Add a "global" onSend callback
        MockXhr.onSend = function(arg) {
          assert.equal(this, xhr, 'context');
          assert.equal(arg, xhr, 'argument');
          onSendCalled = true;
          if (onSendCalled && onSendLocalCalled)
          {
            done();
          }
        };

        // Add a "local" onSend callback
        var LocalMockXhr = MockXhr.newMockXhr();
        LocalMockXhr.onSend = function(arg) {
          assert.equal(this, xhr, 'context');
          assert.equal(arg, xhr, 'argument');
          onSendLocalCalled = true;
          if (onSendCalled && onSendLocalCalled)
          {
            done();
          }
        };

        xhr = new LocalMockXhr();
        xhr.open('GET', '/url');
        xhr.send();
      } finally {
        delete MockXhr.onSend;
      }
    });

    it('should call xhr.onSend() method', function(done) {
      var LocalMockXhr = MockXhr.newMockXhr();
      var xhr = new LocalMockXhr();

      // Add a request-local onSend callback
      xhr.onSend = function(arg) {
        assert.equal(this, xhr, 'context');
        assert.equal(arg, xhr, 'argument');
        done();
      };
      xhr.open('GET', '/url');
      xhr.send();
    });

    it('should call global onSend(), local onSend() and xhr.onSend()', function(done) {
      try {
        var xhr;
        var onSendCalled = false;
        var onSendLocalCalled = false;
        var onSendXhrCalled = false;

        // Add a "global" onSend callback
        MockXhr.onSend = function(arg) {
          assert.equal(this, xhr, 'context');
          assert.equal(arg, xhr, 'argument');
          onSendCalled = true;
          if (onSendCalled && onSendLocalCalled && onSendXhrCalled)
          {
            done();
          }
        };

        var LocalMockXhr = MockXhr.newMockXhr();
        LocalMockXhr.onSend = function(arg) {
          assert.equal(this, xhr, 'context');
          assert.equal(arg, xhr, 'argument');
          onSendLocalCalled = true;
          if (onSendCalled && onSendLocalCalled && onSendXhrCalled)
          {
            done();
          }
        };

        xhr = new LocalMockXhr();

        // Add a request-local onSend callback
        xhr.onSend = function(arg) {
          assert.equal(this, xhr, 'context');
          assert.equal(arg, xhr, 'argument');
          onSendXhrCalled = true;
          if (onSendCalled && onSendLocalCalled && onSendXhrCalled)
          {
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
