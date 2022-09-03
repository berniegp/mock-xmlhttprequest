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
    return [...(body as FormData).values()].reduce((sum, value) => {
      const valueSize = (value as File).size ?? getStringByteLength(String(value.toString()));
      return sum + valueSize;
    }, 0);
  }

  // Handles Blob and BufferSource
  return (body as Blob).size || (body as BufferSource).byteLength || 0;
}

function getStringByteLength(string: string) {
  // Compute the byte length of the string (which is not the same as string.length)
  // Use Blob if available (i.e. in the browser) and Buffer otherwise.
  return typeof Blob !== 'undefined' ? new Blob([string]).size : Buffer.byteLength(string);
}

const isTokenRegEx = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/;

/**
 * See https://datatracker.ietf.org/doc/html/rfc7230#section-3.2.6
 * @param token Token
 * @returns Whether token is a valid token
 */
function isToken(token?: string) {
  return typeof token === 'string' && isTokenRegEx.test(token);
}

/**
 * https://datatracker.ietf.org/doc/html/rfc7230#section-3.2
 * @param headerName Header name
 * @returns Whether headerName is a valid header name
 */
export function isHeaderName(headerName?: string) {
  return isToken(headerName);
}

/**
 * https://fetch.spec.whatwg.org/#header-value
 * @param headerValue Header value
 * @returns Whether headerValue is a valid header value
 */
export function isHeaderValue(headerValue: string) {
  return typeof headerValue === 'string'
    && headerValue.trim().length === headerValue.length
    && headerValue.indexOf('\0') === -1;
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
 * @param name Header name
 * @returns Whether the request header name is forbidden for XMLHttpRequest
 */
export function isRequestHeaderForbidden(name: string) {
  return forbiddenHeaderRegEx.test(name);
}

/**
 * See https://datatracker.ietf.org/doc/html/rfc7230#section-3.1.1
 * @param method Method name
 * @returns Whether method is a valid request method
 */
export function isRequestMethod(method?: string) {
  return isToken(method);
}

const isRequestMethodForbiddenRegEx = /^(CONNECT|TRACE|TRACK)$/i;

/**
 * See https://fetch.spec.whatwg.org/#forbidden-method
 *
 * @param method Method name
 * @returns Whether the request method is forbidden for XMLHttpRequest
 */
export function isRequestMethodForbidden(method: string) {
  return isRequestMethodForbiddenRegEx.test(method);
}

// Normalize method names as described in open()
// https://xhr.spec.whatwg.org/#the-open()-method
export const upperCaseMethods = [
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
 * @returns Normalized method name
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
 * @returns Status text
 */
export function getStatusText(status: number) {
  return statusTexts[status] ?? 'Unknown Status';
}

/**
 * @param headerValue Header value
 * @returns Split header value list or null
 * @see {@link https://fetch.spec.whatwg.org/#concept-header-list-get-decode-split}
 */
export function decodeAndSplitHeaderValue(headerValue: string | null) {
  if (headerValue === null) {
    return null;
  }

  const values: string[] = [];
  const codePoints = [...headerValue];

  function sliceAndTrimString(start: number, end: number) {
    // Remove all HTTP tab or space from the start and end of value
    while (start < end
      && (codePoints[start] === ' ' || codePoints[start] === '\t')) {
      start += 1;
    }
    while (start < end
      && (codePoints[end - 1] === ' ' || codePoints[end - 1] === '\t')) {
      end -= 1;
    }
    return codePoints.slice(start, end).join('');
  }

  let currentValueStart = 0;
  let inQuotedString = false;
  let inQuotedStringEscape = false;
  codePoints.forEach((codePoint, index) => {
    if (inQuotedString) {
      if (inQuotedStringEscape) {
        inQuotedStringEscape = false;
      } else if (codePoint === '"') {
        inQuotedString = false;
      } else if (codePoint === '\\') {
        inQuotedStringEscape = true;
      }
      return;
    } else if (codePoint === '"') {
      inQuotedString = true;
      return;
    } else if (codePoint !== ',') {
      return;
    }

    values.push(sliceAndTrimString(currentValueStart, index));
    currentValueStart = index + 1;
  });

  if (currentValueStart < codePoints.length) {
    values.push(sliceAndTrimString(currentValueStart, codePoints.length));
  } else {
    values.push('');
  }
  return values;
}

const isDigitsRegEx = /^\d+$/;

/**
 * @param headerValue Header value
 * @returns Extracted length, null, or false (failure)
 * @see {@link https://fetch.spec.whatwg.org/#header-list-extract-a-length}
 */
export function extractLengthFromHeader(headerValue: string | null) {
  if (headerValue === null) {
    return null;
  }

  const values = decodeAndSplitHeaderValue(headerValue);
  if (values === null) {
    return null;
  }

  const value = values[0];
  if (values.slice(1).some((other) => other !== value)) {
    return false;
  }
  if (value === '' || !isDigitsRegEx.test(value)) {
    return null;
  }
  return Number(value);
}
