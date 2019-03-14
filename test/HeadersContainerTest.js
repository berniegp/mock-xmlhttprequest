'use strict';

const { assert } = require('chai');

const HeadersContainer = require('../src/HeadersContainer');

describe('HeadersContainer', () => {
  describe('constructor', () => {
    it('should store headers', () => {
      const headers = new HeadersContainer({
        header: '1',
      });
      assert.equal(headers.getHeader('header'), '1');
    });

    it('should store and combine headers', () => {
      const headers = new HeadersContainer({
        header: '1',
        HEADER: '1',
      });
      assert.equal(headers.getHeader('header'), '1, 1');
    });
  });

  it('should store headers', () => {
    const headers = new HeadersContainer();
    headers.addHeader('header', '1');
    assert.equal(headers.getHeader('header'), '1');
  });

  it('should return null for inexistant headers', () => {
    const headers = new HeadersContainer();
    assert.equal(headers.getHeader('not-exists'), null);
  });

  it('headers should be case-insensitive', () => {
    const headers = new HeadersContainer();
    headers.addHeader('header', '1');
    assert.equal(headers.getHeader('HEADER'), '1');
    assert.equal(headers.getHeader('Header'), '1');
    assert.equal(headers.getHeader('header'), '1');
  });

  it('should combine header vales', () => {
    const headers = new HeadersContainer();
    headers.addHeader('header', '1');
    headers.addHeader('HEADER', '2');
    assert.equal(headers.getHeader('header'), '1, 2');
  });

  describe('getAll()', () => {
    it('should concatenate all headers with proper formatting', () => {
      const headers = new HeadersContainer();
      headers.addHeader('HEADER', '1');
      headers.addHeader('header-2', 'a');
      assert.equal(headers.getAll(), 'header: 1\r\nheader-2: a\r\n');
    });

    it('should combine headers', () => {
      const headers = new HeadersContainer();
      headers.addHeader('header', '1');
      headers.addHeader('header', '2');
      headers.addHeader('header', '3');
      assert.equal(headers.getAll(), 'header: 1, 2, 3\r\n');
    });

    it('should sort headers', () => {
      const headers = new HeadersContainer();
      headers.addHeader('header-2', 'b');
      headers.addHeader('header-3', 'c');
      headers.addHeader('header-1', 'a');
      assert.equal(headers.getAll(), 'header-1: a\r\nheader-2: b\r\nheader-3: c\r\n');
    });
  });

  describe('getHash()', () => {
    it('should return all headers with proper formatting', () => {
      const headers = new HeadersContainer();
      headers.addHeader('HEADER', '1');
      headers.addHeader('header-2', 'a');
      assert.deepEqual(headers.getHash(), {
        header: '1',
        'header-2': 'a',
      });
    });

    it('should combine headers', () => {
      const headers = new HeadersContainer();
      headers.addHeader('header', '1');
      headers.addHeader('header', '2');
      headers.addHeader('header', '3');
      assert.deepEqual(headers.getHash(), {
        header: '1, 2, 3',
      });
    });
  });
});
