var assert = require('chai').assert;

var HeadersContainer = require('../src/HeadersContainer');

describe('HeadersContainer', function() {
  it('should store headers', function() {
    var headers = new HeadersContainer();
    headers.addHeader('Head', '1');
    assert.equal(headers.getHeader('Head'), '1');
  });

  it('should return null for inexistant headers', function() {
    var headers = new HeadersContainer();
    assert.equal(headers.getHeader('not-exists'), null);
  });

  it('headers should be case-insensitive', function() {
    var headers = new HeadersContainer();
    headers.addHeader('Head', '1');
    assert.equal(headers.getHeader('HEAD'), '1');
  });

  it('should combine header vales', function() {
    var headers = new HeadersContainer();
    headers.addHeader('Head', '1');
    headers.addHeader('Head', '2');
    assert.equal(headers.getHeader('Head'), '1, 2');
  });

  it('getAll() should concatenate all headers', function() {
    var headers = new HeadersContainer();
    headers.addHeader('Head', '1');
    headers.addHeader('Head-2', 'a');
    assert.equal(headers.getAll(), 'Head: 1\r\nHead-2: a');
  });
});
