/*global describe, it, expect, process, require, beforeEach, spyOn, jasmine */
var Promise = require('bluebird'),
	readline = require('readline'),
	ask = require('../src/ask');
describe('ask', function () {
	'use strict';
	var fakeReadline;
	beforeEach(function () {
		fakeReadline = jasmine.createSpyObj('readline', ['question', 'close']);
		spyOn(readline, 'createInterface').and.returnValue(fakeReadline);
	});
	it('invokes the question without resolving the promise', function (done) {
		fakeReadline.question.and.callFake(function (prompt) {
			expect(readline.createInterface).toHaveBeenCalledWith({
				input: process.stdin,
				output: process.stdout
			});
			expect(prompt).toEqual('Hi there ');
			done();
		});
		ask('Hi there', Promise).then(done.fail, done.fail);
	});
	it('rejects when the question throws error', function (done) {
		fakeReadline.question.and.throwError('BOOM');
		ask('Hi', Promise).then(done.fail, function (err) {
			expect(err.message).toEqual('BOOM');
		}).then(done);
	});
	it('rejects when the value is blank', function (done) {
		fakeReadline.question.and.callFake(function (prompt, callback) {
			callback('');
		});
		ask('Number', Promise).then(done.fail, function (err) {
			expect(err).toEqual('Number must be provided');
		}).then(done);
	});
	it('resolves with the value', function (done) {
		fakeReadline.question.and.callFake(function (prompt, callback) {
			callback('838');
		});
		ask('Number', Promise).then(function (val) {
			expect(val).toEqual('838');
		}).then(done, done.fail);
	});
});
