'use strict';

const { assert } = require('chai');

const HeadersContainer = require('../src/HeadersContainer');
const MockXhrServer = require('../src/MockXhrServer');

describe('MockXhrServer', () => {
  // Bare minimum xhrMock to give to MockXhrServer
  class ServerTester {
    constructor() {
      this.responses = [];
    }

    doRequest(method, url, headers = {}, body = null) {
      this.method = method;
      this.url = url;
      this.requestHeaders = new HeadersContainer(headers);
      this.body = body;
      this.onSend(this);
    }

    respond(status, headers, body, statusText) {
      this.responses.push({
        status,
        headers,
        body,
        statusText,
      });
    }
  }

  describe('constructor', () => {
    it('should add routes', () => {
      const tester = new ServerTester();
      // eslint-disable-next-line no-unused-vars
      const server = new MockXhrServer(tester, {
        get: ['/get', { status: 200 }],
        'my-method': ['/my-method', { status: 201 }],
        post: ['/post', { status: 404 }],
      });

      tester.doRequest('get', '/get');
      tester.doRequest('my-method', '/my-method');
      tester.doRequest('post', '/post');

      assert.equal(tester.responses.length, 3, 'handlers called');
      assert.equal(tester.responses[0].status, 200);
      assert.equal(tester.responses[1].status, 201);
      assert.equal(tester.responses[2].status, 404);
    });
  });

  describe('install() and remove()', () => {
    it('should set and restore XMLHttpRequest on default global context', () => {
      const xhrMock = {};

      const server = new MockXhrServer(xhrMock).install();
      assert.equal(global.XMLHttpRequest, xhrMock, 'XMLHttpRequest property replaced');

      server.remove();
      assert.isUndefined(global.XMLHttpRequest, 'XMLHttpRequest property deleted');
    });

    it('should set and restore XMLHttpRequest on given context', () => {
      const context = { XMLHttpRequest: 1 };
      const xhrMock = {};

      const server = new MockXhrServer(xhrMock).install(context);
      assert.equal(context.XMLHttpRequest, xhrMock, 'XMLHttpRequest property replaced');

      server.remove();
      assert.equal(context.XMLHttpRequest, 1, 'XMLHttpRequest property restored');
    });

    it('should set and delete XMLHttpRequest on custom context', () => {
      const context = {};
      const xhrMock = {};

      const server = new MockXhrServer(xhrMock).install(context);
      assert.equal(context.XMLHttpRequest, xhrMock, 'XMLHttpRequest property replaced');

      server.remove();
      assert.isUndefined(context.XMLHttpRequest, 'XMLHttpRequest property deleted');
    });

    it('should throw if remove() is called without install()', () => {
      const server = new MockXhrServer({});
      assert.throw(() => { server.remove(); });
    });

    it('should throw if remove() is called twice', () => {
      const server = new MockXhrServer({});
      server.install({});
      server.remove();
      assert.throw(() => { new MockXhrServer({}).remove(); });
    });
  });

  describe('addHandler()', () => {
    it('should support response hash as handler', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.addHandler('method', '/path', response);
      tester.doRequest('method', '/path');

      assert.equal(tester.responses.length, 1, 'handler called');
      assert.deepEqual(tester.responses[0], response);
    });

    it('should support callback as handler', (done) => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);

      server.addHandler('method', '/path', (xhr) => {
        assert.equal(xhr, tester, 'request argument');
        done();
      });
      tester.doRequest('method', '/path');
    });

    it('should support callback as url matcher', (done) => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);

      const matcher = url => url.includes('object');
      server.addHandler('method', matcher, () => {
        done();
      });
      tester.doRequest('method', '/my/object/somewhere');
    });

    it('should support regex as url matcher', (done) => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);

      server.addHandler('method', /.*\/object\/.*/i, () => {
        done();
      });
      tester.doRequest('method', '/my/object/somewhere');
    });

    it('should support array of handlers', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };
      const handler = (xhr) => {
        xhr.respond(404);
      };

      server.addHandler('method', '/path', [response, handler, response]);
      tester.doRequest('method', '/path');
      tester.doRequest('method', '/path');
      tester.doRequest('method', '/path');
      tester.doRequest('method', '/path');

      assert.equal(tester.responses.length, 4, 'handler called');
      assert.deepEqual(tester.responses[0], response);
      assert.equal(tester.responses[1].status, 404);
      assert.deepEqual(tester.responses[2], response);
      assert.deepEqual(tester.responses[3], response);
    });

    it('should normalize method names as per the XMLHttpRequest spec', (done) => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);

      server.addHandler('get', '/path', () => {
        done();
      });
      tester.doRequest('GET', '/path');
    });

    it('should pick first matched handler', (done) => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);

      server.addHandler('method', '/path', () => {
        done();
      });
      server.addHandler('method', '/path', () => {
        assert.isNotOk(true, 'Second handler called.');
      });
      tester.doRequest('method', '/path');
    });

    it('should coexist with routes given in the constructor', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester, {
        get: ['/get', { status: 200 }],
      });
      server.addHandler('method', '/path', (xhr) => {
        xhr.respond(404);
      });

      tester.doRequest('GET', '/get');
      tester.doRequest('method', '/path');

      assert.equal(tester.responses.length, 2, 'handlers called');
      assert.equal(tester.responses[0].status, 200);
      assert.equal(tester.responses[1].status, 404);
    });
  });

  describe('convenience methods', () => {
    it('should support get()', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);
      const status = 200;

      server.get('/path', { status });
      tester.doRequest('get', '/path');

      assert.equal(tester.responses.length, 1, 'handler called');
      assert.equal(tester.responses[0].status, status);
    });

    it('should support post()', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);
      const status = 200;

      server.post('/path', { status });
      tester.doRequest('post', '/path');

      assert.equal(tester.responses.length, 1, 'handler called');
      assert.equal(tester.responses[0].status, status);
    });

    it('should support put()', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);
      const status = 200;

      server.put('/path', { status });
      tester.doRequest('put', '/path');

      assert.equal(tester.responses.length, 1, 'handler called');
      assert.equal(tester.responses[0].status, status);
    });

    it('should support delete()', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);
      const status = 200;

      server.delete('/path', { status });
      tester.doRequest('delete', '/path');

      assert.equal(tester.responses.length, 1, 'handler called');
      assert.equal(tester.responses[0].status, status);
    });
  });

  describe('setDefaultHandler()', () => {
    it('should support response hash as handler', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };

      server.setDefaultHandler(response);
      tester.doRequest('method', '/path');

      assert.equal(tester.responses.length, 1, 'handler called');
      assert.deepEqual(tester.responses[0], response);
    });

    it('should support callback as handler', (done) => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);

      server.setDefaultHandler((xhr) => {
        assert.equal(xhr, tester, 'request argument');
        done();
      });
      tester.doRequest('method', '/path');
    });

    it('should support array of handlers', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);
      const response = {
        status: 200,
        headers: { header: '123' },
        body: 'some body',
        statusText: 'Status Text',
      };
      const handler = (xhr) => {
        xhr.respond(404);
      };

      server.setDefaultHandler([response, handler, response]);
      tester.doRequest('method', '/path');
      tester.doRequest('method', '/path');
      tester.doRequest('method', '/path');
      tester.doRequest('method', '/path');

      assert.equal(tester.responses.length, 4, 'handler called');
      assert.deepEqual(tester.responses[0], response);
      assert.equal(tester.responses[1].status, 404);
      assert.deepEqual(tester.responses[2], response);
      assert.deepEqual(tester.responses[3], response);
    });

    it('should have lowest precedence', (done) => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);

      server.addHandler('method', '/path', () => {
        done();
      });
      server.setDefaultHandler(() => {
        assert.isNotOk(true, 'Default handler called.');
      });
      tester.doRequest('method', '/path');
    });
  });

  describe('setDefault404()', () => {
    it('should return 404 for unmatched requests', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);

      server.setDefault404();
      tester.doRequest('method', '/path');

      assert.equal(tester.responses.length, 1, 'handler called');
      assert.deepEqual(tester.responses[0].status, 404);
    });
  });

  describe('getRequestLog()', () => {
    it('should return all received requests', () => {
      const tester = new ServerTester();
      const server = new MockXhrServer(tester);
      const handler = (xhr) => {
        xhr.respond(404);
      };
      server.addHandler('method', '/path', handler);
      tester.doRequest('method', '/path1');
      tester.doRequest('get', '/path2');
      tester.doRequest('POST', '/post', { header: '123' }, 'body');

      const log = server.getRequestLog();
      assert.equal(log.length, 3, 'handler called');
      assert.deepEqual(log[0], {
        method: 'method', url: '/path1', headers: {}, body: null,
      });
      assert.deepEqual(log[1], {
        method: 'get', url: '/path2', headers: {}, body: null,
      });
      assert.deepEqual(log[2], {
        method: 'POST', url: '/post', headers: { header: '123' }, body: 'body',
      });
    });
  });
});
