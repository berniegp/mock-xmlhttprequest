[![Build Status](https://travis-ci.org/berniegp/mock-xmlhttprequest.svg?branch=master)](https://travis-ci.org/berniegp/mock-xmlhttprequest)

# mock-xmlhttprequest
XMLHttpRequest mock for testing

Based on the [XMLHTTPRequest specification](https://xhr.spec.whatwg.org), version '24 October 2016'

## Installation
via [npm (node package manager)](https://github.com/npm/npm)

	$ npm install mock-xmlhttprequest

## Quick Start
```javascript
var assert = require('assert');
var MockXMLHttpRequest = require('mock-xmlhttprequest');

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
- open(), setRequestHeader(), send() and abort()
- upload and download progress events
- response status, statusText, headers and body
- simulating a network error

### Not supported
- removeEventListener() not implemented (https://dom.spec.whatwg.org/#dom-eventtarget-removeeventlistener)
- dispatchEvent() does not return a result. (https://dom.spec.whatwg.org/#dom-eventtarget-dispatchevent)
- synchronous requests (async == false)
- parsing the url and setting the username and password
- the timeout attribute and associated logic
- withCredentials
- responseUrl (the final request url with redirects)
- Setting responseType (only the empty string responseType is used)
- overrideMimeType
- responseXml

## Usage

### Unit Test Setup
```javascript
// MyModuleTest.js
var MockXMLHttpRequest = require('mock-xmlhttprequest');

// To test code that uses XMLHttpRequest directly with 'new XMLHttpRequest()'
global.XMLHttpRequest = MockXMLHttpRequest;

// Cleanup after the tests
delete global.XMLHttpRequest;
```

### Hooks

#### MockXMLHttpRequest.onCreate(xhr)
Called when an instance of `MockXMLHttpRequest` is created. This makes it possible to capture `XMLHttpRequest`s created in the module under test.

```javascript
MockXMLHttpRequest.onCreate = function(xhr) { /*...*/ };
```

#### MockXMLHttpRequest.onSend(xhr)
Called when `XMLHttpRequest.send()` has done its processing and the test case should start using the mock reponse methods. In a real `XMLHttpRequest`, this would be where the actual http request takes place.

This callback is invoked in an empty callstack (using `setTimeout`). You will probably need to use your test framework's asynchronous test support (e.g. for Mocha: https://mochajs.org/#asynchronous-code).

```javascript
// Global hook for all requests
MockXMLHttpRequest.onCreate = function(xhr) {
  // this === xhr
};

// Hook local to an instance of MockXMLHttpRequest
// var xhr = ...
xhr.onSend = function(xhr) {
  // this === xhr
};
```

### Mock response methods

#### uploadProgress(transmitted)
Fires a request upload progress event where `transmitted` is the number of bytes transmitted.

May only be called when the request body is not null and the upload is not complete. Can be followed by any other mock response method.

#### respond([status = 200], [headers = {}], [body = null], [statusText = 'OK'])
Completes response method which sets the response headers and body. Will fire the appropriate 'readystatechange', `progress`, `load`, etc. (upload) events. The state of the request will be set to `DONE`.

No other mock response methods may be called after this one.

#### setResponseHeaders([status = 200], [headers = {}], [statusText = 'OK'])
Sets only the response headers. Will fire the appropriate 'readystatechange', `progress`, `load`, etc. (upload) events. Will set the request state to `HEADERS_RECEIVED`.

Should be followed by either `downloadProgress()`, `setResponseBody()` or `setNetworkError()`.

#### downloadProgress(transmitted, length)
Fires a response progress event. Will set the request state to `LOADING`.

Must be preceded by `setResponseHeaders()`.

#### setResponseBody([body = null])
Sets the response body. Calls `setResponseHeaders()` if not already called. Will fire the appropriate 'readystatechange', `progress`, `load`, etc. (upload) events. The state of the request will be set to `DONE`.

No other mock response methods may be called after this one.

#### setNetworkError()
Simulates a network error. Will set the request state to `DONE` and fire an `error` event  (amongst other events).

No other mock response methods may be called after this one.

### Run Unit Tests

	$ npm test


## License

[ISC](LICENSE)
