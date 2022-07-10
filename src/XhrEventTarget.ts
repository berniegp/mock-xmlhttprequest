import { XHR_PROGRESS_EVENT_NAMES } from './XhrProgressEventsNames';

import type { TXhrProgressEventNames } from './XhrProgressEventsNames';

// Used to relax the dispatchEvent() interface from XMLHttpRequestEventTarget
interface EventMock {
  type: string;
}

/**
 * Implementation of XMLHttpRequestEventTarget. A target for dispatching events.
 *
 * See https://xhr.spec.whatwg.org/#xmlhttprequesteventtarget
 */
export default class XhrEventTarget implements XMLHttpRequestEventTarget {
  onabort: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;

  onerror: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;

  onload: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;

  onloadend: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;

  onloadstart: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;

  onprogress: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;

  ontimeout: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;

  private _eventContext: XMLHttpRequestEventTarget;

  private _listeners: Map<string, EventListenerEntry[]>;

  constructor(eventContext?: XMLHttpRequestEventTarget) {
    this.onabort = null;
    this.onerror = null;
    this.onload = null;
    this.onloadend = null;
    this.onloadstart = null;
    this.onprogress = null;
    this.ontimeout = null;

    this._eventContext = eventContext ?? this;
    this._listeners = new Map();
  }

  /**
   * @returns whether any event listener is registered
   */
  hasListeners() {
    return this._listeners.size > 0 || XHR_PROGRESS_EVENT_NAMES.some((e) => this[`on${e}`]);
  }

  /**
   * Add an event listener.
   * See https://dom.spec.whatwg.org/#dom-eventtarget-addeventlistener
   *
   * @param type event type ('load', 'abort', etc)
   * @param listener listener callback
   * @param options options object or the useCapture flag
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
      const listenerEntry = makeListenerEntry(listener, options);
      const listeners = this._listeners.get(type) ?? [];

      // If eventTarget’s event listener list does not contain an event listener whose type is
      // listener’s type, callback is listener’s callback, and capture is listener’s capture, then
      // append listener to eventTarget’s event listener list.
      // See https://dom.spec.whatwg.org/#add-an-event-listener
      if (listeners.every(({ listener, useCapture }) => {
        return listenerEntry.listener !== listener || listenerEntry.useCapture !== useCapture;
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
   * @param type event type ('load', 'abort', etc)
   * @param listener listener callback
   * @param options options object or the useCapture flag
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
        const listenerEntry = makeListenerEntry(listener, options);
        const index = listeners.findIndex(({ listener, useCapture }) => {
          return listenerEntry.listener === listener && listenerEntry.useCapture === useCapture;
        });
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      }
    }
  }

  /**
   * Calls all the listeners for the event.
   *
   * @param event event
   * @returns always true since none of the xhr event are cancelable
   */
  dispatchEvent(event: Event | EventMock): boolean {
    // Only the event listeners registered at this point should be called. Storing them here avoids
    // problems with callbacks that add or remove listeners.
    const listeners: EventListenerOrEventListenerObject[] = [];

    const registeredListeners = this._listeners.get(event.type);
    if (registeredListeners) {
      listeners.push(...registeredListeners.map((listener) => listener.listener));

      // Remove 'once' listeners
      this._listeners.set(event.type, registeredListeners.filter((listener) => !listener.once));
    }

    // Handle event listeners added as object properties (e.g. xhr.onload = ...)
    // Note: The "cast" is to work around a TypeScript limitation in Array.includes with a string
    // literal array
    if (XHR_PROGRESS_EVENT_NAMES.includes(event.type as TXhrProgressEventNames)) {
      const listener = this[`on${event.type as TXhrProgressEventNames}`];
      if (listener) {
        listeners.push(listener as EventListener);
      }
    }

    // Call the listeners
    listeners.forEach((listener) => {
      if (typeof listener === 'function') {
        listener.call(this._eventContext, event as Event);
      } else {
        listener.handleEvent(event as Event);
      }
    });

    return true;
  }
}

interface EventListenerEntry {
  listener: EventListenerOrEventListenerObject,
  useCapture: boolean,
  once: boolean,
}

function makeListenerEntry(
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): EventListenerEntry {
  const optionsIsBoolean = typeof options === 'boolean';
  return {
    listener,
    useCapture: optionsIsBoolean ? options : !!options?.capture,
    once: optionsIsBoolean ? false : !!options?.once,
  };
}
