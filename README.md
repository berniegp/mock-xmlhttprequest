[![Build Status](https://travis-ci.org/berniegp/mock-xmlhttprequest.svg?branch=master)](https://travis-ci.org/berniegp/mock-xmlhttprequest)

# mock-xmlhttprequest
XMLHttpRequest mock for testing

Based on the [XMLHTTPRequest specification](https://xhr.spec.whatwg.org), version '15 June 2018'

## Installation
via [npm (node package manager)](https://github.com/npm/npm)

	$ npm install mock-xmlhttprequest

## Quick Start
```javascript
var assert = require('assert');
var MockXMLHttpRequest = require('mock-xmlhttprequest').newMockXhr();

// Install in global context so "new XMLHttpRequest()" works in MyModuleUsingXhr
global.XMLHttpRequest = MockXMLHttpRequest;

var MyModuleUsingXhr = require('./MyModuleUsingXhr');

// Mock JSON response
MockXMLHttpRequest.onSend = function(xhr) {
  var response = {
    result: 'success',
  };
  var responseHeaders = {
    'Content-Type': 'application/json',
  }l
  xhr.respond(200, responseHeaders, JSON.stringify(response));
};

var result = MyModuleUsingXhr.someAjaxMethod();

// assuming someAjaxMethod() returns the value of the 'result' property
assert.equal(result, 'success');
```

### Supported
- events and states
- `open()`, `setRequestHeader()`, `send()` and `abort()`
- upload and download progress events
- response status, `statusText`, headers and body
- simulating a network error
- simulating a request time out

### Not supported
- `removeEventListener()` not implemented (https://dom.spec.whatwg.org/#dom-eventtarget-removeeventlistener)
- `dispatchEvent()` does not return a result. (https://dom.spec.whatwg.org/#dom-eventtarget-dispatchevent)
- synchronous requests (`async` == false)
- parsing the url and setting the `username` and `password`
- the timeout attribute (call `MockXhr.setRequestTimeout()` to trigger a timeout)
- `withCredentials`
- `responseUrl` (the final request url with redirects)
- Setting `responseType` (only the empty string responseType is used)
- `overrideMimeType`
- `responseXml`

## Usage

### Unit Test Setup
```javascript
// MyModuleTest.js
var MockXMLHttpRequest = require('mock-xmlhttprequest');

// To test code that uses XMLHttpRequest directly with 'new XMLHttpRequest()'
global.XMLHttpRequest = MockXMLHttpRequest.newMockXhr();

// Cleanup after the tests
delete global.XMLHttpRequest;
```

### Hooks

The hooks defined in this library can be set at these locations:
- On an instance of `MockXMLHttpRequest` (i.e. a mocked `XMLHttpRequest`).
- On a local `XMLHttpRequest` mock returned by `MockXMLHttpRequest.newMockXhr()`.
- Globally, directly on the `MockXMLHttpRequest` object (from `require('mock-xmlhttprequest')`). Note that each call to `require('mock-xmlhttprequest')` in a node process will return the same instance of `MockXMLHttpRequest`. This means that hooks set directly on `MockXMLHttpRequest` need to be removed manually when no longer needed. This method is therefore not recommended.

#### MockXMLHttpRequest.onCreate(xhr)
Called when an instance of `MockXMLHttpRequest` is created. This makes it possible to capture `XMLHttpRequest`s created in the module under test.

```javascript
var MockXMLHttpRequest = require('mock-xmlhttprequest');
var LocalXMLHttpRequestMock = MockXMLHttpRequest.newMockXhr();

// Global hook for all requests from the local mock
LocalXMLHttpRequestMock.onCreate = function(xhr) { /*...*/ };

// Global hook for all requests from all mocks
MockXMLHttpRequest.onCreate = function(xhr) { /*...*/ };
```

#### MockXMLHttpRequest.onSend(xhr)
Called when `XMLHttpRequest.send()` has done its processing and the test case should start using the mock reponse methods. In a real `XMLHttpRequest`, this would be where the actual http request takes place.

This callback is invoked in an empty callstack (using `setTimeout()`). You will probably need to use your test framework's asynchronous test support (e.g. for Mocha: https://mochajs.org/#asynchronous-code).

```javascript
var MockXMLHttpRequest = require('mock-xmlhttprequest');
var LocalXMLHttpRequestMock = MockXMLHttpRequest.newMockXhr();

// Global hook for all requests from the local mock
LocalXMLHttpRequestMock.onCreate = function(xhr) {
  // this === xhr
};

// Hook local to an instance of MockXMLHttpRequest
var xhr = new LocalXMLHttpRequestMock(); // or, more likely, captured in the onCreate() hook
xhr.onSend = function(xhr) {
  // this === xhr
};

// Global hook for all requests from all mocks
MockXMLHttpRequest.onCreate = function(xhr) {
  // this === xhr
};
```

### Mock response methods

#### uploadProgress(transmitted)
Fires a request upload progress event where `transmitted` is the number of bytes transmitted.

May only be called when the request body is not null and the upload is not complete. Can be followed by any other mock response method.

#### respond([status = 200], [headers = {}], [body = null], [statusText = 'OK'])
Complete response method which sets the response headers and body. Will fire the appropriate 'readystatechange', `progress`, `load`, etc. (upload) events. The state of the request will be set to `DONE`.

This is a shorthand for calling `setResponseHeaders()` and `setResponseBody()` in sequence.

No other mock response methods may be called after this one until `open()` is called.

#### setResponseHeaders([status = 200], [headers = {}], [statusText = 'OK'])
Sets the response headers only. Will fire the appropriate 'readystatechange', `progress`, `load`, etc. (upload) events. Will set the request state to `HEADERS_RECEIVED`.

Should be followed by either `downloadProgress()`, `setResponseBody()`, `setNetworkError()` or `setRequestTimeout()`.

#### downloadProgress(transmitted, length)
Fires a response progress event. Will set the request state to `LOADING`.

Must be preceded by `setResponseHeaders()`.

#### setResponseBody([body = null])
Sets the response body. Calls `setResponseHeaders()` if not already called. Will fire the appropriate 'readystatechange', `progress`, `load`, etc. (upload) events. The state of the request will be set to `DONE`.

No other mock response methods may be called after this one until `open()` is called.

#### setNetworkError()
Simulates a network error. Will set the request state to `DONE` and fire an `error` event  (amongst other events).

No other mock response methods may be called after this one until `open()` is called.

#### setRequestTimeout()
Simulates a request time out. Will set the request state to `DONE` and fire a `timeout` event  (amongst other events).

No other mock response methods may be called after this one until `open()` is called.

### Run Unit Tests

	$ npm test


## License

[ISC](LICENSE)
