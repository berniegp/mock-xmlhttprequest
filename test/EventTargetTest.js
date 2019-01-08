const { assert } = require('chai');

const EventTarget = require('../src/EventTarget');

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
