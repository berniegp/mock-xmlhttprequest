import { expectError, expectType } from 'tsd'
import MockXhrServer from '../MockXhrServer'

expectType<MockXhrServer.UrlMatcher>('http://foo/bar.com')
expectType<MockXhrServer.UrlMatcher>(/http:/)
expectType<MockXhrServer.UrlMatcher>((url: string) => url === 'http://foo/bar.com')

expectError<MockXhrServer.UrlMatcher>((url: string) => url)
expectError<MockXhrServer.UrlMatcher>(true)
