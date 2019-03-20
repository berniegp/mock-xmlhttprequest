'use strict';

function flattenUseCaptureFlag(options) {
  if (typeof options === 'boolean') {
    return options;
  }
  return !!options.capture;
}

/**
 * An EventTarget object represents a target to which an event can be dispatched when something has
 * occurred.
 *
 * Based on https://dom.spec.whatwg.org/#interface-eventtarget
 */
class EventTarget {
  /**
   * Contructor
   *
   * @param {?object} eventContext optional "this" for event handlers
   */
  constructor(eventContext = this) {
    this._eventContext = eventContext;
    this._eventListeners = {};
  }

  /**
   * @returns {boolean} whether any event listener is registered
   */
  hasListeners() {
    return EventTarget.events.some((event) => {
      return this._eventListeners[event] || this[`on${event}`];
    });
  }

  /**
   * Add an event listener.
   * See https://dom.spec.whatwg.org/#dom-eventtarget-addeventlistener
   *
   * @param {string} type event type ('load', 'abort', etc)
   * @param {EventListener|Function} callback listener callback
   * @param {boolean|object} options options object or the useCapture flag
   */
  addEventListener(type, callback, options = false) {
    if (callback) {
      const useCapture = flattenUseCaptureFlag(options);
      const listener = { callback, useCapture };
      this._eventListeners[type] = this._eventListeners[type] || [];

      // If eventTarget’s event listener list does not contain an event listener whose type is
      // listener’s type, callback is listener’s callback, and capture is listener’s capture, then
      // append listener to eventTarget’s event listener list.
      // See https://dom.spec.whatwg.org/#add-an-event-listener
      if (!this._eventListeners[type].some((other) => {
        return other.callback === listener.callback && other.useCapture === listener.useCapture;
      })) {
        this._eventListeners[type].push(listener);
      }
    }
  }

  /**
   * Remove an event listener.
   * See https://dom.spec.whatwg.org/#dom-eventtarget-removeeventlistener
   *
   * @param {string} type event type ('load', 'abort', etc)
   * @param {EventListener|Function} callback listener callback
   * @param {boolean|object} options options object or the useCapture flag
   */
  removeEventListener(type, callback, options = false) {
    if (this._eventListeners[type]) {
      const useCapture = flattenUseCaptureFlag(options);
      const index = this._eventListeners[type].findIndex((listener) => {
        return callback === listener.callback && useCapture === listener.useCapture;
      });
      if (index >= 0) {
        this._eventListeners[type].splice(index, 1);
      }
    }
  }

  /**
   * Calls all the listeners for the event.
   *
   * @param {object} event event
   * @returns {boolean} always true since none of the xhr event are cancelable
   */
  dispatchEvent(event) {
    // Only the event listeners registered at this point should be called. Storing them here avoids
    // problems with listeners that modify the registered listeners.
    const listeners = [];
    if (this._eventListeners[event.type]) {
      this._eventListeners[event.type].forEach(listener => listeners.push(listener.callback));
    }

    // Handle event listeners added as object properties (e.g. obj.onload = ...)
    if (EventTarget.events.includes(event.type)) {
      const listener = this[`on${event.type}`];
      if (listener) {
        listeners.push(listener);
      }
    }

    // Call the listeners
    listeners.forEach((listener) => {
      if (typeof listener === 'function') {
        listener.call(this._eventContext, event);
      } else {
        listener.handleEvent();
      }
    });
    return true;
  }
}

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

module.exports = EventTarget;
