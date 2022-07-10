import type { TXhrProgressEventNames } from './XhrProgressEventsNames';

/**
 * XMLHttpRequest ProgressEvent
 */
export default class XhrProgressEvent {
  readonly type: string;

  readonly loaded: number;

  readonly total: number;

  readonly lengthComputable: boolean;

  /**
   * @param type Event type
   * @param loaded Loaded bytes
   * @param total Total bytes
   */
  constructor(type: TXhrProgressEventNames, loaded = 0, total = 0) {
    this.type = type;
    this.loaded = loaded;
    this.total = total;
    this.lengthComputable = total > 0;
  }
}
