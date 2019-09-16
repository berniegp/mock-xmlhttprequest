// import { expectError } from 'tsd'
import MockXhr from '../MockXhr'

const xhr = new MockXhr();

// Can be used to validate structural compliance with XMLHttpRequest interface
// Requires the "dom" lib in the TypeScript compilerOptions
// expectError<XMLHttpRequest>(xhr); //not yet compatible
xhr.status;
