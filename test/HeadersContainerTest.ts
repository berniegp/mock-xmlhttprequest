import { assert } from 'chai';

import HeadersContainer from '../src/HeadersContainer';

describe('HeadersContainer', () => {
  describe('constructor', () => {
    it('should store headers', () => {
      const headers = new HeadersContainer({
        header: '1',
      });
      assert.strictEqual(headers.getHeader('header'), '1');
    });

    it('should store and combine headers', () => {
      const headers = new HeadersContainer({
        header: '1',
        HEADER: '1',
      });
      assert.strictEqual(headers.getHeader('header'), '1, 1');
    });
  });

  it('should store headers', () => {
    const headers = new HeadersContainer();
    headers.addHeader('header', '1');
    assert.strictEqual(headers.getHeader('header'), '1');
  });

  it('should return null for inexistant headers', () => {
    const headers = new HeadersContainer();
    assert.strictEqual(headers.getHeader('not-exists'), null);
  });

  it('headers should be case-insensitive', () => {
    const headers = new HeadersContainer();
    headers.addHeader('header', '1');
    assert.strictEqual(headers.getHeader('HEADER'), '1');
    assert.strictEqual(headers.getHeader('Header'), '1');
    assert.strictEqual(headers.getHeader('header'), '1');
  });

  it('should combine header vales', () => {
    const headers = new HeadersContainer();
    headers.addHeader('header', '1');
    headers.addHeader('HEADER', '2');
    assert.strictEqual(headers.getHeader('header'), '1, 2');
  });

  describe('getAll()', () => {
    it('should concatenate all headers with proper formatting', () => {
      const headers = new HeadersContainer();
      headers.addHeader('HEADER', '1');
      headers.addHeader('header-2', 'a');
      assert.strictEqual(headers.getAll(), 'header: 1\r\nheader-2: a\r\n');
    });

    it('should combine headers', () => {
      const headers = new HeadersContainer();
      headers.addHeader('header', '1');
      headers.addHeader('header', '2');
      headers.addHeader('header', '3');
      assert.strictEqual(headers.getAll(), 'header: 1, 2, 3\r\n');
    });

    it('should sort headers', () => {
      const headers = new HeadersContainer();

      // Values taken from https://phabricator.services.mozilla.com/D31786 referenced in commit
      // https://github.com/whatwg/xhr/commit/985f2f7a6de02dce42e157e02e9bb540d2750edc
      headers.addHeader('foo-TEST', '1');
      headers.addHeader('FOO-test', '2');
      headers.addHeader('__Custom', 'token');
      headers.addHeader('ALSO-here', 'Mr. PB');
      headers.addHeader('ewok', 'lego');
      assert.strictEqual(headers.getAll(), 'also-here: Mr. PB\r\newok: lego\r\nfoo-test: 1, 2\r\n__custom: token\r\n');
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
