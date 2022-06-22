[![Build Status](https://travis-ci.org/berniegp/mock-xmlhttprequest.svg?branch=master)](https://travis-ci.org/berniegp/mock-xmlhttprequest)

# mock-xmlhttprequest
`XMLHttpRequest` mock for testing that provides a simple interface to simulate interactions with `XMLHttpRequest` without any outside dependency or interaction with the browser. It is meant as a drop-in replacement for `XMLHttpRequest` when testing code that depends on it.

This library implements the `XMLHttpRequest` interface and handles requests and events as specified in the [XMLHTTPRequest specification](https://xhr.spec.whatwg.org) without actually sending anything over the network. [Mock response methods](#mock-response-methods) and [Hooks](#hooks) are provided to simulate responses, upload progress, etc. The mock response methods are higher level and automatically handle lower-level processing like emitting events and setting the `readystate` property.

## Table of Contents
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Low-Level Quick Start](#low-level-quick-start)
- [Features](#features)
  - [Supported](#supported)
  - [Not supported](#not-supported)
- [Usage](#usage)
  - [Mock Server](#mock-server)
    - [Basic Setup](#basic-setup)
    - [Routes](#routes)
      - [HTTP Request Method](#http-request-method)
      - [Request URL Matcher](#request-url-matcher)
      - [Request Handler](#request-handler)
  - [Mock response methods](#mock-response-methods)
  - [Hooks](#hooks)
  - [The `timeout` Attribute and Request Timeouts](#the-timeout-attribute-and-request-timeouts)
  - [Run Unit Tests](#run-unit-tests)
- [Contributing](#contributing)
- [License](#license)

## Installation
via [npm (node package manager)](https://github.com/npm/npm)

    $ npm install mock-xmlhttprequest

## Quick Start
```javascript
const assert = require('assert');
const MockXMLHttpRequest = require('mock-xmlhttprequest');

// Install the server's XMLHttpRequest mock in the "global" context.
// "new XMLHttpRequest()" will then create a mock request to which the server will reply.
const server = MockXMLHttpRequest.newServer({
  get: ['/my/url', {
    // status: 200 is the default
    headers: { 'Content-Type': 'application/json' },
    body: '{ "message": "Success!" }',
  }],
}).install( /* optional context; defaults to global */ );

// Do something that send()s an XMLHttpRequest to '/my/url'
const result = MyModuleUsingXhr.someAjaxMethod();

// Assuming someAjaxMethod() returns the parsed JSON body
assert.equal(result.message, 'Success!');

// Restore the original XMLHttpRequest from the context given to install()
server.remove();
```

## Low-Level Quick Start
An alternative usage pattern not using the mock server based only on the `MockXhr` class. Mostly here for historical reasons because it predates the mock server.

```javascript
const assert = require('assert');
const MockXMLHttpRequest = require('mock-xmlhttprequest');
const MockXhr = MockXMLHttpRequest.newMockXhr();

// Mock JSON response
MockXhr.onSend = (xhr) => {
  const responseHeaders = { 'Content-Type': 'application/json' };
  const response = '{ "message": "Success!" }';
  xhr.respond(200, responseHeaders, response);
};

// Install in the global context so "new XMLHttpRequest()" uses the XMLHttpRequest mock
global.XMLHttpRequest = MockXhr;

// Do something that send()s an XMLHttpRequest to '/my/url'
const result = MyModuleUsingXhr.someAjaxMethod();

// Assuming someAjaxMethod() returns the value of the 'result' property
assert.equal(result.message, 'Success!');

// Remove the mock class from the global context
delete global.XMLHttpRequest;
```

## Features
Based on the [XMLHTTPRequest specification](https://xhr.spec.whatwg.org), version '18 August 2020'.

### Supported
- events and states
- `open()`, `setRequestHeader()`, `send()` and `abort()`
- upload and download progress events
- response status, `statusText`, headers and body
- the timeout attribute (can be disabled) (since v4.0.0)
- simulating a network error
- simulating a request timeout (see [`MockXhr.setRequestTimeout()`](#setrequesttimeout))

### Partial support
- `overrideMimeType()`: throws when required, but has no other effect.
- `responseType`: `''`, `'text'` and `'json'` are fully supported. Other `responseType` values can also be used, but they will return the response body passed to [`setResponseBody()`](#setresponsebodybody--null) as-is in `xhr.response`.
- `responseXml`: the response body is not converted to a document response. To get a document response, pass it directly as the response body in [`setResponseBody()`](#setresponsebodybody--null).

### Not supported
- synchronous requests (i.e. `async` == false)
- parsing the URL and setting the `username` and `password` since there are no actual HTTP requests
- `responseUrl` (i.e. the final request URL with redirects) is not automatically set. This can be emulated in a request handler.

## Usage

### Mock Server
The mock server is the easiest way to define responses for one or more requests. Handlers can be registered for any HTTP method and URL without having to dig in the lower-level [hooks](#hooks) of this library.

#### Basic Setup
The basic structure of tests using the mock server is:

```javascript
const server = require('mock-xmlhttprequest').newServer( /* routes */ );
try {
  server.install( /* optional context; defaults to global */ );
  // Test code that creates XMLHttpRequests
} finally {
  // Don't do this before the test code is done creating XMLHttpRequests!
  server.remove();
}
```

- `install(context = global)` installs the server's XMLHttpRequest mock in the given context (e.g. `global` in node or `window` in the browser).
- `remove()` reverts what `install()` did.

For more control, you can also access the server's XMLHttpRequest mock class. This allows injecting it somewhere with custom code instead of using `install()`:
- `server.xhrFactory` is a factory method to create XMLHttpRequest mock instances.
- `server.MockXhr` is the server's XMLHttpRequest mock class.

Usage example:

```javascript
const server = require('mock-xmlhttprequest').newServer( /* routes */ );
const savedFactory = MyClass.xhrFactory;
try {
  MyClass.xhrFactory = server.xhrFactory;
  // Test code that creates XMLHttpRequests through MyClass.xhrFactory()
} finally {
  // Don't do this before the test code is done using the factory!
  MyClass.xhrFactory = savedFactory;
}
```

#### Routes
Routes are defined by these 3 elements:
- An [HTTP request method](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol#Request_methods).
- A request URL matcher.
- A request handler.

When an XMLHttpRequest is sent, the server responds with the request handler of the first route matching the request method and URL. Note that route insertion order is important here. If no route is found for a request, no action is taken.

The route concept is loosely based on the [Express framework](https://expressjs.com/).

##### HTTP Request Method
Any `string` with a valid HTTP request method is allowed. This includes standard methods like `GET`, `POST`, `PUT` and `DELETE`, but also other method names as well.

##### Request URL Matcher
This can be:
- A `string` (e.g. '/get') in which case it must match exactly the request URL.
- A `RegExp` against which the request URL is tested.
- A `Function` (signature `matches(url)`) which must return true if the request URL matches.

##### Request Handler
This can be:
- An `object` with the response properties. The default values are: ` { status: 200, headers: {}, body: null, statusText: 'OK' }`. An empty object is also allowed here to accept all default values.
- A `Function` (signature `handler(xhr)`) that calls the [mock response methods](#mock-response-methods) directly.
- An array of `object` and `Function` request handlers. In this case, the first matching request gets the first handler, the second gets the second handler and so on. The last handler is reused if the number of matching requests exceeds the number of handlers in the array.

These handlers are equivalent:
```javascript
const handlerObj = {};
const handlerFn = (xhr) => { xhr.respond(); };
const handlerArray = [{}];
```

Request handlers are invoked in a different call stack (using `setTimeout()`) than the one that called `send()` on the `XMLHttpRequest`. Therefore you will probably need to use your test framework's asynchronous test support (e.g. for Mocha: https://mochajs.org/#asynchronous-code) to complete the unit test.

#### MockXMLHttpRequest.newServer(routes = {})
Factory method to create a new server. The optional `routes` parameter allows defining routes directly at construction. Each property name in `routes` corresponds to an HTTP method and its value must be an array containing `[url_matcher, request_handler]`.

Example:
```javascript
const handlerFn = (xhr) => { xhr.respond(); };
newServer({
  get: ['/get', { status: 200 }],
  'my-method': ['/my-method', { status: 201 }],
  post: ['/post', [handlerFn, { status: 404 }]],
});
```

#### get(matcher, handler)
Add a [route](#routes) for the `GET` HTTP method.

#### post(matcher, handler)
Add a [route](#routes) for the `POST` HTTP method.

#### put(matcher, handler)
Add a [route](#routes) for the `PUT` HTTP method.

#### delete(matcher, handler)
Add a [route](#routes) for the `DELETE` HTTP method.

#### addHandler(method, matcher, handler)
Add a [route](#routes) for the `method` HTTP method.

#### setDefaultHandler(handler)
Set a default request handler for requests that don't match any route.

#### setDefault404()
Return 404 responses for requests that don't match any route.

#### getRequestLog()
Returns the list of all requests received by the server. Each entry has `{ method, url, body, headers }`. Can be useful for debugging or asserting the order and contents of the sent mock requests.

#### disableTimeout() and enableTimeout()
Controls whether setting the `timeout` attribute of a mocked `XMLHttpRequest` actually triggers `timeout` events that cancel requests. This is enabled by default. See ["The `timeout` Attribute and Request Timeouts"](#the-timeout-attribute-and-request-timeouts).

### Mock response methods

These methods can be called on `MockXhr` (i.e. the `XMLHttpRequest` mock) instances.

#### getRequestBodySize()
Get the request body's total byte size.

Note: the non-mocked body size will be larger than this for a `multipart/form-data` encoded `FormData` body since it will include headers, encoding, etc. The value returned by this method can therefore be seen as a floor value for the real thing that is nonetheless useful to simulate upload progress events.

#### uploadProgress(transmitted)
Fires a request upload progress event where `transmitted` is the number of bytes transmitted.

May only be called when the request body is not null and the upload is not complete. Can be followed by any other mock response method.

#### respond(status = 200, headers = {}, body = null, statusText = 'OK')
Complete response method which sets the response headers and body. Will fire the appropriate `readystatechange`, `progress`, `load`, etc. (upload) events. The state of the request will be set to `DONE`.

This is a shorthand for calling [`setResponseHeaders()`](#setresponseheadersstatus--200-headers---statustext--ok) and [`setResponseBody()`](#setresponsebodybody--null) in sequence.

No other mock response methods may be called after this one until `open()` is called.

#### setResponseHeaders(status = 200, headers = {}, statusText = 'OK')
Sets the response headers only. Will fire the appropriate `readystatechange`, `progress`, `load`, etc. (upload) events. Will set the request state to `HEADERS_RECEIVED`.

Should be followed by either [`downloadProgress()`](#downloadprogresstransmitted-length), [`setResponseBody()`](#setresponsebodybody--null), [`setNetworkError()`](#setnetworkerror) or [`setRequestTimeout()`](#setrequesttimeout).

#### downloadProgress(transmitted, length)
Fires a response progress event. Will set the request state to `LOADING`.

Must be preceded by [`setResponseHeaders()`](#setresponseheadersstatus--200-headers---statustext--ok).

#### setResponseBody(body = null)
Sets the response body. Calls [`setResponseHeaders()`](#setresponseheadersstatus--200-headers---statustext--ok if not already called. Will fire the appropriate `readystatechange`, `progress`, `load`, etc. (upload) events. The state of the request will be set to `DONE`.

No other mock response methods may be called after this one until `open()` is called.

#### setNetworkError()
Simulates a network error. Will set the request state to `DONE` and fire an `error` event  (amongst other events).

No other mock response methods may be called after this one until `open()` is called.

#### setRequestTimeout()
Simulates a request timeout. Will set the request state to `DONE` and fire a `timeout` event  (amongst other events).

No other mock response methods may be called after this one until `open()` is called.

### Hooks
The hooks defined in this library can be set at these locations:
- On an instance of `MockXhr` (i.e. of the `XMLHttpRequest` mock class).
- On a "local" `MockXhr` mock subclass returned by `require('mock-xmlhttprequest').newMockXhr()`.
- Globally, directly on the `MockXhr` class (from `require('mock-xmlhttprequest').MockXhr`). Note that each call to `require('mock-xmlhttprequest')` in a node process will return the same instance of `MockXMLHttpRequest`. This means that hooks set directly on `MockXMLHttpRequest.MockXhr` need to be removed manually when no longer needed. This method is therefore not recommended.

#### MockXhr.onCreate(xhr)
Called when an instance of `MockXhr` is created. This makes it possible to capture instances of  `XMLHttpRequest` when they are constructed.

This hook is called inside the `MockXhr` constructor.

```javascript
const MockXMLHttpRequest = require('mock-xmlhttprequest');
const MockXhr = MockXMLHttpRequest.newMockXhr();

// Hook for all requests using the local mock subclass
MockXhr.onCreate = (xhr) => { /*...*/ };

// Global hook for all requests from all mocks
MockXMLHttpRequest.MockXhr.onCreate = (xhr) => { /*...*/ };
```

#### MockXhr.onSend(xhr)
Called when `XMLHttpRequest.send()` has done its processing and the test case should start using the mock reponse methods. In a real `XMLHttpRequest`, this would be where the actual http request takes place.

This callback is invoked in an empty call stack (using `setTimeout()`). Therefore you will probably need to use your test framework's asynchronous test support (e.g. for Mocha: https://mochajs.org/#asynchronous-code) to complete the unit test when using this.

```javascript
const MockXMLHttpRequest = require('mock-xmlhttprequest');
const MockXhr = MockXMLHttpRequest.newMockXhr();

// Hook for all requests using the local mock subclass
MockXhr.onSend = (xhr) => { /*...*/ };

// Global hook for all requests from all mocks
MockXMLHttpRequest.MockXhr.onSend = (xhr) => { /*...*/ };

// Hook local to an instance of MockXhr
const xhr = new MockXhr();
xhr.onSend = (xhr) => { /*...*/ };
```

### The `timeout` Attribute and Request Timeouts
(since v4.0.0)

By default, setting the `timeout` attribute of a `MockXhr` instance triggers `timeout` events that cancel requests as described in the specification. This can be problematic in some tests and when debugging interactively since request timeouts are then not explicitly triggered by the test code. There are multiple ways to disable this behavior:

 - Set `xhr.timeoutEnabled = false` on an `MockXhr` instance to disable for that instance only.
 - Set `MockXhr.timeoutEnabled = false` directly on the `MockXhr` (local) class to disable for all its instances.
 - Call [`server.disableTimeout()`](#disabletimeout-and-enabletimeout) on a mock server to disable for all its `MockXhr` instances.

When the `timeout` attribute is disabled (and also when it's enabled), timeouts can be triggered programmatically using [`setRequestTimeout()`](#setrequesttimeout).

### Run Unit Tests

    $ npm test

## Contributing
Contributors are welcome! See [here](CONTRIBUTING.md) for more info.

## License
[ISC](LICENSE)
