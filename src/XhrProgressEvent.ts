import XhrEvent from './XhrEvent.ts';

import type { TXhrProgressEventNames } from './XhrProgressEventsNames.ts';

/**
 * XMLHttpRequest ProgressEvent
 */
export default class XhrProgressEvent extends XhrEvent {
  readonly loaded: number;

  readonly total: number;

  readonly lengthComputable: boolean;

  /**
   * @param type Event type
   * @param loaded Loaded bytes
   * @param total Total bytes
   */
  constructor(type: TXhrProgressEventNames, loaded = 0, total = 0) {
    super(type);
    this.loaded = loaded;
    this.total = total;
    this.lengthComputable = total > 0;
  }
}
