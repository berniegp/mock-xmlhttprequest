/**
 * An EventTarget object represents a target to which an event can be dispatched when something has
 * occurred.
 *
 * Based on https://dom.spec.whatwg.org/#interface-eventtarget
 *
 * Limitations:
 * - No removeEventListener() support
 *   https://dom.spec.whatwg.org/#dom-eventtarget-removeeventlistener
 * - dispatchEvent() does not return a result
 *   https://dom.spec.whatwg.org/#dom-eventtarget-dispatchevent
 */
class EventTarget {
  /**
   * Contructor
   *
   * @param {*} eventContext optional "this" for event handlers
   */
  constructor(eventContext = this) {
    this._eventContext = eventContext;
    this._eventListeners = {};
  }

  /**
   * @return {boolean} whether any event listener is registered
   */
  hasListeners() {
    return EventTarget.events.some((event) => {
      return this._eventListeners[event] || this[`on${event}`];
    });
  }

  /**
   * Add an event listener.
   *
   * @param {string} type event type ('load', 'abort', etc)
   * @param {function} callback listener callback function
   */
  addEventListener(type, callback) {
    if (callback) {
      this._eventListeners[type] = this._eventListeners[type] || [];
      this._eventListeners[type].push(callback);
    }
  }

  /**
   * Calls all the listeners for the event.
   *
   * @param {object} event event
   */
  dispatchEvent(event) {
    // Only the event listeners registered at this point should be called. Storing them here avoids
    // problems with listeners that modify the registered listeners.
    const listeners = [];
    if (this._eventListeners[event.type]) {
      listeners.push(...this._eventListeners[event.type]);
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
