import { assert } from 'chai';

import EventTarget from '../src/EventTarget';

describe('EventTarget', () => {
  const xhrEvents = [
    'loadstart',
    'progress',
    'abort',
    'error',
    'load',
    'timeout',
    'loadend',
  ];

  describe('addEventListener()', () => {
    it('should ignore duplicate listeners', () => {
      const eventTarget = new EventTarget();
      const eventName = xhrEvents[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback);
      eventTarget.addEventListener(eventName, callback);

      eventTarget.dispatchEvent(event);
      assert.equal(callCount, 1, 'listener called once');
    });

    it('should ignore duplicate listeners with same capture/useCapture flag', () => {
      const eventTarget = new EventTarget();
      const eventName = xhrEvents[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback, true);
      eventTarget.addEventListener(eventName, callback, { capture: true });

      eventTarget.dispatchEvent(event);
      assert.equal(callCount, 1, 'listener called once');
    });

    it('should not consider listeners with different capture/useCapture flag as duplicates', () => {
      const eventTarget = new EventTarget();
      const eventName = xhrEvents[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback, true);
      eventTarget.addEventListener(eventName, callback /* , false */);

      eventTarget.dispatchEvent(event);
      assert.equal(callCount, 2, 'listener called twice');
    });

    it('should respect the once flag', () => {
      const eventTarget = new EventTarget();
      const eventName = xhrEvents[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback, { once: true });

      eventTarget.dispatchEvent(event);
      eventTarget.dispatchEvent(event);

      assert.equal(callCount, 1, 'listener called once');
    });

    it('should respect the once flag when readded as listener in callback', () => {
      const eventTarget = new EventTarget();
      const eventName = xhrEvents[0];
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

      assert.equal(callCount, 2, 'listener called twice');
    });
  });

  describe('removeEventListener()', () => {
    it('should remove a listener', () => {
      const eventTarget = new EventTarget();
      const eventName = xhrEvents[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback);
      eventTarget.removeEventListener(eventName, callback);

      eventTarget.dispatchEvent(event);
      assert.equal(callCount, 0, 'listener not called');
    });

    it('should consider the capture/useCapture flag', () => {
      const eventTarget = new EventTarget();
      const eventName = xhrEvents[0];
      const event = { type: eventName };

      let callCount = 0;
      function callback() { callCount += 1; }
      eventTarget.addEventListener(eventName, callback, true);
      eventTarget.removeEventListener(eventName, callback);

      eventTarget.dispatchEvent(event);
      assert.equal(callCount, 1, 'listener called twice');
    });
  });

  describe('dispatchEvent()', () => {
    xhrEvents.forEach((eventName) => {
      it(`should support the XMLHttpRequest event ${eventName}`, () => {
        const eventTarget = new EventTarget();
        const event = { type: eventName };

        let propertyHandlerCalled = false;
        eventTarget[`on${eventName}`] = function onEventListener(e) {
          propertyHandlerCalled = true;
          assert.equal(this, eventTarget);
          assert.equal(e, event, 'event parameter');
        };
        let listenerCalled = false;
        eventTarget.addEventListener(eventName, function propertyEventListener(e) {
          listenerCalled = true;
          assert.equal(this, eventTarget);
          assert.equal(e, event, 'event parameter');
        });

        eventTarget.dispatchEvent(event);
        assert.isOk(propertyHandlerCalled, 'propertyHandlerCalled');
        assert.isOk(listenerCalled, 'listenerCalled');
      });
    });

    it('should not call listeners added in callback', () => {
      const eventTarget = new EventTarget();

      eventTarget.onerror = () => {
        eventTarget.addEventListener('error', () => {
          assert.fail('listened added in callback should not be called');
        });
      };
      eventTarget.dispatchEvent({ type: 'error' });
    });

    it('should call handleEvent() method on listener', () => {
      const eventTarget = new EventTarget();
      let called = false;
      eventTarget.onerror = { handleEvent: () => { called = true; } };
      eventTarget.dispatchEvent({ type: 'error' });
      assert.isOk(called, 'handleEvent() called');
    });

    it('should use custom context as "this" for upload events', () => {
      const context = {};
      const eventTarget = new EventTarget(context);
      eventTarget.onprogress = function listener() {
        assert.equal(this, context, 'custom context');
      };
      eventTarget.dispatchEvent({ type: 'progress' });
    });
  });

  it('hasListeners()', () => {
    const eventTarget = new EventTarget();
    assert.notOk(eventTarget.hasListeners());
    eventTarget.onerror = () => {};
    assert.isOk(eventTarget.hasListeners());
    delete eventTarget.onerror;
    assert.notOk(eventTarget.hasListeners());
    eventTarget.addEventListener('error', () => {});
    assert.isOk(eventTarget.hasListeners());
  });
});
