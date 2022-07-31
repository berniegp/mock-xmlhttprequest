[![Build Status](https://travis-ci.org/berniegp/mock-xmlhttprequest.svg?branch=master)](https://travis-ci.org/berniegp/mock-xmlhttprequest)

# mock-xmlhttprequest
This library is a `XMLHttpRequest` mock that provides a simple interface to simulate interactions with `XMLHttpRequest`. It is meant as a drop-in replacement for `XMLHttpRequest` for your tests.

This library implements the `XMLHttpRequest` interface and handles requests and events as specified in the [XMLHTTPRequest specification](https://xhr.spec.whatwg.org) without interacting with the network. [Mock response methods](#mock-response-methods) and [Hooks](#hooks) are provided to simulate responses, upload progress, errors, etc. The mock response methods are higher level and automatically handle lower-level processing like emitting events and setting the `readystate` property of `XMLHttpRequest`.

## Table of contents
- [Installation](#installation)
- [Quick start](#quick-start)
- [Usage](#usage)
  - [Using the mock server](#using-the-mock-server)
  - [Asynchronous responses](#asynchronous-responses)
  - [Responding to MockXhr requests programmatically](#responding-to-mockxhr-requests-programmatically)
  - [The `timeout` attribute and request timeouts](#the--timeout--attribute-and-request-timeouts)
  - [Using the MockXhr lifecycle hooks](#using-the-mockxhr-lifecycle-hooks)
- [API reference](#api-reference)
  - [MockXhrServer class](#mockxhrserver-class)
    - [MockXhrServer setup](#mockxhrserver-setup)
    - [Routes](#routes)
    - [Adding routes](#adding-routes)
    - [Utilities](#utilities)
  - [MockXhr class](#mockxhr-class)
    - [MockXhr options](#mockxhr-options)
    - [Request inspection](#request-inspection)
    - [Mock response methods](#mock-response-methods)
    - [MockXhr lifecycle hooks](#mockxhr-lifecycle-hooks)
  - [newMockXhr()](#newmockxhr)
  - [newServer()](#newserverroutes)
- [XMLHttpRequest features](#xmlhttprequest-features)
- [Contributing](#contributing)
- [License](#license)

## Installation
via [npm (node package manager)](https://github.com/npm/npm)

    $ npm install mock-xmlhttprequest

## Quick start
```javascript
import { newServer } from 'mock-xmlhttprequest';

// Adapt based on your testing framework. This example uses Mocha and Chai's syntax.

it('should produce a success response', () => {
  const server = newServer({
    get: ['/my/url', {
      // status: 200 is the default
      headers: { 'Content-Type': 'application/json' },
      body: '{ "message": "Success!" }',
    }],
  });

  try {
    // Install the server's XMLHttpRequest mock in the "global" context.
    // "new XMLHttpRequest()" will then create a mock request to which the server will reply.
    server.install(/* optional context; defaults to globalThis */);

    // Do something that send()s an XMLHttpRequest to '/my/url' and returns a Promise
    return functionToTest().then((result) => {
      // Assuming the Promise returned by functionToTest() resolves to the parsed JSON response
      assert.equal(result.message, 'Success!');
    });
  } finally {
    // Restore the original XMLHttpRequest
    server.remove();
  }
});
```

## Usage
The `XMLHttpRequest` mock class is `MockXhr`. It exposes the same interface as `XMLHttpRequest` and is meant as a drop-in replacement to test your code that uses `XMLHttpRequest`.

There are two options for controlling the behavior of `MockXhr` instances you create:
 - [A mock server](#using-the-mock-server). This is the recommended approach.
 - [`XMLHttpRequest` lifecycle hooks](#using-the-mockxhr-lifecycle-hooks). Use this if you need more control over requests without the features provided by the mock server.

### Using the mock server
The `MockXhrServer` class implements the mock server. The `MockXhrServer` automatically responds to `MockXhr` requests and [makes writing tests easy](#quick-start).

The basic structure of tests using `MockXhrServer` is:
```javascript
import { newServer } from 'mock-xmlhttprequest';

const server = newServer( /* routes */ );
try {
  server.install( /* optional context; defaults to globalThis */ );
  // Test code that creates XMLHttpRequests
} finally {
  // Reverts server.install() at the end of the test.
  // Only do this after the test case has finished creating XMLHttpRequests.
  server.remove();
}
```

You can setup the test environment with these steps:
1. `install()` installs the server's `XMLHttpRequest` mock in the global context by default. You can specify a different context with the optional `context` argument.
2. `remove()` reverts what `install()` did so the global context isn't polluted when the test is completed.

You can also use `MockXhr` without the above steps if your code exposes a way to configure how it creates instances of `XMLHttpRequest` like a configurable factory method. In that case, you don't need to use `install()` and can instead use the following `MockXhrServer` properties:
- `xhrFactory` is a function that creates a `MockXhr` instance.
- `MockXhr` is the class of the instances created by `xhrFactory`.

This code demonstrates usage of `xhrFactory`:
```javascript
import { newServer } from 'mock-xmlhttprequest';

const server = newServer( /* routes */ );
const savedFactory = MyClass.xhrFactory;
try {
  MyClass.xhrFactory = server.xhrFactory;
  // Test code that creates XMLHttpRequests through MyClass.xhrFactory()
} finally {
  // Only do this after the test case has finished creating XMLHttpRequests.
  MyClass.xhrFactory = savedFactory;
}
```

You define the `MockXhrServer`'s responses to `MockXhr` requests using routes. These have three parts:
- An [HTTP request method](#http-request-method).
- A [request URL matcher](#request-url-matcher).
- A [request handler](#request-handler).

When you send a `MockXhr` request, the `MockXhrServer` finds the first route that matches the request's method and URL. It then responds using the corresponding request handler. You can define request handlers either declaratively or programmatically.

If no route matches a request, the `MockXhrServer` will not respond to it. If [request timeouts](#the-timeout-attribute-and-request-timeouts) are enabled, the request will eventually timeout.

The route concept is loosely based on the [Express framework](https://expressjs.com/).

To add routes to the `MockXhrServer`:
- Use the `routes` argument of the [`newServer`](#newserverroutes).
- Use the [`MockXhrServer` methods that add routes](#adding-routes).

The `MockXhrServer` records all requests it receives in a [request log](#getrequestlog). You can use this to validate which `XMLHttpRequest` requests your code sends.

### Asynchronous responses
Responding to `MockXhr` requests uses the `onSend` [lifecycle hook](#mockxhr-lifecycle-hooks). If you [use the mock server](#using-the-mock-server), this is mostly transparent. Otherwise you need to [use the `MockXhr` lifecycle hooks](#using-the-mockxhr-lifecycle-hooks) directly.

Responding to requests is asynchronous in both cases. The `onSend` lifecycle hook executes after the execution context that calls `XMLHttpRequest.send()` is done or cleared. Internally this library uses an immediately resolved `Promise` to get an empty callstack. This reproduces how a real `XMLHttpRequest` request works.

Therefore you will most likely need to use your test framework's asynchronous test support. See here for how to do this with Mocha: https://mochajs.org/#asynchronous-code.

### Responding to MockXhr requests programmatically
This library provides several `MockXhr` methods and properties to respond to requests. With these methods, you can:
- Inspect request parameters.
- Simulate upload progress.
- Provide response body, headers, and progress.
- Simulate a request timeout or error.

See the [Mock response methods](#mock-response-methods) section for more information.

### The `timeout` attribute and request timeouts
By default, if you set the `timeout` attribute of `XMLHttpRequest` in your code, `MockXhr` instances will automatically time out after the specified delay if they don't receive a response. This will emit `timeout` events and cancel the request as described in the specification.

Relying on the passage of time to test how your code handles timeouts generally makes tests brittle and hard to debug. You can instead trigger timeouts programmatically using [`setRequestTimeout()`](#setrequesttimeout).

To disable automatic request timeouts:
- Call [`disableTimeout()`](#disabletimeout-and-enabletimeout) on `MockXhrServer`. This affects all `MockXhr` instances it handles.
- `MockXhr.timeoutEnabled = false`. This static property on the `MockXhr` class affects all of its instances.
- Set `timeoutEnabled` to `false` on a `MockXhr` instance. This affects that instance only.

### Using the MockXhr lifecycle hooks
This is an alternative usage pattern using only the `MockXhr` class instead of `MockXhrServer`. You instead use the [`MockXhr` lifecycle hooks](#mockxhr-lifecycle-hooks) directly. This requires more code, but you can have more control over `MockXhr` requests without the features provided by `MockXhrServer`. Note that you can also use the `MockXhr` lifecycle hooks in conjunction with `MockXhrServer` if you need to extend it.

Quick start example:
```javascript
import { newMockXhr } from 'mock-xmlhttprequest';

// Adapt based on your testing framework. This example uses Mocha and Chai's syntax.

it('should produce a success response', () => {
  // Get a "local" MockXhr subclass
  const MockXhr = newMockXhr();

  // Mock JSON response
  MockXhr.onSend = (xhr) => {
    const responseHeaders = { 'Content-Type': 'application/json' };
    const response = '{ "message": "Success!" }';
    xhr.respond(200, responseHeaders, response);
  };

  try {
    // Install in the global context so "new XMLHttpRequest()" uses the XMLHttpRequest mock
    global.XMLHttpRequest = MockXhr;

    // Do something that send()s an XMLHttpRequest to '/my/url' and returns a Promise
    return functionToTest().then((result) => {
      // Assuming the Promise returned by functionToTest() resolves to the parsed JSON response
      assert.equal(result.message, 'Success!');
    });
  } finally {
    // Restore the original XMLHttpRequest
    delete global.XMLHttpRequest;
  }
});
```

## API reference
### MockXhrServer class
This class is a mock server that responds to `MockXhr` requests.

#### MockXhrServer setup
##### MockXhrServer(routes)
Constructor. In most cases you should use [`newServer`](#newserverroutes) instead to create a mock server.

You can add [routes](#routes) to the mock server with the optional `routes` argument. The property keys of the `routes` object are HTTP methods. Each corresponding values is a two-element arrary containing `[url_matcher, request_handler]`.

Example:
```javascript
const handlerFn = (xhr) => { xhr.respond(); };
newServer({
  get: ['/get', { status: 200 }],
  'my-method': ['/my-method', { status: 201 }],
  post: ['/post', [handlerFn, { status: 404 }]],
});
```

##### install(context = globalThis)
Installs the server's `XMLHttpRequest` mock in the global context. You can specify a different context with the optional `context` argument. Revert with [remove()](#remove).

##### remove()
Reverts the changes made by [install()](#installcontext--globalthis). Call this after your tests.

##### disableTimeout() and enableTimeout()
Controls whether setting the `timeout` attribute of a mocked `XMLHttpRequest` actually triggers `timeout` events that cancel requests. This is enabled by default. See ["The `timeout` Attribute and Request Timeouts"](#the-timeout-attribute-and-request-timeouts).

#### Routes
Routes respond to `MockXhr` requests and have three parts.

##### HTTP request method
Any `string` with a valid [HTTP request method](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol#Request_methods) is allowed. This includes standard methods like `GET`, `POST`, `PUT` and `DELETE`, but also other method names.

##### Request URL matcher
This can be:
- A `string` (e.g. `'/my-url'`) in which case it must match exactly the request URL.
- A `RegExp` against which the request URL is tested.
- A `Function` that returns `true` if the request URL matches. Function signature: `matches(url)`.

##### Request handler
This can be:
- An `object` with the response properties. The default values are:

      { status: 200, headers: {}, body: null, statusText: 'OK' }
- A `Function` that calls the [mock response methods](#mock-response-methods) directly. Function signature: `handler(xhr)`
- An array of `object` and `Function` request handlers. The first matching request gets the first handler, the second gets the second handler and so on. The last handler is reused if the number of matching requests exceeds the number of handlers in the array.

These handlers are all equivalent:
```javascript
const handlerObj = {};
const handlerFn = (xhr) => { xhr.respond(); };
const handlerArray = [{}];
```

#### Adding routes
##### get(matcher, handler)
Add a [route](#routes) for the `GET` HTTP method.

##### post(matcher, handler)
Add a [route](#routes) for the `POST` HTTP method.

##### put(matcher, handler)
Add a [route](#routes) for the `PUT` HTTP method.

##### delete(matcher, handler)
Add a [route](#routes) for the `DELETE` HTTP method.

##### addHandler(method, matcher, handler)
Add a [route](#routes) for the `method` HTTP method.

##### setDefaultHandler(handler)
Set a default request handler for requests that don't match any route.

##### setDefault404()
Return 404 responses for requests that don't match any route.

#### Utilities
##### xhrFactory
Function that creates a `MockXhr` instance.

##### MockXhr
The `MockXhr` class or subclass that the server handles. This is the class of the instances created by [`xhrFactory`](#xhrfactory).

##### getRequestLog()
Returns the list of all requests received by the server. Each entry has `{ method, url, body, headers }`. Can be useful for debugging or asserting the order and contents of the sent mock requests.

### MockXhr class
This class mocks `XMLHttpRequest`. This section documents the additional methods and propoerties of the class.

#### MockXhr options
##### MockXhr.timeoutEnabled
This static property controls [automatic timeout](#the-timeout-attribute-and-request-timeouts) of requests of all instances of the class.

##### timeoutEnabled
This static property controls [automatic timeout](#the-timeout-attribute-and-request-timeouts) of this `MockXhr` instance.

#### Request inspection
##### requestHeaders
The request's headers container (`HeadersContainer`).

##### method
The request's HTTP method.

##### url
The request's URL.

##### body
The request's body.

##### getRequestBodySize()
Returns the current request's body size in bytes.

Note: this isn't completely accurate for a `multipart/form-data` encoded `FormData` request `body`. `MockXhr` not consider headers, encoding, and other factors that influence the request `body` size of non-mocked `XMLHttpRequest`. You can consider the value returned by this method as a floor value for the request `body` size. This can still be useful to simulate upload progress events.

##### getResponseHeadersHash()
Returns all response headers as an object. The header names are in lower-case.

#### Mock response methods
These methods provide a programmatic interface to respond to `MockXhr` requests.

##### uploadProgress(transmitted)
Fires a request upload progress event where `transmitted` is the number of bytes transmitted.

You can only call this when the request's `body` isn't `null` and the upload isn't complete.

You can use any other mock response method after calling this method.

##### respond(status = 200, headers = {}, body = null, statusText = 'OK')
Complete response method that sets the response headers and body. Changes the request's `readyState` to `DONE`.

Fires the appropriate events such as `readystatechange`, `progress`, `load`.

This is a shorthand for [`setResponseHeaders()`](#setresponseheadersstatus--200-headers---statustext--ok) followed by [`setResponseBody()`](#setresponsebodybody--null).

You can't use any other mock response method after calling this method. This restriction is lifted if you call `open()` again.

##### setResponseHeaders(status = 200, headers = {}, statusText = 'OK')
Sets the response headers. Changes the request's `readyState` to `HEADERS_RECEIVED`.

Fires the appropriate events such as `readystatechange`, `progress`, `load`.

You can use the following mock response methods after calling this method:
- [`downloadProgress()`](#downloadprogresstransmitted-length)
- [`setResponseBody()`](#setresponsebodybody--null)
- [`setNetworkError()`](#setnetworkerror)
- [`setRequestTimeout()`](#setrequesttimeout).

##### downloadProgress(transmitted, length)
Fires a response progress event. Changes the request's `readyState` to `LOADING`.

You must call [`setResponseHeaders()`](#setresponseheadersstatus--200-headers---statustext--ok) before this method.

##### setResponseBody(body = null)
Sets the response body. Changes the request's `readyState` to `DONE`.

Fires the appropriate events such as `readystatechange`, `progress`, `load`.

Calls [`setResponseHeaders()`](#setresponseheadersstatus--200-headers---statustext--ok if not already called.

You can't use any other mock response method after calling this method. This restriction is lifted if you call `open()` again.

##### setNetworkError()
Simulates a network error. Changes the request's `readyState` to `DONE`.

Fires the appropriate events including the `error` event.

You can't use any other mock response method after calling this method. This restriction is lifted if you call `open()` again.

##### setRequestTimeout()
Simulates a request timeout. Changes the request's readyState to DONE.

Fires the appropriate events including the `timeout` event.

You can't use any other mock response method after calling this method. This restriction is lifted if you call `open()` again.

#### MockXhr lifecycle hooks
The `MockXhr` lifecycle hooks can be configured at these locations:
1. A property on an instance of `MockXhr`. This affects that instance only.
2. A static property of the `MockXhr` class. This affects all instances of `MockXhr` and its subclasses. You should avoid this method and use the next one below instead.
3. A static property of the `MockXhr` subclass as exposed by [`MockXhrServer.MockXhr`](#mockxhr) or returned by [`newMockXhr()`](#newmockxhr). This affects all instances of that class.

If you define multiple hooks for a lifecycle event, they are called in the same order as the list above.

##### onCreate
Called when an instance of `MockXhr` is created, at end of its constructor. The new `MockXhr` instance is passed as an argument.

You can use this lifecycle hook to capture instances of `MockXhr` when they are constructed.

You can't configure this lifecycle hook as a property on an instance of `MockXhr` because it is called as part of the constructor.

```javascript
import { MockXhr, newMockXhr } from 'mock-xmlhttprequest';
const MockXhrSubclass = newMockXhr();

// Called for all instances of MockXhr and its subclasses
MockXhr.onCreate = (xhr) => { /*...*/ };

// Called for all instances of the MockXhr subclass
MockXhrSubclass.onCreate = (xhr) => { /*...*/ };
```

##### onSend
Called after a call to `MockXhr.send()`. The new `MockXhr` instance is passed as an argument.

You can use this lifecycle hook to respond to a request using the [mock response methods](#mock-response-methods).

This hook is called asynchronously as described in [Asynchronous responses](#asynchronous-responses).

```javascript
import { MockXhr, newMockXhr } from 'mock-xmlhttprequest';
const MockXhrSubclass = newMockXhr();

// Called for all instances of MockXhr and its subclasses
MockXhr.onSend = (xhr) => { /*...*/ };

// Called for all instances of the MockXhr subclass
MockXhrSubclass.onSend = (xhr) => { /*...*/ };

// Called for this instance only
const xhr = new MockXhrSubclass();
xhr.onSend = (xhr) => { /*...*/ };
```

### newMockXhr()
Returns a new `MockXhr` subclass.

Using a subclass of `MockXhr` in each test case makes it easier to ensure they are self-contained. For example setting the [`timeoutEnabled`](#mockxhrtimeoutenabled) static propertiy on a subclass will only affect that subclass and not the other subclasses created in other test cases. You therefore don't need to add cleanup code to revert the changes made to the subclass after each test case.

### newServer(routes)
Returns a new `MockXhrServerserver` with its own `MockXhr` subclass. See [`newMockXhr`](#newmockxhr).

You can add [routes](#routes) to the mock server with the optional `routes` argument. See the [constructor](#mockxhrserverroutes) for details.

## XMLHttpRequest features
Based on the [XMLHTTPRequest specification](https://xhr.spec.whatwg.org) version '18 August 2020'.

### Supported
- Events and states.
- `open()`, `setRequestHeader()`, `send()` and `abort()`.
- [Upload](#uploadprogresstransmitted) and [download](#downloadprogresstransmitted-length) progress events.
- Response status, `statusText`, headers and body.
- The [`timeout` attribute](#the-timeout-attribute-and-request-timeouts) (can be disabled).
- Simulating a network error (see [`MockXhr.setNetworkError()`](#setnetworkerror)).
- Simulating a request timeout (see [`MockXhr.setRequestTimeout()`](#setrequesttimeout)).

### Partial support
- `overrideMimeType()` throws when required, but has no other effect.
- `responseType`: `''`, `'text'` and `'json'` are fully supported. Other `responseType` values can also be used, but they will return the response body passed to [`setResponseBody()`](#setresponsebodybody--null) as-is in `xhr.response`.
- `responseXml`: the response body isn't converted to a document response. To get a document response, pass it directly as the response body in [`setResponseBody()`](#setresponsebodybody--null).
- `responseUrl`, the final request URL after redirects, isn't automatically set. This can be emulated in a request handler.

### Not supported
- Synchronous requests (i.e. `async` set to `false`).
- Parsing the request URL in `open()` and throwing `SyntaxError` on failure.

## Contributing
Contributors are welcome! See [this guide](CONTRIBUTING.md) for more info.

## License
[ISC](LICENSE)
