export const XHR_PROGRESS_EVENT_NAMES = [
  'loadstart',
  'progress',
  'abort',
  'error',
  'load',
  'timeout',
  'loadend',
] as const;

export type TXhrProgressEventNames = typeof XHR_PROGRESS_EVENT_NAMES[number];
