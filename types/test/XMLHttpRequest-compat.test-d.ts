// import { expectError } from 'tsd'
import { newMockXhr } from '../'

const xhr = newMockXhr();

// Can be used to validate structural compliance with XMLHttpRequest interface
// Requires the "dom" lib in the TypeScript compilerOptions
// expectError<XMLHttpRequest>(xhr); //not yet compatible
xhr.status;
