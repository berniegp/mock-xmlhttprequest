'use strict';

/**
 * Contructor for EventTarget which can dispatch events.
 *
 * Limitations:
 * - No removeEventListener() support
 *   https://dom.spec.whatwg.org/#dom-eventtarget-removeeventlistener
 * - dispatchEvent() does not return a result
 *   https://dom.spec.whatwg.org/#dom-eventtarget-dispatchevent
 *
 * @param {object} eventContext "this" in event handlers
 */
var EventTarget = function(eventContext) {
  this._eventContext = eventContext || this;
  this._eventListeners = {};
};

/**
 * XMLHttpRequest events
 */
EventTarget.events = [
  'loadstart',
  'progress',
  'abort',
  'error',
  'load',
  'timeout',
  'loadend',
];

/**
 * @param  {string}  type event type ('load', 'abort', etc)
 * @return {boolean}      whether listeners exist for the event type
 */
EventTarget.prototype.hasListeners = function() {
  for (var i = 0; i < EventTarget.events.length; i++) {
    var event = EventTarget.events[i];
    if (this._eventListeners[event] || this['on' + event]) {
      return true;
    }
  }
  return false;
};

EventTarget.prototype.addEventListener = function(type, callback) {
  if (callback) {
    this._eventListeners[type] = this._eventListeners[type] || [];
    this._eventListeners[type].push(callback);
  }
};

/**
 * Calls all the listeners for the event.
 *
 * @param  {object} event event
 */
EventTarget.prototype.dispatchEvent = function(event) {
  var listeners = [];
  if (this._eventListeners[event.type]) {
    // This avoids event listeners added after this point from being run.
    for (var i = 0; i < this._eventListeners[event.type].length; i++) {
      listeners.push(this._eventListeners[event.type][i]);
    }
  }

  // Handle event listeners added as object properties (e.g. obj.onload = ...)
  if (EventTarget.events.indexOf(event.type) !== -1) {
    var handler = this['on' + event.type];
    if (handler) {
      listeners.push(handler);
    }
  }

  for (i = 0; i < listeners.length; i++) {
    if (typeof listeners[i] === 'function') {
      listeners[i].call(this._eventContext, event);
    } else {
      listeners[i].handleEvent();
    }
  }
};

module.exports = EventTarget;
