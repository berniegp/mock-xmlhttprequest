import { expectType } from 'tsd'
import { MockXhr, MockXhrServer, newMockXhr, newServer } from '../'

expectType<MockXhr>(newMockXhr());

expectType<MockXhrServer>(newServer());
const handlerFn = (xhr: MockXhr) => { xhr.respond(); };
expectType<MockXhrServer>(newServer({
    get: ['/get', { status: 200 }],
    'my-method': ['/my-method', { status: 201 }],
    post: ['/post', [handlerFn, { status: 404 }]],
}));
