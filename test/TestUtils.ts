/* eslint-disable import/prefer-default-export */
import { XHR_PROGRESS_EVENT_NAMES } from '../src/XhrProgressEventsNames';

import type MockXhr from '../src/MockXhr';
import type XhrProgressEvent from '../src/XhrProgressEvent';

/**
 *
 * @param xhr MockXhr
 * @returns An array of all events fired by the xhr
 */
export function recordEvents(xhr: MockXhr) {
  const events: string[] = [];
  const makeEventRecorder = (prefix = '') => {
    return (evt: Event) => {
      const e = evt as unknown as XhrProgressEvent;
      events.push(`${prefix}${e.type}(${e.loaded},${e.total},${e.lengthComputable})`);
    };
  };
  XHR_PROGRESS_EVENT_NAMES.forEach((event) => {
    xhr.addEventListener(event, makeEventRecorder());
    xhr.upload.addEventListener(event, makeEventRecorder('upload.'));
  });
  xhr.addEventListener('readystatechange', function readystatechange(this: MockXhr) {
    events.push(`readystatechange(${this.readyState})`);
  });
  return events;
}
