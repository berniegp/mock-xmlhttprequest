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
   * @param type event type
   * @param loaded loaded bytes
   * @param total total bytes
   */
  constructor(type: TXhrProgressEventNames, loaded = 0, total = 0) {
    this.type = type;
    this.loaded = loaded;
    this.total = total;
    this.lengthComputable = total > 0;
  }
}
