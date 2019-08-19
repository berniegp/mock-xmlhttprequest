export class EventTarget {
  /**
   * Add an event listener.
   * See https://dom.spec.whatwg.org/#dom-eventtarget-addeventlistener
   *
   * @param type event type ('load', 'abort', etc)
   * @param callback listener callback
   * @param options options object or the useCapture flag
   */
  addEventListener(
    type: string,
    callback?: EventTarget.EventListener | EventTarget.EventCallback,
    options?: EventTarget.AddEventListenerOptions | boolean
  ) : void;

  /**
   * Remove an event listener.
   * See https://dom.spec.whatwg.org/#dom-eventtarget-removeeventlistener
   *
   * @param type event type ('load', 'abort', etc)
   * @param callback listener callback
   * @param options options object or the useCapture flag
   */
  removeEventListener(
    type: string,
    callback?: EventTarget.EventListener | EventTarget.EventCallback,
    options?: EventTarget.EventListenerOptions | boolean
  ) : void;
}

export namespace EventTarget {
  interface Event {
    type: string;
  }

  interface EventListener {
    handleEvent: EventCallback;
  }

  type EventCallback = (event: Event) => void;

  interface EventListenerOptions {
    capture?: boolean;
  }

  interface AddEventListenerOptions extends EventListenerOptions {
    passive?: boolean;
    once?: boolean;
  }
}

export default EventTarget
