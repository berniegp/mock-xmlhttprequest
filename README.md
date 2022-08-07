[![Build Status](https://app.travis-ci.com/berniegp/mock-xmlhttprequest.svg?branch=master)](https://app.travis-ci.com/berniegp/mock-xmlhttprequest)

# mock-xmlhttprequest
This library is a mock of `XMLHttpRequest` that provides a simple interface to simulate interactions with `XMLHttpRequest`. It is a drop-in replacement for `XMLHttpRequest` for your tests.

This library implements the `XMLHttpRequest` interface and handles requests and events as specified in the [XMLHTTPRequest specification](https://xhr.spec.whatwg.org) without using real network requests. You can respond to the mock requests in three ways:
- Declarative response configuration using a [mock server](#using-the-mock-server) with [routes](#routes).
- [Programmatic responses](#responding-to-mockxhr-requests-programmatically).
- [Request lifecycle hooks](#mockxhr-lifecycle-hooks).

You can simulate responses, upload progress, errors, and other interactions with the [mock response methods](#mock-response-methods). These automatically handle lower-level processing like emitting events and changing the `readystate` property of `XMLHttpRequest`.

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
    - [Mock API](#mock-api)
    - [MockXhr lifecycle hooks](#mockxhr-lifecycle-hooks)
  - [MockXhrRequest class](#mockxhrrequest-class)
    - [Request data](#request-data)
    - [Mock response methods](#mock-response-methods)
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
    // Installs the server's XMLHttpRequest mock in the "global" context.
    // After this, "new XMLHttpRequest()" creates a mock request to which the server replies.
    server.install(/* optional context; defaults to globalThis */);

    // Do something that send()s an XMLHttpRequest to '/my/url' and returns a Promise
    return functionToTest().then((result) => {
      // This assumes the returned Promise resolves to the parsed JSON response
      assert.equal(result.message, 'Success!');
    });
  } finally {
    // Restore the original XMLHttpRequest
    server.remove();
  }
});
```

## Usage
The `XMLHttpRequest` mock class is [`MockXhr`](#mockxhr-class). It exposes the same interface as `XMLHttpRequest` and is a drop-in replacement to test code that uses `XMLHttpRequest`.

There are two options to control the behavior of `MockXhr` instances:
 - [A mock server](#using-the-mock-server). This is the recommended approach.
 - [`XMLHttpRequest` lifecycle hooks](#using-the-mockxhr-lifecycle-hooks). Use this if you need more control over requests without the features provided by the mock server.

### Using the mock server
The [`MockXhrServer` class](#mockxhrserver-class) implements the mock server. You create a `MockXhrServer` with [`newServer`](#newserverroutes). The `MockXhrServer` automatically responds to `MockXhr` requests and [makes writing tests easy](#quick-start).

The basic structure of tests that use `MockXhrServer` is:
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

There are two approaches to make your code use the `MockXhr` class as a replacement for `XMLHttpRequest`. This allows the `MockXhrServer` to respond to requests:
1. Use [`install()`](#installcontext--globalthis) to globally replace the `XMLHttpRequest` class with the server's `MockXhr` class. At the end of the test case, call [`remove()`](#remove) to restore the original state.
2. If your code allows you to configure how it creates instances of `XMLHttpRequest`, use the `MockXhr` class directly with one of the following `MockXhrServer` properties:
   - [`xhrFactory`](#xhrfactory) is a function that creates a `MockXhr` instance.
   - [`MockXhr`](#mockxhr) is the class of the instances created by `xhrFactory`.

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

[Routes](#routes) define how the `MockXhrServer` responds to `MockXhr` requests. These have three parts:
- An [HTTP request method](#http-request-method).
- A [request URL matcher](#request-url-matcher).
- A [request handler](#request-handler).

When you send a `MockXhr` request, the `MockXhrServer` finds the first route that matches the request's method and URL. It then responds with the route's request handler. You can also set a [default request handler](#setdefaulthandlerhandler). [Request handlers](#request-handler) are defined either declaratively or programmatically.

By default, if a request's `timeout` attribute is set to a non-zero value and `MockXhrServer` doesn't respond to the request, it eventually [times out](#the-timeout-attribute-and-request-timeouts).

There are two ways to add routes to the `MockXhrServer`:
- The `routes` argument of the [`newServer`](#newserverroutes).
- The [`MockXhrServer` methods that add routes](#adding-routes).

The `MockXhrServer` records all `MockXhr` requests it receives in a [request log](#getrequestlog). Use this to validate the `XMLHttpRequest` requests that your code sends.

### Asynchronous responses
Responses to `MockXhr` requests are asynchronous. This reproduces how a real `XMLHttpRequest` request works. You therefore most likely need to use your test framework's asynchronous test support. For example, the relevant documentation for the Mocha test framework [is here](https://mochajs.org/#asynchronous-code).

The `onSend` [lifecycle hook](#mockxhr-lifecycle-hooks) is necessary to respond to `MockXhr` requests. [The mock server](#using-the-mock-server) handles this automatically. The other option is to [use the `MockXhr` lifecycle hooks](#using-the-mockxhr-lifecycle-hooks) directly. In both cases, the `onSend` lifecycle hook executes after the execution context that calls `XMLHttpRequest.send()` is done or cleared. Internally this library uses an immediately resolved `Promise` to get an empty callstack.

### Responding to MockXhr requests programmatically
There are several `MockXhr` methods and properties to respond to requests. These methods allow the following interactions:
- Inspect request parameters.
- Simulate upload and download progress.
- Provide response headers and body.
- Simulate a request timeout or error.

See the [Mock response methods](#mock-response-methods) section for details.

### The `timeout` attribute and request timeouts
By default, if you set the `timeout` attribute of `XMLHttpRequest` in your code, `MockXhr` requests automatically time out after the specified delay. This emits the `timeout` event and cancels the request as described in the specification.

Relying on the passage of time to test how your code handles timeouts generally makes tests brittle and hard to debug. You can instead trigger timeouts programmatically with [`setRequestTimeout()`](#setrequesttimeout).

Disable automatic request timeouts with one of these options:
- Call [`disableTimeout()`](#disabletimeout-and-enabletimeout) on a `MockXhrServer`. This affects all the `MockXhr` instances it handles.
- [`MockXhr.timeoutEnabled = false`](#mockxhrtimeoutenabled). This static property on the `MockXhr` class affects each of its instances.
- Set [`timeoutEnabled`](#timeoutenabled) to `false` on a `MockXhr` instance. This affects that instance only.

### Using the MockXhr lifecycle hooks
This is an alternative usage pattern that does not use the `MockXhrServer`. You instead use the [`MockXhr` lifecycle hooks](#mockxhr-lifecycle-hooks) directly. This requires more code, but you have more control over `MockXhr` requests.

Note that you can also use the `MockXhr` lifecycle hooks together with `MockXhrServer` if you only need to extend the mock server.

Example:
```javascript
import { newMockXhr } from 'mock-xmlhttprequest';
import { functionToTest } from '../src/SomethingToTest';

// Adapt based on your testing framework. This example uses Mocha and Chai's syntax.

it('should produce a success response', () => {
  // Get a "local" MockXhr subclass
  const MockXhr = newMockXhr();

  // Mock JSON response
  MockXhr.onSend = (request) => {
    const responseHeaders = { 'Content-Type': 'application/json' };
    const response = '{ "message": "Success!" }';
    request.respond(200, responseHeaders, response);
  };

  try {
    // Install in the global context so "new XMLHttpRequest()" creates MockXhr instances
    global.XMLHttpRequest = MockXhr;

    // Do something that send()s an XMLHttpRequest to '/my/url' and returns a Promise
    return functionToTest().then((result) => {
      // This assumes the returned Promise resolves to the parsed JSON response
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

Add an initial set of [routes](#routes) to a `MockXhrServer` with the optional `routes` argument. The property keys of the `routes` object are HTTP methods. Each corresponding value is a two-element array containing `[url_matcher, request_handler]`. See also [Request URL matcher](#request-url-matcher) and [Request handler](#request-handler).

Example:
```javascript
const handlerFn = (request) => { request.respond(); };
newServer({
  get: ['/get', { status: 200 }],
  'my-method': ['/my-method', { status: 201 }],
  post: ['/post', [handlerFn, { status: 404 }]],
});
```

##### install(context = globalThis)
Installs the server's `MockXhr` mock in the global context to replace the `XMLHttpRequest` class. Specify a different context with the optional `context` argument. Revert with [remove()](#remove).

##### remove()
Reverts the changes made by [install()](#installcontext--globalthis). Call this after your tests.

##### disableTimeout() and enableTimeout()
Controls whether the `timeout` attribute of a `MockXhr` instance can trigger `timeout` events. See ["The `timeout` attribute and request timeouts"](#the-timeout-attribute-and-request-timeouts).

#### Routes
Routes respond to `MockXhr` requests and have three parts described below.

The route concept is loosely based on the [Express framework](https://expressjs.com/).

##### HTTP request method
Any `string` with a valid [HTTP request method](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol#Request_methods) is allowed. This includes standard methods like `GET`, `POST`, `PUT` and `DELETE`, but also other method names. The standard method names are case insensitive.

##### Request URL matcher
This supports three options:
- A `string` (e.g. `'/my-url'`) to match the request's URL exactly.
- A `RegExp` to match the request's URL.
- A `Function` that returns `true` if the request's URL matches. The function receives the URL as an argument.

##### Request handler
This supports three options:
- An `object` with the response properties. The default values are:

      { status: 200, headers: {}, body: null, statusText: 'OK' }
- A `Function` that calls the [mock response methods](#mock-response-methods) directly. The function receives a [`MockXhrRequest`](#mockxhrrequest-class) instance as an argument.
- An array of `object` and `Function` request handlers. The first request gets the first handler, the second gets the second handler and so on. The last handler is reused when there are more requests than handlers.

These handlers are all equivalent:
```javascript
const handlerObj = {};
const handlerFn = (request) => { request.respond(); };
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
This class is a mock of `XMLHttpRequest`. This section documents its methods and properties that are not in the specification.

#### Mock API
##### MockXhr.timeoutEnabled
This static property controls [automatic timeout](#the-timeout-attribute-and-request-timeouts) of requests of all instances of the class.

##### timeoutEnabled
This property controls [automatic timeout](#the-timeout-attribute-and-request-timeouts) of this `MockXhr` instance.

##### getResponseHeadersHash()
Returns all response headers as an object. The header names are in lower-case.

#### MockXhr lifecycle hooks
The `MockXhr` lifecycle hooks can be configured at these locations:
1. A static property on the `MockXhr` class. This affects all instances of `MockXhr` and all its subclasses.
2. A static property on a `MockXhr` subclass as exposed by [`MockXhrServer.MockXhr`](#mockxhr) or returned by [`newMockXhr()`](#newmockxhr). This affects all instances of that class.
3. A property on an instance of `MockXhr`. This affects that instance only.

If you define multiple hooks for a lifecycle event, they are called in the order from the list above.

You should generally prefer the third option over the second one because it makes it easier to isolate your test cases.

##### onCreate
Called when an instance of `MockXhr` is created, at the end of its constructor. The hook function receives the created `MockXhr` as an argument.

Use this lifecycle hook to intercept instances of `MockXhr` when they are constructed.

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
Called [asynchronously](#asynchronous-responses) after each call to `send()`. Each call to `send()` generates a call to `onSend` with a matching [`MockXhrRequest`](#mockxhrrequest-class) instance as an argument.

Use this lifecycle hook to respond to a request with the [mock response methods](#mock-response-methods).

```javascript
import { MockXhr, newMockXhr } from 'mock-xmlhttprequest';

// Called for all instances of MockXhr and all its subclasses
MockXhr.onSend = (request) => { /*...*/ };

// Called for all instances of this MockXhr subclass
const MockXhrSubclass = newMockXhr();
MockXhrSubclass.onSend = (request) => { /*...*/ };

// Called for this instance only
const xhr = new MockXhrSubclass();
xhr.onSend = (request) => { /*...*/ };
```

### MockXhrRequest class
This class encapsulates an `XMLHttpRequest` request when you call `send()` and provides methods to respond to it programmatically.

#### Request data
##### requestHeaders
A copy of the request's headers. This is an instance of `HeadersContainer`.

##### method
The request's HTTP method.

##### url
The request's URL.

##### body
The request's body.

##### withCredentials
The request's `withCredentials` value.

##### getRequestBodySize()
The request's body size in bytes.

Note: this isn't completely accurate when the `body` is a `multipart/form-data` encoded `FormData`. Headers, encoding, and other factors that contribute to a non-mocked `XMLHttpRequest`'s true `body` size are not considered. You can use this method to get a floor value for the request's true `body` size. This is useful to simulate upload progress events.

#### Mock response methods
These methods provide a programmatic interface to respond to `MockXhr` requests.

##### uploadProgress(transmitted)
Fires a request upload progress event where `transmitted` is the number of bytes transmitted.

You can only call this when the request's `body` isn't `null` and the upload isn't complete.

After you call this method, you can use any other mock response method.

##### respond(status = 200, headers = {}, body = null, statusText = 'OK')
Complete response method that sets both the response headers and body. Changes the request's `readyState` to `DONE`.

Fires the appropriate events such as `readystatechange`, `progress`, and `load`.

This is a shorthand for [`setResponseHeaders()`](#setresponseheadersstatus--200-headers---statustext--ok) followed by [`setResponseBody()`](#setresponsebodybody--null).

After you call this method, you can't use other mock response methods. This restriction is lifted if you call `open()` again.

##### setResponseHeaders(status = 200, headers = {}, statusText = 'OK')
Sets the response headers. Changes the request's `readyState` to `HEADERS_RECEIVED`.

Fires the appropriate events such as `readystatechange`, `progress`, and `load`.

After you call this method, you can use the following mock response methods:
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

After you call this method, you can't use other mock response methods. This restriction is lifted if you call `open()` again.

##### setNetworkError()
Simulates a network error. Changes the request's `readyState` to `DONE`.

Fires the appropriate events including the `error` event.

After you call this method, you can't use other mock response methods. This restriction is lifted if you call `open()` again.

##### setRequestTimeout()
Simulates a request timeout. Changes the request's `readyState` to `DONE`.

Fires the appropriate events including the `timeout` event.

Throws an error if the `request` attribute is equal to 0 since timeouts do not occur in that case.

After you call this method, you can't use other mock response methods. This restriction is lifted if you call `open()` again.

### newMockXhr()
Returns a new `MockXhr` subclass.

If you use a different subclass of `MockXhr` in each test case, it is easier to ensure they are self-contained. For example, if you set the [`timeoutEnabled`](#mockxhrtimeoutenabled) static property on a subclass, it only affects that subclass and not the other subclasses created in other test cases. Since subclasses aren't reused, cleanup code that reverts the changes made to a subclass is not required.

### newServer(routes)
Returns a new `MockXhrServer` with its own unique `MockXhr` subclass. See [`newMockXhr()`](#newmockxhr).

Add [routes](#routes) to the `MockXhrServer` with the optional `routes` argument. See the [constructor](#mockxhrserverroutes) for details.

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
- `responseType`: `''`, `'text'` and `'json'` are fully supported. The `responseType` values have no effect on the response body passed to [`setResponseBody()`](#setresponsebodybody--null).
- `responseXml`: the response body isn't converted to a document response. To get a document response, pass it directly as the response body in [`setResponseBody()`](#setresponsebodybody--null).
- `responseUrl`: the final request URL after redirects isn't automatically set. This can be emulated in a request handler.

### Not supported
- Synchronous requests (i.e. `async` set to `false` in `open()`).
- Parsing the request URL in `open()` and throwing `SyntaxError` on failure.

## Contributing
Contributors are welcome! See [this guide](CONTRIBUTING.md) for more info.

## License
[ISC](LICENSE)
