'use strict';

/**
 * Header container constructor
 *
 * @param {object} headers initial headers
 */
var HeadersContainer = function(headers) {
  this._headers = [];
  if (headers && headers instanceof Object) {
    for (var header in headers) {
      if (headers.hasOwnProperty(header)) {
        this._headers.push({
          name: header,
          value: headers[header],
        });
      }
    }
  }
};

HeadersContainer.prototype.reset = function() {
  this._headers = [];
};

/**
 * Get header value. Headers are case-insensitive.
 *
 * @param  {string} name header name
 * @return {object}      header value or null
 */
HeadersContainer.prototype.getHeader = function(name) {
  var header = this._getHeader(name);
  return header !== null ? header.value : null;
};

/**
 * Get all headers as string. Each header is on its own line.
 *
 * @return {string} concatenated headers
 */
HeadersContainer.prototype.getAll = function() {
  // Get unique header names and sort them
  var headerNames = [];
  for (var i = 0; i < this._headers.length; i++) {
    var headerName = this._headers[i].name.toLowerCase();
    if (headerNames.indexOf(headerName) < 0)
    {
      headerNames.push(headerName);
    }
  }
  headerNames.sort();

  // Build the output with the combined header values
  var headers = '';
  for (i = 0; i < headerNames.length; i++) {
    headers += headerNames[i] + ': ' + this.getHeader(headerNames[i]) + '\r\n';
  }
  return headers;
};

/**
 * Add a header value, possibly concatenating with previous value
 *
 * @param {string} name  header name
 * @param {string} value header value
 */
HeadersContainer.prototype.addHeader = function(name, value) {
  var header = this._getHeader(name);
  if (header) {
    header.value += ', ' + value;
  } else {
    this._headers.push({
      name: name,
      value: value,
    });
  }
};

/**
 * Case-insensitive search.
 *
 * @param  {string} name header name
 * @return {object}      header object or null
 */
HeadersContainer.prototype._getHeader = function(name) {
  name = name.toLowerCase();
  for (var i = 0; i < this._headers.length; i++) {
    if (this._headers[i].name.toLowerCase() === name) {
      return this._headers[i];
    }
  }
  return null;
};

module.exports = HeadersContainer;
