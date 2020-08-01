import { assert } from 'chai';

import { getBodyByteSize } from '../src/Utils';

class BlobMock {
  constructor(size) { this.size = size; }
}

class BufferSourceMock {
  constructor(size) { this.byteLength = size; }
}

// Since the browser's FormData is unavailable, we use constructor function name matching in a
// Node.js environment which is why this class doesn't have the Mock suffix.
class FormData {
  constructor() {
    this._values = [];
  }

  append(name, value) {
    this._values.push(value);
  }

  values() {
    return this._values.values();
  }
}

describe('Utils', () => {
  describe('getBodyByteSize', () => {
    it('should return 0 for empty body', () => {
      assert.equal(getBodyByteSize(), 0);
      assert.equal(getBodyByteSize(null), 0);
    });

    it('should return string byte length', () => {
      assert.equal(getBodyByteSize('abcd'), 4, 'single code unit characters');
      assert.equal(getBodyByteSize('😂👍'), 8, 'multi code unit characters');
      assert.equal(getBodyByteSize('a😂b👍c'), 11, 'mixed code unit characters');
    });

    it('should return Blob byte size', () => {
      const blob = new BlobMock(10);
      assert.equal(getBodyByteSize(blob), 10);
    });

    it('should return BufferSource byte size', () => {
      const bufferSource = new BufferSourceMock(10);
      assert.equal(getBodyByteSize(bufferSource), 10);
    });

    it('should return FormData byte size', () => {
      const form = new FormData();
      form.append('my_field', 'abcd');
      form.append('my_emojis', '😂👍');
      form.append('my_blob', new BlobMock(10));
      assert.equal(getBodyByteSize(form), 4 + 8 + 10);
    });
  });
});
