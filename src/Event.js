'use strict';

/**
 * XMLHttpRequest events
 */
class Event {
  /**
   * @param {string} type event type
   * @param {number} loaded loaded bytes
   * @param {number} total total bytes
   */
  constructor(type, loaded, total) {
    this.type = type;
    this.loaded = loaded !== undefined ? loaded : 0;
    if (total > 0) {
      this.total = total;
      this.lengthComputable = true;
    } else {
      this.total = 0;
      this.lengthComputable = false;
    }
  }
}

module.exports = Event;
