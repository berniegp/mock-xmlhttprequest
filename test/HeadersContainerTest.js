var assert = require('chai').assert;

var HeadersContainer = require('../src/HeadersContainer');

describe('HeadersContainer', function() {
  it('should store headers', function() {
    var headers = new HeadersContainer();
    headers.addHeader('header', '1');
    assert.equal(headers.getHeader('header'), '1');
  });

  it('should return null for inexistant headers', function() {
    var headers = new HeadersContainer();
    assert.equal(headers.getHeader('not-exists'), null);
  });

  it('headers should be case-insensitive', function() {
    var headers = new HeadersContainer();
    headers.addHeader('header', '1');
    assert.equal(headers.getHeader('HEADER'), '1');
    assert.equal(headers.getHeader('Header'), '1');
    assert.equal(headers.getHeader('header'), '1');
  });

  it('should combine header vales', function() {
    var headers = new HeadersContainer();
    headers.addHeader('header', '1');
    headers.addHeader('HEADER', '2');
    assert.equal(headers.getHeader('header'), '1, 2');
  });

  it('getAll() should concatenate all headers with proper formatting', function() {
    var headers = new HeadersContainer();
    headers.addHeader('HEADER', '1');
    headers.addHeader('header-2', 'a');
    assert.equal(headers.getAll(), 'header: 1\r\nheader-2: a\r\n');
  });

  it('getAll() should combine headers', function() {
    var headers = new HeadersContainer();
    headers.addHeader('header', '1');
    headers.addHeader('header', '2');
    headers.addHeader('header', '3');
    assert.equal(headers.getAll(), 'header: 1, 2, 3\r\n');
  });

  it('getAll() should sort headers', function() {
    var headers = new HeadersContainer();
    headers.addHeader('header-2', 'b');
    headers.addHeader('header-3', 'c');
    headers.addHeader('header-1', 'a');
    assert.equal(headers.getAll(), 'header-1: a\r\nheader-2: b\r\nheader-3: c\r\n');
  });
});
