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
	describe('methods', function () {
		it('should include a `get` method', function () {
			expect(typeof underTest.get).toEqual('function');
		});
		it('should include a `put` method', function () {
			expect(typeof underTest.put).toEqual('function');
		});
		it('should include a `post` method', function () {
			expect(typeof underTest.post).toEqual('function');
		});
		it('should include a `delete` method', function () {
			expect(typeof underTest.delete).toEqual('function');
		});
		it('should include a `head` method', function () {
			expect(typeof underTest.head).toEqual('function');
		});
		it('should include a `patch` method', function () {
			expect(typeof underTest.patch).toEqual('function');
		});
	});
	describe('configuration', function () {
		it('carries version 3', function () {
			expect(underTest.apiConfig().version).toEqual(3);
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
	describe('routing methods', function () {
		['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'HEAD'].forEach(function (method) {
			it('can route calls to a ' + method + '  method', function () {
				var apiRequest = {
					context: {
						path: '/test',
						method: method
					},
					queryString: {
						a: 'b'
					}
				};
				underTest[method.toLowerCase()]('/test', requestHandler);
				underTest.router(apiRequest, lambdaContext);
				expect(requestHandler).toHaveBeenCalledWith(apiRequest);
				expect(lambdaContext.done).toHaveBeenCalledWith(null, undefined);
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
			expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: {hi: 'there'}});
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
			expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: {then: 1}});
		});
		it('handles request promise rejecting', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(new Error('Error'), undefined);
			}).then(done, done.fail);
			requestReject('Error');
		});
		it('handles request promise resolving', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: {hi: 'there'}});
			}).then(done, done.fail);
			requestResolve({hi: 'there'});
		});
		it('handles synchronous result/header responses', function () {
			requestHandler.and.returnValue(new underTest.ApiResponse({hi: 'there'}, {'content-type': 'text/markdown'}));
			underTest.router(apiRequest, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: {hi: 'there'}, headers: {'content-type': 'text/markdown'}});
		});
		it('handles promise result/header resolutions', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: {hi: 'there'}, headers: {'content-type': 'text/markdown'}});
			}).then(done, done.fail);
			requestResolve(new underTest.ApiResponse({hi: 'there'}, {'content-type': 'text/markdown'}));
		});
	});
	describe('custom headers', function () {
		beforeEach(function () {
			underTest.get('/success-default', requestHandler, {success: {headers: { 'content-type': 'text/markdown', 'set-cookie': 'false'}}});
			underTest.get('/success-no-default', requestHandler, {success: {headers: ['content-type', 'set-cookie']}});
			underTest.get('/error-default', requestHandler, {error: {headers: { 'content-type': 'text/plain', 'set-cookie': 'true'}}});
			underTest.get('/error-no-default', requestHandler, {error: {headers: ['content-type', 'set-cookie']}});

		});
		it('appends default header values if no response', function () {
			underTest.router({ context: { path: '/success-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, {headers: {'content-type': 'text/markdown', 'set-cookie': 'false'}});
		});
		it('appends default header values to success headers if no headers specified by the response', function () {
			requestHandler.and.returnValue('hi there');
			underTest.router({ context: { path: '/success-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: 'hi there', headers: {'content-type': 'text/markdown', 'set-cookie': 'false'}});
		});
		it('lets the handler override individual header values', function () {
			requestHandler.and.returnValue(new underTest.ApiResponse('hi there', {'content-type': 'text/html'}));
			underTest.router({ context: { path: '/success-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: 'hi there', headers: {'content-type': 'text/html', 'set-cookie': 'false'}});
		});
		it('lets a promise override individual header values', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router({ context: { path: '/success-default', method: 'GET' }}, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: {hi: 'there'}, headers: {'content-type': 'text/html', 'set-cookie': 'false'}});
			}).then(done, done.fail);
			requestResolve(new underTest.ApiResponse({hi: 'there'}, {'content-type': 'text/html'}));
		});
		it('lets the handler set values even if there is no default', function () {
			requestHandler.and.returnValue(new underTest.ApiResponse('hi there', {'content-type': 'text/html'}));
			underTest.router({ context: { path: '/success-no-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: 'hi there', headers: {'content-type': 'text/html'}});
		});
		it('appends default header values to error headers if no headers specified by the response', function () {
			var errorObj;
			requestHandler.and.throwError('Abort');
			underTest.router({ context: { path: '/error-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalled();
			errorObj = lambdaContext.done.calls.argsFor(0)[0];
			expect(Object.getPrototypeOf(errorObj)).toBe(Error.prototype);
			expect(errorObj.name).toEqual('Error');
			expect(errorObj.message).toEqual('Abort');
			expect(errorObj.headers).toEqual({'content-type': 'text/plain', 'set-cookie': 'true'});
		});
		it('does not appends headers to errors if no defaults', function () {
			var errorObj;
			requestHandler.and.throwError('Abort');
			underTest.router({ context: { path: '/error-no-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalled();
			errorObj = lambdaContext.done.calls.argsFor(0)[0];
			expect(Object.getPrototypeOf(errorObj)).toBe(Error.prototype);
			expect(errorObj.name).toEqual('Error');
			expect(errorObj.message).toEqual('Abort');
			expect(errorObj.headers).toBeUndefined();
		});
		it('allows the handler to override default error header values', function () {
			var errorObj;
			requestHandler.and.callFake(function () {
				throw new underTest.ApiResponse('Abort', {'content-type': 'text/xml'});
			});
			underTest.router({ context: { path: '/error-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalled();
			errorObj = lambdaContext.done.calls.argsFor(0)[0];
			expect(Object.getPrototypeOf(errorObj)).toBe(Error.prototype);
			expect(errorObj.name).toEqual('Error');
			expect(errorObj.message).toEqual('Abort');
			expect(errorObj.headers).toEqual({'content-type': 'text/xml', 'set-cookie': 'true'});
		});

		it('appends default header values to promise reject values if no headers specified by the response', function (done) {
			var errorObj;
			requestHandler.and.returnValue(requestPromise);
			underTest.router({ context: { path: '/error-no-default', method: 'GET' } }, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalled();
				errorObj = lambdaContext.done.calls.argsFor(0)[0];
				expect(Object.getPrototypeOf(errorObj)).toBe(Error.prototype);
				expect(errorObj.name).toEqual('Error');
				expect(errorObj.message).toEqual('Abort');
				expect(errorObj.headers).toBeUndefined();
			}).then(done, done.fail);
			requestReject('Abort');
		});
		it('allows handler promise reject to override default error header values', function (done) {
			var errorObj;
			requestHandler.and.returnValue(requestPromise);
			underTest.router({ context: { path: '/error-default', method: 'GET' } }, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalled();
				errorObj = lambdaContext.done.calls.argsFor(0)[0];
				expect(Object.getPrototypeOf(errorObj)).toBe(Error.prototype);
				expect(errorObj.name).toEqual('Error');
				expect(errorObj.message).toEqual('Abort');
				expect(errorObj.headers).toEqual({'content-type': 'text/xml', 'set-cookie': 'true'});
			}).then(done, done.fail);
			requestReject(new underTest.ApiResponse('Abort', {'content-type': 'text/xml'}));
		});
	});
});
