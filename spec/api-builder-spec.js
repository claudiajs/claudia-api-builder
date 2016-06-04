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
			expect(lambdaContext.done).toHaveBeenCalledWith('no handler for GET /no');
		});
		it('complains about an unsupported call', function () {
			underTest.router({}, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith('event must contain context.path and context.method');
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
			expect(lambdaContext.done).toHaveBeenCalledWith(jasmine.any(Error));
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
				expect(lambdaContext.done).toHaveBeenCalledWith('Abort');
			}).then(done, done.fail);
			requestReject('Abort');
		});
		it('handles request promise resolving', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {hi: 'there'});
			}).then(done, done.fail);
			requestResolve({hi: 'there'});
		});

	});
	describe('custom headers', function () {
		beforeEach(function () {
			underTest.get('/no-headers', requestHandler);
			underTest.get('/success-default', requestHandler, {success: {headers: { 'content-type': 'text/markdown', 'set-cookie': 'false'}}});
			underTest.get('/success-no-default', requestHandler, {success: {headers: ['content-type', 'set-cookie']}});
			underTest.get('/error-default', requestHandler, {error: {headers: { 'content-type': 'text/plain', 'set-cookie': 'true'}}});
			underTest.get('/error-no-default', requestHandler, {error: {headers: ['content-type', 'set-cookie']}});
		});
		it('handles synchronous result/header responses for headers without defaults', function () {
			requestHandler.and.returnValue(new underTest.ApiResponse({hi: 'there'}, {'content-type': 'text/markdown'}));
			underTest.router({ context: { path: '/success-no-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: {hi: 'there'}, headers: {'content-type': 'text/markdown'}});
		});
		it('handles promise result/header resolutions for headers without defaults', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router({ context: { path: '/success-no-default', method: 'GET' } }, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: {hi: 'there'}, headers: {'content-type': 'text/markdown'}});
			}).then(done, done.fail);
			requestResolve(new underTest.ApiResponse({hi: 'there'}, {'content-type': 'text/markdown'}));
		});
		it('embeds response into ApiResponse for success templates where headers are enumerated without defaults', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router({ context: { path: '/success-no-default', method: 'GET' } }, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {response: {hi: 'there'}, headers: {}});
			}).then(done, done.fail);
			requestResolve({hi: 'there'});
		});
		it('ignores headers when they are specified with defaults in success templates', function () {
			requestHandler.and.returnValue('hi there');
			underTest.router({ context: { path: '/success-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, 'hi there');
		});
		it('reports an error if apiresponse is used without enumerated headers', function () {
			requestHandler.and.returnValue(new underTest.ApiResponse({hi: 'there'}, {'content-type': 'text/markdown'}));
			underTest.router({context: {path: '/no-headers', method: 'GET'}}, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith('cannot use ApiResponse without enumerating headers in GET /no-headers');
		});
		it('reports an error if apiresponse is used with headers using defaults', function () {
			requestHandler.and.returnValue(new underTest.ApiResponse({hi: 'there'}, {'content-type': 'text/markdown'}));
			underTest.router({context: {path: '/success-default', method: 'GET'}}, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith('cannot use ApiResponse with default header values in GET /success-default');
		});
		it('reports an error if the custom header is not enumerated', function () {
			requestHandler.and.returnValue(new underTest.ApiResponse({hi: 'there'}, {'content-length': '102'}));
			underTest.router({ context: { path: '/success-no-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith('unexpected header content-length in GET /success-no-default');
		});
		it('ignores headers when they are specified with defaults in error templates', function () {
			requestHandler.and.throwError('Abort');
			underTest.router({ context: { path: '/error-default', method: 'GET' } }, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(new Error('Abort'));
		});
	});
	describe('CORS handling', function () {
		it('does not set corsHandlers unless corsOrigin called', function () {
			expect(underTest.apiConfig().corsHandlers).toBeUndefined();
		});
		it('sets corsHandlers to false if called with false', function () {
			underTest.corsOrigin(false);
			expect(underTest.apiConfig().corsHandlers).toBe(false);
		});
		it('sets corsHandlers to true if passed a function', function () {
			underTest.corsOrigin(function () { });
			expect(underTest.apiConfig().corsHandlers).toBe(true);
		});
		it('sets corsHandlers to true if passed a string', function () {
			underTest.corsOrigin('origin');
			expect(underTest.apiConfig().corsHandlers).toBe(true);
		});
		it('routes OPTIONS to return the result of a custom CORS handler in the Allowed-Origins header', function () {
			var corsHandler = jasmine.createSpy('corsHandler').and.returnValue('custom-origin'),
				apiRequest = { context: { path: '/existing', method: 'OPTIONS' } };
			underTest.get('/existing', requestHandler);
			underTest.corsOrigin(corsHandler);
			underTest.router(apiRequest, lambdaContext);
			expect(corsHandler).toHaveBeenCalledWith(apiRequest);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, 'custom-origin');
		});
		it('routes OPTIONS to return the string set by corsOrigin', function () {
			var apiRequest = { context: { path: '/existing', method: 'OPTIONS' } };
			underTest.get('/existing', requestHandler);
			underTest.corsOrigin('custom-origin-string');
			underTest.router(apiRequest, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(null, 'custom-origin-string');
		});
		it('does not set corsHeaders unless corsHeaders called', function () {
			expect(underTest.apiConfig().corsHeaders).toBeUndefined();
		});
		it('sets corsHeaders to a string, if provided', function () {
			underTest.corsHeaders('X-Api-Request');
			expect(underTest.apiConfig().corsHeaders).toEqual('X-Api-Request');
		});
		it('throws an error if the cors headers is not a string', function () {
			expect(function () {
				underTest.corsHeaders(function () { });
			}).toThrow('corsHeaders only accepts strings');
		});
	});
	describe('post install hooks', function () {
		var pResolve, pReject,
			postPromise, hook;

		beforeEach(function () {
			postPromise = new Promise(function (resolve, reject) {
				pResolve = resolve;
				pReject = reject;
			});
			hook = jasmine.createSpy().and.returnValue(postPromise);
		});
		it('can set up a single post-install hook', function () {
			underTest.addPostDeployStep('first', hook);
			underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise});
			expect(hook).toHaveBeenCalledWith({a: 1}, {c: 2}, {Promise: Promise});
		});
		it('does not execute the hook before postDeploy is called', function () {
			underTest.addPostDeployStep('first', hook);
			expect(hook).not.toHaveBeenCalled();
		});
		it('cannot add a hook with the same name twice', function () {
			underTest.addPostDeployStep('first', hook);
			expect(function () {
				underTest.addPostDeployStep('first', hook);
			}).toThrowError('Post deploy hook "first" already exists');
		});
		it('does not resolve until the post-install hook resolves', function (done) {
			var hasResolved = jasmine.createSpy();
			underTest.addPostDeployStep('first', hook);
			underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise}).then(hasResolved, done.fail);
			Promise.resolve().then(function () {
				expect(hasResolved).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('resolves when the post-install resolves', function (done) {
			underTest.addPostDeployStep('first', hook);
			underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise}).then(function (result) {
				expect(result).toEqual({first: { url: 'http://www.google.com' }});
			}).then(done, done.fail);
			pResolve({url: 'http://www.google.com'});
		});
		it('returns false when post-deploy hooks are not set up', function (done) {
			underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise}).then(function (result) {
				expect(result).toBeFalsy();
			}).then(done, done.fail);
		});
		describe('multiple hooks', function () {
			var p2Resolve, p2Reject,
				postPromise2, hook2;
			beforeEach(function () {
				postPromise2 = new Promise(function (resolve, reject) {
					p2Resolve = resolve;
					p2Reject = reject;
				});
				hook2 = jasmine.createSpy().and.returnValue(postPromise2);
				underTest.addPostDeployStep('first', hook);
				underTest.addPostDeployStep('second', hook2);
			});
			it('does not execute the hooks immediately', function () {
				expect(hook).not.toHaveBeenCalled();
				expect(hook2).not.toHaveBeenCalled();
			});
			it('does not execute the second hook until the first resolves', function (done) {
				underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise}).then(done.fail, done.fail);
				Promise.resolve().then(function () {
					expect(hook).toHaveBeenCalledWith({a: 1}, {c: 2}, {Promise: Promise});
					expect(hook2).not.toHaveBeenCalled();
				}).then(done, done.fail);
			});
			it('execute the second hook after the first one resolves', function (done) {
				underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise}).then(done.fail, done.fail);

				postPromise.then(Promise.resolve).then(function () {
					expect(hook2).toHaveBeenCalledWith({a: 1}, {c: 2}, {Promise: Promise});
				}).then(done, done.fail);

				pResolve({url: 'http://www.google.com'});
			});
			it('resolves when the second hook resolves', function (done) {
				underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise}).then(function (result) {
					expect(result).toEqual({
						first: { url: 'http://www.google.com' },
						second: { url: 'http://www.xkcd.com' }
					});
				}).then(done, done.fail);

				pResolve({url: 'http://www.google.com'});
				p2Resolve({url: 'http://www.xkcd.com'});
			});
		});
	});
});
