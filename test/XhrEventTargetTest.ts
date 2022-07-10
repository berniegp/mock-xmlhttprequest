import { assert } from 'chai';

import XhrEventTarget from '../src/XhrEventTarget';
import { XHR_PROGRESS_EVENT_NAMES } from '../src/XhrProgressEventsNames';

describe('EventTarget', () => {
  describe('addEventListener()', () => {
    it('should ignore duplicate listeners', () => {
      const eventTarget = new XhrEventTarget();
      const event = { type: XHR_PROGRESS_EVENT_NAMES[0] };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(event.type, callback);
      eventTarget.addEventListener(event.type, callback);

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 1, 'listener called once');
    });

    it('should ignore duplicate listeners with same capture/useCapture flag', () => {
      const eventTarget = new XhrEventTarget();
      const event = { type: XHR_PROGRESS_EVENT_NAMES[0] };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(event.type, callback, true);
      eventTarget.addEventListener(event.type, callback, { capture: true });

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 1, 'listener called once');
    });

    it('should not consider listeners with different capture/useCapture flag as duplicates', () => {
      const eventTarget = new XhrEventTarget();
      const event = { type: XHR_PROGRESS_EVENT_NAMES[0] };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(event.type, callback, true);
      eventTarget.addEventListener(event.type, callback /* , false */);

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 2, 'listener called twice');
    });

    it('should respect the once flag', () => {
      const eventTarget = new XhrEventTarget();
      const event = { type: XHR_PROGRESS_EVENT_NAMES[0] };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(event.type, callback, { once: true });

      eventTarget.dispatchEvent(event);
      eventTarget.dispatchEvent(event);

      assert.strictEqual(callCount, 1, 'listener called once');
    });

    it('should respect the once flag when readded as listener in callback', () => {
      const eventTarget = new XhrEventTarget();
      const event = { type: XHR_PROGRESS_EVENT_NAMES[0] };

      let callCount = 0;
      function callback() {
        if (callCount === 0) {
          eventTarget.addEventListener(event.type, callback, { once: true });
        }
        callCount += 1;
      }
      eventTarget.addEventListener(event.type, callback, { once: true });

      eventTarget.dispatchEvent(event);
      eventTarget.dispatchEvent(event);
      eventTarget.dispatchEvent(event);

      assert.strictEqual(callCount, 2, 'listener called twice');
    });
  });

  describe('removeEventListener()', () => {
    it('should remove a listener', () => {
      const eventTarget = new XhrEventTarget();
      const event = { type: XHR_PROGRESS_EVENT_NAMES[0] };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(event.type, callback);
      eventTarget.removeEventListener(event.type, callback);

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 0, 'listener not called');
    });

    it('should consider the capture/useCapture flag', () => {
      const eventTarget = new XhrEventTarget();
      const event = { type: XHR_PROGRESS_EVENT_NAMES[0] };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(event.type, callback, true);
      eventTarget.removeEventListener(event.type, callback);

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 1, 'listener called');
    });
  });

  describe('dispatchEvent()', () => {
    XHR_PROGRESS_EVENT_NAMES.forEach((eventName) => {
      it(`should support the XMLHttpRequest event ${eventName}`, () => {
        const eventTarget = new XhrEventTarget();
        const event = { type: eventName };

        let propertyHandlerCount = 0;
        eventTarget[`on${event.type}`] = function onEventListener(e) {
          propertyHandlerCount += 1;
          assert.strictEqual(this, eventTarget as any);
          assert.strictEqual(e, event as any, 'event parameter');
        };
        let listenerCount = 0;
        eventTarget.addEventListener(event.type, function propertyEventListener(e) {
          listenerCount += 1;
          assert.strictEqual(this, eventTarget);
          assert.strictEqual(e, event as any, 'event parameter');
        });

        eventTarget.dispatchEvent(event);
        assert.strictEqual(propertyHandlerCount, 1, 'propertyHandlerCalled');
        assert.strictEqual(listenerCount, 1, 'listenerCalled');
      });
    });

    it('should not call listeners added in dispatchEvent() listeners', () => {
      const eventTarget = new XhrEventTarget();
      const event = { type: 'error' };

      eventTarget.onerror = () => {
        eventTarget.addEventListener(event.type, () => {
          assert.fail('listener added in callback should not be called');
        });
      };
      eventTarget.dispatchEvent(event);
    });

    it('should call handleEvent() method on listener', () => {
      const eventTarget = new XhrEventTarget();
      const event = { type: 'error' };

      let callCount = 0;
      eventTarget.addEventListener(event.type, {
        handleEvent: (e) => {
          callCount += 1;
          assert.strictEqual(e, event, 'event parameter');
        },
      });

      eventTarget.dispatchEvent(event);
      assert.strictEqual(callCount, 1, 'handleEvent() called');
    });

    it('should use custom context as "this" for events', () => {
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
