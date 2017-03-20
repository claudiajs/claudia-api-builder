/*global describe, it, expect, process, require, beforeEach, spyOn, jasmine */
const Promise = require('bluebird'),
	readline = require('readline'),
	ask = require('../src/ask');
describe('ask', () => {
	'use strict';
	let fakeReadline;
	beforeEach(() => {
		fakeReadline = jasmine.createSpyObj('readline', ['question', 'close']);
		spyOn(readline, 'createInterface').and.returnValue(fakeReadline);
	});
	it('invokes the question without resolving the promise', done => {
		fakeReadline.question.and.callFake(prompt => {
			expect(readline.createInterface).toHaveBeenCalledWith({
				input: process.stdin,
				output: process.stdout
			});
			expect(prompt).toEqual('Hi there ');
			done();
		});
		ask('Hi there', Promise)
			.then(done.fail, done.fail);
	});
	it('rejects when the question throws error', done => {
		fakeReadline.question.and.throwError('BOOM');
		ask('Hi', Promise)
			.then(done.fail, err => expect(err.message).toEqual('BOOM'))
			.then(done);
	});
	it('rejects when the value is blank', done => {
		fakeReadline.question.and.callFake((prompt, callback) => callback(''));
		ask('Number', Promise)
			.then(done.fail, err => expect(err).toEqual('Number must be provided'))
			.then(done);
	});
	it('resolves with the value', done => {
		fakeReadline.question.and.callFake((prompt, callback) => callback('838'));
		ask('Number', Promise)
			.then(val => expect(val).toEqual('838'))
			.then(done, done.fail);
	});
});
