[![Build Status](https://travis-ci.org/berniegp/mock-xmlhttprequest.svg?branch=master)](https://travis-ci.org/berniegp/mock-xmlhttprequest)

# mock-xmlhttprequest
This library is a mock of `XMLHttpRequest` that provides a simple interface to simulate interactions with `XMLHttpRequest`. It is meant as a drop-in replacement for `XMLHttpRequest` for your tests.

This library implements the `XMLHttpRequest` interface and handles requests and events as specified in the [XMLHTTPRequest specification](https://xhr.spec.whatwg.org) without using real network requests. You can respond to the mock requests using:
- Declarative response configuration using a [mock server](#using-the-mock-server) with [routes](#routes).
- [Programmatic responses](#responding-to-mockxhr-requests-programmatically).
- [Request lifecycle hooks](#mockxhr-lifecycle-hooks).

You can simulate responses, upload progress, errors, etc. with the [mock response methods](#mock-response-methods). These automatically handle lower-level processing like emitting events and changing the `readystate` property of `XMLHttpRequest`.

## Table of contents
- [Installation](#installation)
- [Quick start](#quick-start)
- [Usage](#usage)
  - [Using the mock server](#using-the-mock-server)
  - [Asynchronous responses](#asynchronous-responses)
  - [Responding to MockXhr requests programmatically](#responding-to-mockxhr-requests-programmatically)
  - [The `timeout` attribute and request timeouts](#the-timeout-attribute-and-request-timeouts)
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
import { functionToTest } from '../src/SomethingToTest';

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
      // Assuming the returned Promise resolves to the parsed JSON response
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

There are two options for controlling the behavior of `MockXhr` instances:
 - [A mock server](#using-the-mock-server). This is the recommended approach.
 - [`XMLHttpRequest` lifecycle hooks](#using-the-mockxhr-lifecycle-hooks). Use this if you need more control over requests without the features provided by the mock server.

### Using the mock server
The `MockXhrServer` class implements the mock server. You create a `MockXhrServer` with [`newServer`](#newserverroutes). The `MockXhrServer` automatically responds to `MockXhr` requests and [makes writing tests easy](#quick-start).

The basic structure of tests using `MockXhrServer` is:
```javascript
import { newServer } from 'mock-xmlhttprequest';

const server = newServer( /* routes */ );
try {
  server.install( /* optional context; defaults to globalThis */ );
  // Test your code that creates XMLHttpRequests
} finally {
  // Reverts server.install() at the end of the test.
  // Only do this after the test case has finished creating XMLHttpRequests.
  server.remove();
}
```

There are two approaches to make your code use the `MockXhr` class instead of `XMLHttpRequest` so the `MockXhrServer` can then respond to requests:
1. Use [`install()`](#installcontext--globalthis) to globally replace the `XMLHttpRequest` class with the server's `MockXhr` class. At the end of the test case, call [`remove()`](#remove) to restore the original state.
2. If your code supports configuring how it creates instances of `XMLHttpRequest`, use the `MockXhr` class directly with one of the following `MockXhrServer` properties:
   - [`xhrFactory`](#xhrfactory) is a function that creates a `MockXhr` instance.
   - [`MockXhr`](#mockxhr) is the class of the instances created by `xhrFactory`.

This code demonstrates the usage of `xhrFactory`:
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

You define how the `MockXhrServer` responds to `MockXhr` requests using [routes](#routes). These have three parts:
- An [HTTP request method](#http-request-method).
- A [request URL matcher](#request-url-matcher).
- A [request handler](#request-handler).

When you send a `MockXhr` request, the `MockXhrServer` finds the first route that matches the request's method and URL, and then responds using the corresponding request handler. You can also set a [default request handler](#setdefaulthandlerhandler). You define [request handlers](#request-handler) either declaratively or programmatically.

If the `MockXhrServer` doesn't respond to a `MockXhr` request and [request timeouts](#the-timeout-attribute-and-request-timeouts) are enabled, the request will eventually time out.

To add routes to the `MockXhrServer`:
- Use the `routes` argument of the [`newServer`](#newserverroutes).
- Use the [`MockXhrServer` methods that add routes](#adding-routes).

The `MockXhrServer` records all `MockXhr` requests it receives in a [request log](#getrequestlog). You can use this to validate the `XMLHttpRequest` requests sent from your code.

### Asynchronous responses
Responses to `MockXhr` requests are asynchronous. This reproduces how a real `XMLHttpRequest` request works. You will therefore most likely need to use your test framework's asynchronous test support. For example, this is [explained here for Mocha](https://mochajs.org/#asynchronous-code).

Responding to `MockXhr` requests uses the `onSend` [lifecycle hook](#mockxhr-lifecycle-hooks). If you [use the mock server](#using-the-mock-server), this is mostly transparent. The other option is to [use the `MockXhr` lifecycle hooks](#using-the-mockxhr-lifecycle-hooks) directly. In both cases, the `onSend` lifecycle hook executes after the execution context that calls `XMLHttpRequest.send()` is done or cleared. Internally this library uses an immediately resolved `Promise` to get an empty callstack.

### Responding to MockXhr requests programmatically
There are several `MockXhr` methods and properties to respond to requests. With these methods, you can:
- Inspect request parameters.
- Simulate upload and download progress.
- Provide response headers and body.
- Simulate a request timeout or error.

See the [Mock response methods](#mock-response-methods) section for details.

### The `timeout` attribute and request timeouts
By default, if you set the `timeout` attribute of `XMLHttpRequest` in your code, `MockXhr` instances will automatically time out after the specified delay. This will emit the `timeout` event and cancel the request as described in the specification.

Relying on the passage of time to test how your code handles timeouts generally makes tests brittle and hard to debug. You can instead trigger timeouts programmatically using [`setRequestTimeout()`](#setrequesttimeout).

To disable automatic request timeouts:
- Call [`disableTimeout()`](#disabletimeout-and-enabletimeout) on a `MockXhrServer`. This affects all the `MockXhr` instances it handles.
- [`MockXhr.timeoutEnabled = false`](#mockxhrtimeoutenabled). This static property on the `MockXhr` class affects each of its instances.
- Set [`timeoutEnabled`](#timeoutenabled) to `false` on a `MockXhr` instance. This affects that instance only.

### Using the MockXhr lifecycle hooks
This is an alternative usage pattern using only the `MockXhr` class instead of `MockXhrServer`. You instead use the [`MockXhr` lifecycle hooks](#mockxhr-lifecycle-hooks) directly. This requires more code, but you can have more control over `MockXhr` requests without the features provided by `MockXhrServer`.

Note that you can also use the `MockXhr` lifecycle hooks in conjunction with `MockXhrServer` if you only wish to extend it.

Quick start example:
```javascript
import { newMockXhr } from 'mock-xmlhttprequest';
import { functionToTest } from '../src/SomethingToTest';

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
    // Install in the global context so "new XMLHttpRequest()" creates MockXhr instances
    global.XMLHttpRequest = MockXhr;

    // Do something that send()s an XMLHttpRequest to '/my/url' and returns a Promise
    return functionToTest().then((result) => {
      // Assuming the returned Promise resolves to the parsed JSON response
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
In most cases you should use [`newServer`](#newserverroutes) instead of this constructor directly.

You can add [routes](#routes) to a `MockXhrServer` with the optional `routes` argument. The property keys of the `routes` object are HTTP methods. Each corresponding value is a two-element array containing `[url_matcher, request_handler]`. See also [Request URL matcher](#request-url-matcher) and [Request handler](#request-handler).

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
Installs the server's `MockXhr` mock in the global context to replace the `XMLHttpRequest` class. You can specify a different context with the optional `context` argument. Revert with [remove()](#remove).

##### remove()
Reverts the changes made by [install()](#installcontext--globalthis). Call this after your tests.

##### disableTimeout() and enableTimeout()
Controls whether setting the `timeout` attribute of a mocked `XMLHttpRequest` can trigger `timeout` events. See ["The `timeout` Attribute and Request Timeouts"](#the-timeout-attribute-and-request-timeouts).

#### Routes
Routes respond to `MockXhr` requests and have three parts.

The route concept is loosely based on the [Express framework](https://expressjs.com/).

##### HTTP request method
Any `string` with a valid [HTTP request method](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol#Request_methods) is allowed. This includes standard methods like `GET`, `POST`, `PUT` and `DELETE`, but also other method names.

##### Request URL matcher
This can be:
- A `string` (e.g. `'/my-url'`) to match the request's URL exactly.
- A `RegExp` to match the request's URL.
- A `Function` that returns `true` if the request's URL matches. The function receives the URL as an argument.

##### Request handler
This can be:
- An `object` with the response properties. The default values are:

      { status: 200, headers: {}, body: null, statusText: 'OK' }
- A `Function` that calls the [mock response methods](#mock-response-methods) directly. The function receives the `MockXhr` request as an argument.
- An array of `object` and `Function` request handlers. The first matching request gets the first handler, the second gets the second handler and so on. The last handler is reused if there are more requests than handlers in the array.

These handlers are all equivalent:
```javascript
const handlerObj = {};
const handlerFn = (xhr) => { xhr.respond(); };
const handlerArray = [{}];
```

#### Adding routes
##### get(urlMatcher, handler)
Adds a [route](#routes) for the `GET` HTTP method.

##### post(urlMatcher, handler)
Adds a [route](#routes) for the `POST` HTTP method.

##### put(urlMatcher, handler)
Adds a [route](#routes) for the `PUT` HTTP method.

##### delete(urlMatcher, handler)
Adds a [route](#routes) for the `DELETE` HTTP method.

##### addHandler(method, urlMatcher, handler)
Adds a [route](#routes) for the `method` HTTP method.

##### setDefaultHandler(handler)
Sets a default request handler for requests that don't match any route.

##### setDefault404()
Sets a [default request handler](#setdefaulthandlerhandler) that returns 404 responses.

#### Utilities
##### xhrFactory
Function that returns a new `MockXhr` instance.

##### MockXhr
The `MockXhr` class that the server handles. This is the class of the instances created by [`xhrFactory`](#xhrfactory).

##### getRequestLog()
Returns an array of all requests received by the server so far. Each array element is an object with these properties:
- `method`: HTTP method `string`.
- `url`: URL `string`.
- `body`: request body
- `headers`: request headers as an object. The header names are in lower-case.

### MockXhr class
This class is a mock of `XMLHttpRequest`. This section documents its methods and properties that are not part of the specification.

#### MockXhr options
##### MockXhr.timeoutEnabled
This static property controls [automatic timeout](#the-timeout-attribute-and-request-timeouts) of requests of all instances of the class.

##### timeoutEnabled
This property controls [automatic timeout](#the-timeout-attribute-and-request-timeouts) of this `MockXhr` instance.

#### Request inspection
##### requestHeaders
A copy of the request's headers. This is an instance of `HeadersContainer`.

##### method
The request's HTTP method.

##### url
The request's URL.

##### body
The request's body.

##### getRequestBodySize()
Returns the current request's body size in bytes.

Note: this isn't completely accurate when the `body` is `multipart/form-data` encoded `FormData`. `MockXhr` doesn't consider headers, encoding, and other factors that influence the request `body` size of non-mocked `XMLHttpRequest`s. You can consider the value returned by this method as a floor value for the request's `body` size. This can still be useful to simulate upload progress events.

##### getResponseHeadersHash()
Returns all response headers as an object. The header names are in lower-case.

#### Mock response methods
These methods provide a programmatic interface to respond to `MockXhr` requests.

##### uploadProgress(transmitted)
Fires a request upload progress event where `transmitted` is the number of bytes transmitted.

You can only call this when the request's `body` isn't empty and the upload isn't complete.

You can use any other mock response method after calling this method.

##### respond(status = 200, headers = {}, body = null, statusText = 'OK')
Complete response method that sets the response headers and body. Changes the request's `readyState` to `DONE`.

Fires the appropriate events such as `readystatechange`, `progress`, and `load`.

This is a shorthand for [`setResponseHeaders()`](#setresponseheadersstatus--200-headers---statustext--ok) followed by [`setResponseBody()`](#setresponsebodybody--null).

You can't use other mock response method after calling this method. This restriction is lifted if you call `open()` again.

##### setResponseHeaders(status = 200, headers = {}, statusText = 'OK')
Sets the response headers. Changes the request's `readyState` to `HEADERS_RECEIVED`.

Fires the appropriate events such as `readystatechange`, `progress`, and `load`.

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

Fires the appropriate events such as `readystatechange`, `progress`, and `load`.

Calls [`setResponseHeaders()`](#setresponseheadersstatus--200-headers---statustext--ok) if not already called.

You can't use other mock response method after calling this method. This restriction is lifted if you call `open()` again.

##### setNetworkError()
Simulates a network error. Changes the request's `readyState` to `DONE`.

Fires the appropriate events including the `error` event.

You can't use other mock response method after calling this method. This restriction is lifted if you call `open()` again.

##### setRequestTimeout()
Simulates a request timeout. Changes the request's `readyState` to `DONE`.

Fires the appropriate events including the `timeout` event.

You can't use other mock response method after calling this method. This restriction is lifted if you call `open()` again.

#### MockXhr lifecycle hooks
The `MockXhr` lifecycle hooks can be configured at these locations:
1. A property on an instance of `MockXhr`. This affects that instance only.
2. A static property on the `MockXhr` class. This affects all instances of `MockXhr` and all its subclasses.
3. A static property on the `MockXhr` subclass as exposed by [`MockXhrServer.MockXhr`](#mockxhr) or returned by [`newMockXhr()`](#newmockxhr). This affects all instances of that class.

If you define multiple hooks for a lifecycle event, they are called in the same order as the list above.

You should generally prefer the third option to the second one because it makes isolating your test cases easier.

##### onCreate
Called when an instance of `MockXhr` is created, at the end of its constructor. The hook function receives the created `MockXhr` as an argument.

You can use this lifecycle hook to capture instances of `MockXhr` when they are constructed.

This lifecycle hook does not exist as a `MockXhr` instance property because it is called as part of an instance's constructor.

```javascript
import { MockXhr, newMockXhr } from 'mock-xmlhttprequest';

// Called for all instances of MockXhr and all its subclasses
MockXhr.onCreate = (xhr) => { /*...*/ };

// Called for all instances of this MockXhr subclass
const MockXhrSubclass = newMockXhr();
MockXhrSubclass.onCreate = (xhr) => { /*...*/ };
```

##### onSend
Called [asynchronously](#asynchronous-responses) after a call to `MockXhr.send()`. The hook function receives the `MockXhr` instance as an argument.

You can use this lifecycle hook to respond to a request using the [mock response methods](#mock-response-methods).

```javascript
import { MockXhr, newMockXhr } from 'mock-xmlhttprequest';

// Called for all instances of MockXhr and all its subclasses
MockXhr.onSend = (xhr) => { /*...*/ };

// Called for all instances of this MockXhr subclass
const MockXhrSubclass = newMockXhr();
MockXhrSubclass.onSend = (xhr) => { /*...*/ };

// Called for this instance only
const xhr = new MockXhrSubclass();
xhr.onSend = (xhr) => { /*...*/ };
```

### newMockXhr()
Returns a new `MockXhr` subclass.

Using a different subclass of `MockXhr` in each test case makes it easier to ensure they are self-contained. For example setting the [`timeoutEnabled`](#mockxhrtimeoutenabled) static property on a subclass will only affect that subclass and not the other subclasses created in other test cases. This removes the need for cleanup code that reverts the changes made to a subclass because it is not reused after a test case.

### newServer(routes)
Returns a new `MockXhrServer` with its own unique `MockXhr` subclass. See [`newMockXhr()`](#newmockxhr).

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
- `responseType`: `''`, `'text'` and `'json'` are fully supported. The `responseType` values will have no effect on the response body passed to [`setResponseBody()`](#setresponsebodybody--null).
- `responseXml`: the response body isn't converted to a document response. To get a document response, pass it directly as the response body in [`setResponseBody()`](#setresponsebodybody--null).
- `responseUrl`: the final request URL after redirects isn't automatically set. This can be emulated in a request handler.

### Not supported
- Synchronous requests (i.e. `async` set to `false` in `open()`).
- Parsing the request URL in `open()` and throwing `SyntaxError` on failure.

## Contributing
Contributors are welcome! See [this guide](CONTRIBUTING.md) for more info.

## License
[ISC](LICENSE)
