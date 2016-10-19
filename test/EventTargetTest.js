var assert = require('chai').assert;

var EventTarget = require('../src/EventTarget');

describe('EventTarget', function() {

  var xhrEvents = [
    'loadstart',
    'progress',
    'abort',
    'error',
    'load',
    'timeout',
    'loadend',
  ];
  describe('dispatchEvent()', function() {

    xhrEvents.forEach(function(eventName) {
      it('should support the XMLHttpRequest event ' + eventName, function() {
        var eventTarget = new EventTarget();
        var event = { type: eventName };

        var propertyHandlerCalled = false;
        eventTarget['on' + eventName] = function(e) {
          propertyHandlerCalled = true;
          assert.equal(this, eventTarget);
          assert.equal(e, event, 'event parameter');
        };
        var listenerCalled = false;
        eventTarget.addEventListener(eventName, function(e) {
          listenerCalled = true;
          assert.equal(this, eventTarget);
          assert.equal(e, event, 'event parameter');
        });

        eventTarget.dispatchEvent(event);
        assert.isOk(propertyHandlerCalled, 'propertyHandlerCalled');
        assert.isOk(listenerCalled, 'listenerCalled');
      });
    });

    it('should not call listeners added in callback', function() {
      var eventTarget = new EventTarget();

      eventTarget.onerror = function() {
        eventTarget.addEventListener('error', function() {
          assert.fail('listened added in callback should not be called');
        });
      };
      eventTarget.dispatchEvent({ type: 'error' });
    });

    it('should call handleEvent() method on listener', function() {
      var eventTarget = new EventTarget();
      var called = false;
      eventTarget.onerror = {
        handleEvent: function() {
          called = true;
        }
      };
      eventTarget.dispatchEvent({ type: 'error' });
      assert.isOk(called, 'handleEvent() called');
    });

    it('should have XMLHttpRequest as context for upload events', function() {
      var context = {};
      var eventTarget = new EventTarget(context);
      eventTarget.onprogress = function() {
        assert.equal(this, context, 'custom context');
      };
      eventTarget.dispatchEvent({ type: 'progress' });
    });
  });

  it('hasListeners()', function() {
    var eventTarget = new EventTarget();
    assert.notOk(eventTarget.hasListeners());
    eventTarget.onerror = function() {};
    assert.isOk(eventTarget.hasListeners());
    delete eventTarget.onerror;
    assert.notOk(eventTarget.hasListeners());
    eventTarget.addEventListener('error', function() {});
    assert.isOk(eventTarget.hasListeners());
  });
});
