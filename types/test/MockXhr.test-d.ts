import { expectType } from 'tsd'

import { newMockXhr } from '../'
import MockXhr from '../MockXhr'

function eventTarget() {
  const xhr = new MockXhr();
  xhr.onreadystatechange = (event) => {
    expectType<string>(event.type);
  }
  xhr.onload = (event) => {
    expectType<string>(event.type);
  }
  xhr.addEventListener('loadEnd', (event) => {
    expectType<string>(event.type);
  })
}
eventTarget();

function eventTargetUploadProperty() {
  const xhr = new MockXhr();
  xhr.upload.onload = (event) => {
    expectType<string>(event.type);
  }
  xhr.upload.addEventListener('loadEnd', (event) => {
    expectType<string>(event.type);
  })
}
eventTargetUploadProperty();

function globalEventHooks() {
  MockXhr.onSend = (xhr: MockXhr) => {
    const responseHeaders = { 'Content-Type': 'application/json' };
    const response = '{ "message": "Success!" }';
    xhr.respond(200, responseHeaders, response);
  };
  delete MockXhr.onSend;

  MockXhr.onCreate = (xhr: MockXhr) => {
    xhr.open('get', '/url');
  };
  delete MockXhr.onCreate;
}
globalEventHooks();

function instanceOnSendEventHook() {
  const xhr = new MockXhr();
  xhr.onSend = (xhr: MockXhr) => {
    const responseHeaders = { 'Content-Type': 'application/json' };
    const response = '{ "message": "Success!" }';
    xhr.respond(200, responseHeaders, response);
  };
  return xhr;
}
instanceOnSendEventHook();

function localClassEventHooks() {
  const LocalMockXhr = newMockXhr();
  LocalMockXhr.onSend = (xhr: MockXhr) => {
    const responseHeaders = { 'Content-Type': 'application/json' };
    const response = '{ "message": "Success!" }';
    xhr.respond(200, responseHeaders, response);
  };
  delete MockXhr.onSend;

  LocalMockXhr.onCreate = (xhr: MockXhr) => {
    xhr.open('get', '/url');
  };
  delete MockXhr.onCreate;
}
localClassEventHooks();

function timeoutEnabled() {
  MockXhr.timeoutEnabled = false
  const xhr = new MockXhr();
  xhr.timeoutEnabled = false;
}
timeoutEnabled();
