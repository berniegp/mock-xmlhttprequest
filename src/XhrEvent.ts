/**
 * XMLHttpRequest Event
 */
export default class XhrEvent {
  readonly type: string;

  /**
   * @param type Event type
   */
  constructor(type: string) {
    this.type = type;
  }
}
