import EventTarget from "./EventTarget"

export class XMLHttpRequestEventTarget extends EventTarget {
  onloadstart?: XMLHttpRequestEventTarget.EventHandler;
  onprogress?: XMLHttpRequestEventTarget.EventHandler;
  onabort?: XMLHttpRequestEventTarget.EventHandler;
  onerror?: XMLHttpRequestEventTarget.EventHandler;
  onload?: XMLHttpRequestEventTarget.EventHandler;
  ontimeout?: XMLHttpRequestEventTarget.EventHandler;
  onloadend?: XMLHttpRequestEventTarget.EventHandler;
}

export namespace XMLHttpRequestEventTarget {
  type EventHandler = (event: EventTarget.Event) => any;
}

export default XMLHttpRequestEventTarget;
