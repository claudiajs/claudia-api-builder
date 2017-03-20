/*global describe, it, require, expect */
const underTest = require('../src/valid-http-code');
describe('validHttpCode', () => {
	'use strict';
	it('returns true for integers 200-599', () => {
		expect(underTest(199)).toBeFalsy();
		expect(underTest(0)).toBeFalsy();
		expect(underTest(-1)).toBeFalsy();
		expect(underTest(200)).toBeTruthy();
		expect(underTest(201)).toBeTruthy();
		expect(underTest(500)).toBeTruthy();
		expect(underTest(599)).toBeTruthy();
		expect(underTest(600)).toBeFalsy();
	});
	it('returns true for 200-599 strings as numbers', () => {
		expect(underTest('199')).toBeFalsy();
		expect(underTest('0')).toBeFalsy();
		expect(underTest('-1')).toBeFalsy();
		expect(underTest('200')).toBeTruthy();
		expect(underTest('201')).toBeTruthy();
		expect(underTest('500')).toBeTruthy();
		expect(underTest('599')).toBeTruthy();
		expect(underTest('600')).toBeFalsy();
	});
	it('returns false for structures', () => {
		expect(underTest({})).toBeFalsy();
		expect(underTest([])).toBeFalsy();
		expect(underTest({a: 1})).toBeFalsy();
		expect(underTest([1, 2, 3])).toBeFalsy();
	});
	it('returns false for non-numeric strings', () => {
		expect(underTest('abc')).toBeFalsy();
		expect(underTest('def203')).toBeFalsy();
		expect(underTest('201.4def')).toBeFalsy();
	});
	it('returns false for floats and float strings', () => {
		expect(underTest(302.3)).toBeFalsy();
		expect(underTest('302.3')).toBeFalsy();
	});
	it('returns false for booleans and falsy values', () => {
		expect(underTest(true)).toBeFalsy();
		expect(underTest(false)).toBeFalsy();
	});
});
