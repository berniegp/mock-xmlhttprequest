import { assert } from 'chai';

import XhrEventTarget from '../src/XhrEventTarget';
import { XHR_PROGRESS_EVENT_NAMES } from '../src/XhrProgressEventsNames';

describe('EventTarget', () => {
  describe('addEventListener()', () => {
    it('should ignore duplicate listeners', () => {
      const eventTarget = new XhrEventTarget();
      const eventName = XHR_PROGRESS_EVENT_NAMES[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback);
      eventTarget.addEventListener(eventName, callback);

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 1, 'listener called once');
    });

    it('should ignore duplicate listeners with same capture/useCapture flag', () => {
      const eventTarget = new XhrEventTarget();
      const eventName = XHR_PROGRESS_EVENT_NAMES[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback, true);
      eventTarget.addEventListener(eventName, callback, { capture: true });

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 1, 'listener called once');
    });

    it('should not consider listeners with different capture/useCapture flag as duplicates', () => {
      const eventTarget = new XhrEventTarget();
      const eventName = XHR_PROGRESS_EVENT_NAMES[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback, true);
      eventTarget.addEventListener(eventName, callback /* , false */);

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 2, 'listener called twice');
    });

    it('should respect the once flag', () => {
      const eventTarget = new XhrEventTarget();
      const eventName = XHR_PROGRESS_EVENT_NAMES[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback, { once: true });

      eventTarget.dispatchEvent(event);
      eventTarget.dispatchEvent(event);

      assert.strictEqual(callCount, 1, 'listener called once');
    });

    it('should respect the once flag when readded as listener in callback', () => {
      const eventTarget = new XhrEventTarget();
      const eventName = XHR_PROGRESS_EVENT_NAMES[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() {
        if (callCount === 0) {
          eventTarget.addEventListener(eventName, callback, { once: true });
        }
        callCount += 1;
      }
      eventTarget.addEventListener(eventName, callback, { once: true });

      eventTarget.dispatchEvent(event);
      eventTarget.dispatchEvent(event);
      eventTarget.dispatchEvent(event);

      assert.strictEqual(callCount, 2, 'listener called twice');
    });
  });

  describe('removeEventListener()', () => {
    it('should remove a listener', () => {
      const eventTarget = new XhrEventTarget();
      const eventName = XHR_PROGRESS_EVENT_NAMES[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback);
      eventTarget.removeEventListener(eventName, callback);

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 0, 'listener not called');
    });

    it('should consider the capture/useCapture flag', () => {
      const eventTarget = new XhrEventTarget();
      const eventName = XHR_PROGRESS_EVENT_NAMES[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback, true);
      eventTarget.removeEventListener(eventName, callback);

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 1, 'listener called twice');
    });
  });

  describe('dispatchEvent()', () => {
    XHR_PROGRESS_EVENT_NAMES.forEach((eventName) => {
      it(`should support the XMLHttpRequest event ${eventName}`, () => {
        const eventTarget = new XhrEventTarget();
        const event = { type: eventName };

        let propertyHandlerCount = 0;
        eventTarget[`on${eventName}`] = function onEventListener(e) {
          propertyHandlerCount += 1;
          assert.strictEqual(this, eventTarget as any);
          assert.strictEqual(e, event as any, 'event parameter');
        };
        let listenerCount = 0;
        eventTarget.addEventListener(eventName, function propertyEventListener(e) {
          listenerCount += 1;
          assert.strictEqual(this, eventTarget);
          assert.strictEqual(e, event as any, 'event parameter');
        });

        eventTarget.dispatchEvent(event);
        assert.strictEqual(propertyHandlerCount, 1, 'propertyHandlerCalled');
        assert.strictEqual(listenerCount, 1, 'listenerCalled');
      });
    });

    it('should not call listeners added in callback', () => {
      const eventTarget = new XhrEventTarget();

      eventTarget.onerror = () => {
        eventTarget.addEventListener('error', () => {
          assert.fail('listened added in callback should not be called');
        });
      };
      eventTarget.dispatchEvent({ type: 'error' });
    });

    it('should call handleEvent() method on listener', () => {
      const eventTarget = new XhrEventTarget();
      let callCount = 0;
      eventTarget.addEventListener('error', { handleEvent: () => { callCount += 1; } });
      eventTarget.dispatchEvent({ type: 'error' });
      assert.strictEqual(callCount, 1, 'handleEvent() called');
    });

    it('should use custom context as "this" for upload events', () => {
      const context = new XhrEventTarget();
      const eventTarget = new XhrEventTarget(context);
      eventTarget.onprogress = function listener() {
        assert.strictEqual(this, context as any, 'custom context');
      };
      eventTarget.dispatchEvent({ type: 'progress' });
    });
  });

  it('hasListeners()', () => {
    const eventTarget = new XhrEventTarget();
    assert.isFalse(eventTarget.hasListeners());
    eventTarget.onerror = () => {};
    assert.isTrue(eventTarget.hasListeners());
    eventTarget.onerror = null;
    assert.isFalse(eventTarget.hasListeners());
    eventTarget.addEventListener('error', () => {});
    assert.isTrue(eventTarget.hasListeners());
  });
});
