/*global describe, it, expect, require */
const mergeVars = require('../src/merge-vars');
describe('mergeVars', function () {
	'use strict';
	it('merges vars with a prefix', function () {
		expect(mergeVars({a: 1}, {'v1_b': 'b1', 'v2_b': 'b2'}, 'v2_')).toEqual({a: 1, b: 'b2'});
		expect(mergeVars({a: 1, b: 3}, {'v1_b': 'b1', 'v2_b': 'b2'}, 'v2_')).toEqual({a: 1, b: 'b2'});
		expect(mergeVars({a: 1, b: 3}, {'v1_b': 'b1', 'v2_c': 23, 'v2_b': 'b2'}, 'v2_')).toEqual({a: 1, b: 'b2', c: 23});
		expect(mergeVars({}, {'v1_b': 'b1', 'v2_c': 23, 'v2_b': 'b2'}, 'v2_')).toEqual({b: 'b2', c: 23});
		expect(mergeVars({a: 1, b: 3}, {'v1_b': 'b1', 'v2_c': 23, 'v2_b': 'b2'}, 'v3_')).toEqual({a: 1, b: 3});
		expect(mergeVars({a: 1, b: 3}, {}, 'v3_')).toEqual({a: 1, b: 3});
		expect(mergeVars(undefined, {'v3_a': 1}, 'v3_')).toEqual({a: 1});
		expect(mergeVars(undefined, {'v3_a': 1}, 'v2_')).toEqual({});
		expect(mergeVars({a: 1}, undefined, 'v2_')).toEqual({a: 1});
		expect(mergeVars(undefined, undefined, 'v2_')).toEqual({});
		expect(mergeVars({a: 1, b: 3}, {c: 'd'}, '')).toEqual({a: 1, b: 3});
		expect(mergeVars({a: 1, b: 3}, {c: 'd'}, undefined)).toEqual({a: 1, b: 3});
	});
	it('does not modify its arguments', function () {
		const from = {'v1_a': 1},
			to = {a: 2};
		mergeVars(to, from, 'v1_');
		expect(from).toEqual({'v1_a': 1});
		expect(to).toEqual({a: 2});
	});
});
