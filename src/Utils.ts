export function getBodyByteSize(body?: string | FormData | Blob | BufferSource | null) {
  if (!body) {
    return 0;
  }

  if (typeof body === 'string') {
    return getStringByteLength(body);
  } else if ((typeof FormData !== 'undefined' && body instanceof FormData)
    || (body.constructor && body.constructor.name === 'FormData')) {
    // A FormData has field-value pairs. This testing code only sums the individual sizes of the
    // values. The full multipart/form-data encoding also adds headers, encoding, etc. which we
    // don't reproduce here.
    return Array.from((body as FormData).values()).reduce((sum, value) => {
      const valueSize = (value as File).size || getStringByteLength(String(value));
      return sum + valueSize;
    }, 0);
  }

  // Handles Blob and BufferSource;
  return (body as Blob).size || (body as BufferSource).byteLength || 0;
}

function getStringByteLength(string: string) {
  // Compute the byte length of the string (which is not the same as string.length)
  // Use Blob if available (i.e. in the browser) and Buffer otherwise.
  return typeof Blob !== 'undefined' ? new Blob([string]).size : Buffer.byteLength(string);
}

// Disallowed request headers for setRequestHeader()
const forbiddenHeaders = [
  'Accept-Charset',
  'Accept-Encoding',
  'Access-Control-Request-Headers',
  'Access-Control-Request-Method',
  'Connection',
  'Content-Length',
  'Cookie',
  'Cookie2',
  'Date',
  'DNT',
  'Expect',
  'Host',
  'Keep-Alive',
  'Origin',
  'Referer',
  'TE',
  'Trailer',
  'Transfer-Encoding',
  'Upgrade',
  'Via',
];
const forbiddenHeaderRegEx = new RegExp(`^(${forbiddenHeaders.join('|')}|Proxy-.*|Sec-.*)$`, 'i');

/**
 * See https://fetch.spec.whatwg.org/#forbidden-header-name
 *
 * @param name header name
 * @returns whether the request header name is forbidden for XMLHttpRequest
 */
export function isRequestHeaderForbidden(name: string) {
  return forbiddenHeaderRegEx.test(name);
}

/**
 * See https://fetch.spec.whatwg.org/#forbidden-method
 *
 * @param name method name
 * @returns whether the request method is forbidden for XMLHttpRequest
 */
export function isRequestMethodForbidden(method: string) {
  return /^(CONNECT|TRACE|TRACK)$/i.test(method);
}

// Normalize method names as described in open()
// https://xhr.spec.whatwg.org/#the-open()-method
const upperCaseMethods = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'POST',
  'PUT',
];
const upperCaseMethodsRegEx = new RegExp(`^(${upperCaseMethods.join('|')})$`, 'i');

/**
 * See https://fetch.spec.whatwg.org/#concept-method-normalize
 *
 * @param method HTTP method name
 * @returns normalized method name
 */
export function normalizeHTTPMethodName(method: string) {
  if (upperCaseMethodsRegEx.test(method)) {
    method = method.toUpperCase();
  }
  return method;
}

// Status code reason phrases from RFC 7231 §6.1, RFC 4918, RFC 5842, RFC 6585 and RFC 7538
const statusTexts: Record<number, string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content', // RFC 7233
  207: 'Multi-Status', // RFC 4918
  208: 'Already Reported', // RFC 5842
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified', // RFC 7232
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect', // RFC 7538
  400: 'Bad Request',
  401: 'Unauthorized', // RFC 7235
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required', // RFC 7235
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed', // RFC 7232
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable', // RFC 7233
  417: 'Expectation Failed',
  422: 'Unprocessable Entity', // RFC 4918
  423: 'Locked', // RFC 4918
  424: 'Failed Dependency', // RFC 4918
  426: 'Upgrade Required',
  428: 'Precondition Required', // RFC 6585
  429: 'Too Many Requests', // RFC 6585
  431: 'Request Header Fields Too Large', // RFC 6585
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  507: 'Insufficient Storage', // RFC 4918
  511: 'Network Authentication Required', // RFC 6585
};

/**
 * @param status HTTP status code
 * @returns status text
 */
export function getStatusText(status: number) {
  return statusTexts[status] ?? 'Unknown Status';
}
