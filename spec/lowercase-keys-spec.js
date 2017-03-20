/*global describe, it, expect, require */
const lowercaseKeys = require('../src/lowercase-keys');
describe('lowercaseKeys', () => {
	'use strict';
	it('produces a blank object with literal values', () => {
		expect(lowercaseKeys(1)).toEqual({});
		expect(lowercaseKeys(null)).toEqual({});
		expect(lowercaseKeys(false)).toEqual({});
		expect(lowercaseKeys(true)).toEqual({});
		expect(lowercaseKeys('true')).toEqual({});
	});
	it('produces a blank object with arrays', () => {
		expect(lowercaseKeys([1, 2, 'abc'])).toEqual({});
	});
	it('downcases keys on an object', () => {
		expect(lowercaseKeys({ blah: 'Yes', BaBx: 'Nope', 'X-123': 'al'})).toEqual({ blah: 'Yes', babx: 'Nope', 'x-123': 'al'});
	});
});
