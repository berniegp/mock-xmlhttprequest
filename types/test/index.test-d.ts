import { expectType } from 'tsd'
import { MockXhr, MockXhrServer, newMockXhr, newServer } from '../'

expectType<MockXhr>(newMockXhr())
expectType<MockXhrServer>(newServer(newMockXhr()))
