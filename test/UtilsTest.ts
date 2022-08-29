import { assert } from 'chai';

import * as Utils from '../src/Utils';

class BlobMock {
  constructor(array: any[]) {
    assert.isArray(array);
  }

  static testSize = 0;

  get size() { return BlobMock.testSize; }
}

class FormDataMock {
  private _values: any[];

  constructor() {
    this._values = [];
  }

  append(name: any, value: any) {
    this._values.push(value);
  }

  values() {
    return this._values.values();
  }
}

describe('Utils', () => {
  describe('getBodyByteSize', () => {
    it('should return 0 for empty body', () => {
      assert.strictEqual(Utils.getBodyByteSize(), 0);
      assert.strictEqual(Utils.getBodyByteSize(null), 0);
    });

    it('should return string byte length using Blob', () => {
      // The Blob code path of getBodyByteSize() requires Blob in the global context.
      const savedBlob = globalThis.Blob;
      globalThis.Blob = BlobMock as unknown as typeof globalThis.Blob;
      try {
        // Doesn't match the string size below on purpose to validate that the Blob mock is used
        BlobMock.testSize = 10;
        assert.strictEqual(Utils.getBodyByteSize('abcd'), 10, 'uses the Blob size');
      } finally {
        globalThis.Blob = savedBlob;
      }
    });

    it('should return string byte length using Buffer', () => {
      assert.strictEqual(Utils.getBodyByteSize('abcd'), 4, 'single code unit characters');
      assert.strictEqual(Utils.getBodyByteSize('😂👍'), 8, 'multi code unit characters');
      assert.strictEqual(Utils.getBodyByteSize('a😂b👍c'), 11, 'mixed code unit characters');
    });

    it('should return Blob byte size', () => {
      // Doesn't match the string size below on purpose to validate that the Blob mock is used
      BlobMock.testSize = 10;
      const blob = new BlobMock(['abcd']);
      assert.strictEqual(Utils.getBodyByteSize(blob as Blob), 10);
    });

    it('should return BufferSource byte size', () => {
      const bufferSource = new ArrayBuffer(10);
      assert.strictEqual(Utils.getBodyByteSize(bufferSource), 10);
    });

    it('should return FormData byte size', () => {
      // The FormData code path of getBodyByteSize() requires FormData in the global context.
      const savedFormData = globalThis.FormData;
      globalThis.FormData = FormDataMock as unknown as typeof globalThis.FormData;
      try {
        const form = new FormDataMock();
        form.append('my_field', 'abcd');
        form.append('my_emojis', '😂👍');

        // Doesn't match the string size below on purpose to validate that the Blob mock is used
        BlobMock.testSize = 10;
        form.append('my_blob', new BlobMock(['abcd']));
        assert.strictEqual(Utils.getBodyByteSize(form as unknown as FormData), 4 + 8 + 10);
      } finally {
        globalThis.FormData = savedFormData;
      }
    });
  });

  describe('isHeaderName', () => {
    ['Content-Length', 'CONNECT', 'MyMethod', '!#$%&\'*+-.^_`|~'].forEach((method) => {
      it(`accepts '${method}' as a header name`, () => {
        assert.isTrue(Utils.isHeaderName(method));
      });
    });

    it('rejects invalid header names', () => {
      assert.isFalse(Utils.isHeaderName('\\'));
      assert.isFalse(Utils.isHeaderName(';'));
    });
  });

  describe('isHeaderValue', () => {
    ['value', '', 'gzip , chunked', 'abrowser/0.001 (C O M M E N T)', '", , ,"'].forEach((method) => {
      it(`accepts '${method}' as a header value`, () => {
        assert.isTrue(Utils.isHeaderValue(method));
      });
    });

    it('rejects invalid header values', () => {
      assert.isFalse(Utils.isHeaderValue(' with leading space'));
      assert.isFalse(Utils.isHeaderValue('with trailing space '));
      assert.isFalse(Utils.isHeaderValue('with null (\0) char'));
    });
  });

  describe('isRequestMethodForbidden', () => {
    ['CONNECT', 'TRACE', 'TRACK'].forEach((method) => {
      it(`forbids '${method}'`, () => {
        assert.isTrue(Utils.isRequestMethodForbidden(method));
        assert.isTrue(Utils.isRequestMethodForbidden(method.toLowerCase()));
      });
    });

    it('accepts valid methods', () => {
      assert.isFalse(Utils.isRequestMethodForbidden('MyMethod'));
    });
  });

  describe('isRequestMethod', () => {
    ['get', 'CONNECT', 'MyMethod', '!#$%&\'*+-.^_`|~'].forEach((method) => {
      it(`accepts '${method}' as a method`, () => {
        assert.isTrue(Utils.isRequestMethod(method));
      });
    });

    it('rejects invalid methods', () => {
      assert.isFalse(Utils.isRequestMethod('\\'));
      assert.isFalse(Utils.isRequestMethod(';'));
    });
  });

  describe('normalizeHTTPMethodName', () => {
    Utils.upperCaseMethods.forEach((method) => {
      it(`makes '${method}' upper case`, () => {
        assert.strictEqual(Utils.normalizeHTTPMethodName(method.toLowerCase()), method);
      });
    });

    it('doesn\'t modify other methods', () => {
      assert.strictEqual(Utils.normalizeHTTPMethodName('MyMethod'), 'MyMethod');
    });
  });

  describe('isRequestHeaderForbidden', () => {
    ['Content-Length', 'proxy-123', 'sec-234'].forEach((header) => {
      it(`forbids '${header}'`, () => {
        assert.isTrue(Utils.isRequestHeaderForbidden(header));
        assert.isTrue(Utils.isRequestHeaderForbidden(header.toUpperCase()));
        assert.isTrue(Utils.isRequestHeaderForbidden(header.toLowerCase()));
      });
    });

    it('accepts valid headers', () => {
      assert.isFalse(Utils.isRequestMethodForbidden('My-Header'));
      assert.isFalse(Utils.isRequestMethodForbidden('My-Proxy-123'));
    });
  });

  describe('getStatusText', () => {
    it('returns status text', () => {
      assert.strictEqual(Utils.getStatusText(501), 'Not Implemented');
    });

    it('returns default status if unknown', () => {
      assert.strictEqual(Utils.getStatusText(1234), 'Unknown Status');
    });
  });
});
