/*global describe, it, expect, jasmine, require, beforeEach */
var ApiBuilder = require('../src/api-builder'),
	Promise = require('bluebird');
describe('ApiBuilder', function () {
	'use strict';
	var underTest, requestHandler, lambdaContext, requestPromise, requestResolve, requestReject,
		postRequestHandler;
	beforeEach(function () {
		underTest = new ApiBuilder();
		requestHandler = jasmine.createSpy('handler');
		postRequestHandler = jasmine.createSpy('postHandler');
		lambdaContext = jasmine.createSpyObj('lambdaContext', ['done']);
		requestPromise = new Promise(function (resolve, reject) {
			requestResolve = resolve;
			requestReject = reject;
		});
	});
	describe('configuration', function () {
		it('carries version 2', function () {
			expect(underTest.apiConfig().version).toEqual(2);
		});
		it('can configure a single GET method', function () {
			underTest.get('/echo', requestHandler);
			expect(underTest.apiConfig().routes).toEqual({
				'echo': { 'GET': {}}
			});
		});
		it('can configure a single route with multiple methods', function () {
			underTest.get('/echo', requestHandler);
			underTest.post('/echo', postRequestHandler);
			expect(underTest.apiConfig().routes).toEqual({
				'echo': {'GET' : {}, 'POST': {}}
			});
		});
		it('can override existing route', function () {
			underTest.get('/echo', requestHandler);
			underTest.get('/echo', postRequestHandler);
			expect(underTest.apiConfig().routes).toEqual({
				'echo': { 'GET': {}}
			});
		});
		it('can accept a route without a slash', function () {
			underTest.get('echo', requestHandler);
			expect(underTest.apiConfig().routes).toEqual({
				'echo': { 'GET': {}}
			});
		});
		it('can accept routes in mixed case', function () {
			underTest.get('EcHo', requestHandler);
			expect(underTest.apiConfig().routes).toEqual({
				'EcHo': { 'GET': {}}
			});
		});
		it('records options', function () {
			underTest.get('echo', requestHandler, {errorCode: 403});
			expect(underTest.apiConfig().routes).toEqual({
				'echo': { 'GET': {errorCode: 403}}
			});
		});
	});
	describe('routing calls', function () {
		var apiRequest;
		beforeEach(function () {
			underTest.get('/echo', requestHandler);
			apiRequest = {
				context: {
					path: '/echo',
					method: 'GET'
				},
				queryString: {
					a: 'b'
				}
			};
		});
		it('can route to /', function () {
			underTest.get('/', postRequestHandler);
			apiRequest.context.path = '/';
			underTest.router(apiRequest, lambdaContext);
			expect(postRequestHandler).toHaveBeenCalledWith(apiRequest);
		});
		it('complains about an unsuported route', function () {
			apiRequest.context.path = '/no';
			underTest.router(apiRequest, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(
				{type: 'InvalidRequest', message: 'no handler for /no:GET'});
		});
		it('can route calls to a single GET method', function () {
			underTest.router(apiRequest, lambdaContext);
			expect(requestHandler).toHaveBeenCalledWith(apiRequest);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, undefined);
		});
		it('can route calls in mixed case', function () {
			underTest.get('/CamelCase', postRequestHandler);
			apiRequest.context.path = '/CamelCase';
			underTest.router(apiRequest, lambdaContext);
			expect(postRequestHandler).toHaveBeenCalledWith(apiRequest);
		});
		it('can route calls configured without a slash', function () {
			underTest.post('echo', postRequestHandler);
			apiRequest.context.method = 'POST';
			underTest.router(apiRequest, lambdaContext);
			expect(postRequestHandler).toHaveBeenCalledWith(apiRequest);
			expect(requestHandler).not.toHaveBeenCalled();
			expect(lambdaContext.done).toHaveBeenCalledWith(null, undefined);
		});
		it('can route to multiple methods', function () {
			underTest.post('/echo', postRequestHandler);
			apiRequest.context.method = 'POST';
			underTest.router(apiRequest, lambdaContext);
			expect(postRequestHandler).toHaveBeenCalledWith(apiRequest);
			expect(requestHandler).not.toHaveBeenCalled();
			expect(lambdaContext.done).toHaveBeenCalledWith(null, undefined);
		});
		it('can route to multiple routes', function () {
			underTest.post('/echo2', postRequestHandler);
			apiRequest.context.path = '/echo2';
			apiRequest.context.method = 'POST';
			underTest.router(apiRequest, lambdaContext);
			expect(postRequestHandler).toHaveBeenCalledWith(apiRequest);
			expect(requestHandler).not.toHaveBeenCalled();
			expect(lambdaContext.done).toHaveBeenCalledWith(null, undefined);
		});
		it('can handle synchronous exceptions in the routed method', function () {
			requestHandler.and.throwError('Error');
			underTest.router(apiRequest, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(jasmine.any(Error), undefined);
		});
		it('can handle successful synchronous results from the request handler', function () {
			requestHandler.and.returnValue({hi: 'there'});
			underTest.router(apiRequest, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, {hi: 'there'});
		});
		it('handles response promises without resolving', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router(apiRequest, lambdaContext);
			Promise.resolve().then(function () { /* trick async execution to wait for the previous promise cycle */
				expect(lambdaContext.done).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('checks that .then is actually a function to distinguish promises from false positives', function () {
			requestHandler.and.returnValue({then: 1});
			underTest.router(apiRequest, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, {then: 1});
		});
		it('handles request promise rejecting', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith('Error', undefined);
			}).then(done, done.fail);
			requestReject('Error');
		});
		it('handles request promise resolving', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {hi: 'there'});
			}).then(done, done.fail);
			requestResolve({hi: 'there'});
		});
	});
});
