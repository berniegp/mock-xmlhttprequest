import { expectError } from 'tsd'
import { newMockXhr } from '../'

const xhr = newMockXhr()

//can be used to validate structural compliance with XMLHttpRequest interface
expectError<XMLHttpRequest>(xhr) //not yet compatible
