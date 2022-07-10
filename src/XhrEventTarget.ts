import type { TXhrProgressEventNames } from './XhrProgressEventsNames';

/**
 * Implementation of XMLHttpRequestEventTarget. A target for dispatching events.
 *
 * See https://xhr.spec.whatwg.org/#xmlhttprequesteventtarget
 */
export default class XhrEventTarget implements XMLHttpRequestEventTarget {
  private _eventContext: XMLHttpRequestEventTarget;

  private _listeners: Map<string, EventListenerEntry[]>;

  constructor(eventContext?: XMLHttpRequestEventTarget) {
    this._eventContext = eventContext ?? this;
    this._listeners = new Map();
  }

  get onabort() { return this._getEventHandlerProperty('abort'); }

  set onabort(value: EventHandlerProperty | null) { this._setEventHandlerProperty('abort', value); }

  get onerror() { return this._getEventHandlerProperty('error'); }

  set onerror(value: EventHandlerProperty | null) { this._setEventHandlerProperty('error', value); }

  get onload() { return this._getEventHandlerProperty('load'); }

  set onload(value: EventHandlerProperty | null) { this._setEventHandlerProperty('load', value); }

  get onloadend() { return this._getEventHandlerProperty('loadend'); }

  set onloadend(value: EventHandlerProperty | null) { this._setEventHandlerProperty('loadend', value); }

  get onloadstart() { return this._getEventHandlerProperty('loadstart'); }

  set onloadstart(value: EventHandlerProperty | null) { this._setEventHandlerProperty('loadstart', value); }

  get onprogress() { return this._getEventHandlerProperty('progress'); }

  set onprogress(value: EventHandlerProperty | null) { this._setEventHandlerProperty('progress', value); }

  get ontimeout() { return this._getEventHandlerProperty('timeout'); }

  set ontimeout(value: EventHandlerProperty | null) { this._setEventHandlerProperty('timeout', value); }

  /**
   * @returns Whether any event listener is registered
   */
  hasListeners() {
    return [...this._listeners.values()].some((listeners) => {
      return listeners.some(({ removed }) => !removed);
    });
  }

  /**
   * Add an event listener.
   * See https://dom.spec.whatwg.org/#dom-eventtarget-addeventlistener
   *
   * @param type Event type ('load', 'abort', etc)
   * @param listener Listener callback
   * @param options Options object or the useCapture flag
   */
  addEventListener<K extends keyof XMLHttpRequestEventTargetEventMap>(
    type: K,
    listener: (this: XMLHttpRequestEventTarget, ev: XMLHttpRequestEventTargetEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions | undefined
  ): void;
  addEventListener(
    type: string,
    listener?: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (listener) {
      const listenerEntry = makeListenerEntry(listener, false, options);
      const listeners = this._listeners.get(type) ?? [];

      // If eventTarget’s event listener list does not contain an event listener whose type is
      // listener’s type, callback is listener’s callback, and capture is listener’s capture, then
      // append listener to eventTarget’s event listener list.
      // See https://dom.spec.whatwg.org/#add-an-event-listener
      if (listeners.every(({ isEventHandlerProperty, listener, useCapture }) => {
        return isEventHandlerProperty
         || listenerEntry.listener !== listener
         || listenerEntry.useCapture !== useCapture;
      })) {
        listeners.push(listenerEntry);
        this._listeners.set(type, listeners);
      }
    }
  }

  /**
   * Remove an event listener.
   * See https://dom.spec.whatwg.org/#dom-eventtarget-removeeventlistener
   *
   * @param type Event type ('load', 'abort', etc)
   * @param listener Listener callback
   * @param options Options object or the useCapture flag
   */
  removeEventListener<K extends keyof XMLHttpRequestEventTargetEventMap>(
    type: K,
    listener: (this: XMLHttpRequestEventTarget, ev: XMLHttpRequestEventTargetEventMap[K]) => any,
    options?: boolean | EventListenerOptions | undefined
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions | undefined
  ): void;
  removeEventListener(
    type: string,
    listener?: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (listener) {
      const listeners = this._listeners.get(type);
      if (listeners) {
        const listenerEntry = makeListenerEntry(listener, false, options);
        const index = listeners.findIndex(({ isEventHandlerProperty, listener, useCapture }) => {
          return !isEventHandlerProperty
            && listenerEntry.listener === listener
            && listenerEntry.useCapture === useCapture;
        });
        if (index >= 0) {
          listeners[index].removed = true;
          listeners.splice(index, 1);
        }
      }
    }
  }

  /**
   * Calls all the listeners for the event.
   *
   * @param event Event
   * @returns Always true since none of the xhr event are cancelable
   */
  dispatchEvent(event: Event | EventMock): boolean {
    // Only the event listeners registered at this point should be called. Storing them here avoids
    // problems with callbacks that add or remove listeners.
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      [...listeners].forEach((listenerEntry) => {
        if (!listenerEntry.removed) {
          if (listenerEntry.once) {
            const index = listeners.indexOf(listenerEntry);
            if (index >= 0) {
              listeners.splice(index, 1);
            }
          }

          if (typeof listenerEntry.listener === 'function') {
            listenerEntry.listener.call(this._eventContext, event as Event);
          } else {
            listenerEntry.listener.handleEvent(event as Event);
          }
        }
      });
    }

    return true;
  }

  private _getEventHandlerProperty(event: TXhrProgressEventNames) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      const entry = listeners.find((entry) => entry.isEventHandlerProperty);
      if (entry) {
        return entry.listener as EventHandlerProperty;
      }
    }
    return null;
  }

  private _setEventHandlerProperty(
    event: TXhrProgressEventNames,
    value?: EventHandlerProperty | null
  ) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      const index = listeners.findIndex((entry) => entry.isEventHandlerProperty);
      if (index >= 0) {
        if (listeners[index].listener === value) {
          // no change
          return;
        }

        listeners[index].removed = true;
        listeners.splice(index, 1);
      }
    }

    if (value) {
      const listenerEntry = makeListenerEntry(value as EventListener, true);
      if (listeners) {
        listeners.push(listenerEntry);
      } else {
        this._listeners.set(event, [listenerEntry]);
      }
    }
  }
}

// Used to relax the dispatchEvent() interface from XMLHttpRequestEventTarget
interface EventMock {
  type: string;
}

type EventHandlerProperty = ((this: XMLHttpRequest, ev: ProgressEvent) => any);

interface EventListenerEntry {
  listener: EventListenerOrEventListenerObject,
  isEventHandlerProperty: boolean,
  useCapture: boolean,
  once: boolean,
  removed: boolean,
}

function makeListenerEntry(
  listener: EventListenerOrEventListenerObject,
  isEventHandlerProperty: boolean,
  options?: boolean | AddEventListenerOptions
): EventListenerEntry {
  const optionsIsBoolean = typeof options === 'boolean';
  return {
    listener,
    isEventHandlerProperty,
    useCapture: optionsIsBoolean ? options : !!options?.capture,
    once: optionsIsBoolean ? false : !!options?.once,
    removed: false,
  };
}
