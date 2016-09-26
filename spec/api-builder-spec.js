/*global describe, it, expect, jasmine, require, beforeEach */
var ApiBuilder = require('../src/api-builder'),
	convertApiGWProxyRequest = require('../src/convert-api-gw-proxy-request'),
	Promise = require('bluebird');
describe('ApiBuilder', function () {
	'use strict';
	var underTest, requestHandler, lambdaContext, requestPromise, requestResolve, requestReject,
		postRequestHandler, prompter;
	beforeEach(function () {
		prompter = jasmine.createSpy();
		underTest = new ApiBuilder({prompter: prompter});
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
			it('can route calls to a ' + method + '  method', function (done) {
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
				underTest.router(apiRequest, lambdaContext).then(function () {
					expect(requestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
				}).then(done, done.fail);
			});
		});
	});
	describe('proxyRouter', function () {
		var proxyRequest, apiRequest;
		beforeEach(function () {
			proxyRequest = {
				queryStringParameters : {
					'a' : 'b'
				},
				requestContext: {
					resourcePath: '/',
					httpMethod: 'GET'
				}
			};
			apiRequest = convertApiGWProxyRequest(proxyRequest, lambdaContext);
			underTest.get('/', requestHandler);
		});
		it('converts API gateway proxy requests then routes call', function (done) {
			underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
				expect(requestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
			}).then(done, done.fail);
		});
		it('does not convert the request before routing if requestFormat = AWS_PROXY', function (done) {
			underTest.setRequestFormat('AWS_PROXY');
			underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
				expect(requestHandler).toHaveBeenCalledWith(proxyRequest, lambdaContext);
			}).then(done, done.fail);
		});
		it('converts the request if request format = CLAUDIA_API_BUILDER', function (done) {
			underTest.setRequestFormat('CLAUDIA_API_BUILDER');
			underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
				expect(requestHandler).toHaveBeenCalledWith(jasmine.objectContaining({
					lambdaContext: lambdaContext,
					proxyRequest: proxyRequest,
					queryString: { a: 'b' }
				}), lambdaContext);
			}).then(done, done.fail);
		});
	});
	describe('call execution', function () {
		var apiRequest, proxyRequest;
		beforeEach(function () {
			underTest.get('/echo', requestHandler);
			proxyRequest = {
				requestContext: {
					resourcePath: '/echo',
					httpMethod: 'GET'
				}
			};
			apiRequest = convertApiGWProxyRequest(proxyRequest, lambdaContext);
		});

		describe('routing calls', function () {
			it('can route to /', function (done) {
				underTest.get('/', postRequestHandler);
				proxyRequest.requestContext.resourcePath = apiRequest.context.path = '/';
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(postRequestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
				}).then(done, done.fail);
			});
			it('complains about an unsuported route', function (done) {
				proxyRequest.requestContext.resourcePath = apiRequest.context.path = '/no';
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(lambdaContext.done).toHaveBeenCalledWith('no handler for GET /no');
				}).then(done, done.fail);
			});
			it('complains about an unsupported call', function (done) {
				underTest.proxyRouter({}, lambdaContext).then(function () {
					expect(lambdaContext.done).toHaveBeenCalledWith('event does not contain routing information');
				}).then(done, done.fail);
			});
			it('can route calls to a single GET method', function (done) {
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(requestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
				}).then(done, done.fail);
			});
			it('can route calls in mixed case', function (done) {
				underTest.get('/CamelCase', postRequestHandler);
				proxyRequest.requestContext.resourcePath = apiRequest.context.path = '/CamelCase';
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(postRequestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
				}).then(done, done.fail);
			});
			it('can route calls configured without a slash', function (done) {
				underTest.post('echo', postRequestHandler);
				proxyRequest.requestContext.httpMethod = apiRequest.context.method = 'POST';
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(postRequestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
					expect(requestHandler).not.toHaveBeenCalled();
				}).then(done, done.fail);
			});
			it('can route to multiple methods', function (done) {
				underTest.post('/echo', postRequestHandler);
				proxyRequest.requestContext.httpMethod = apiRequest.context.method = 'POST';
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(postRequestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
					expect(requestHandler).not.toHaveBeenCalled();
				}).then(done, done.fail);
			});
			it('can route to multiple routes', function (done) {
				underTest.post('/echo2', postRequestHandler);
				proxyRequest.requestContext.resourcePath = apiRequest.context.path = '/echo2';
				proxyRequest.requestContext.httpMethod = apiRequest.context.method = 'POST';
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(postRequestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
					expect(requestHandler).not.toHaveBeenCalled();
				}).then(done, done.fail);
			});
		});
		describe('response processing', function () {
			describe('synchronous', function () {
				it('can handle synchronous exceptions in the routed method', function (done) {
					requestHandler.and.throwError('Error');
					underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
						expect(lambdaContext.done).toHaveBeenCalledWith(jasmine.any(Error));
					}).then(done, done.fail);
				});
				it('can handle successful synchronous results from the request handler', function (done) {
					requestHandler.and.returnValue({hi: 'there'});
					underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
						expect(lambdaContext.done).toHaveBeenCalledWith(null,  jasmine.objectContaining({
							statusCode: 200
						}));
					}).then(done, done.fail);
				});
			});
			describe('asynchronous', function () {
				it('waits for promises to resolve or reject before responding', function (done) {
					requestHandler.and.returnValue(requestPromise);
					underTest.proxyRouter(proxyRequest, lambdaContext).then(done.fail, done.fail);
					Promise.resolve().then(function () {
						expect(requestHandler).toHaveBeenCalled();
						expect(lambdaContext.done).not.toHaveBeenCalled();
						done();
					});
				});

				it('synchronously handles plain objects that have a then key, but are not promises', function (done) {
					requestHandler.and.returnValue({then: 1});
					underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
						expect(lambdaContext.done).toHaveBeenCalledWith(null, jasmine.objectContaining({
							statusCode: 200
						}));
					}).then(done, done.fail);
				});
				it('handles request promise rejecting', function (done) {
					requestHandler.and.returnValue(requestPromise);
					underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
						expect(lambdaContext.done).toHaveBeenCalledWith('Abort');
					}).then(done, done.fail);
					requestReject('Abort');
				});
				it('handles request promise resolving', function (done) {
					requestHandler.and.returnValue(requestPromise);
					underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
						expect(lambdaContext.done).toHaveBeenCalledWith(null, jasmine.objectContaining({
							statusCode: 200
						}));
					}).then(done, done.fail);
					requestResolve({hi: 'there'});
				});
			});
		});

		describe('result packaging', function () {
			describe('error handling', function () {


			});
			describe('success handling', function () {
				describe('status code', function () {
					it('uses 200 by default', function (done) {
						requestHandler.and.returnValue({hi: 'there'});
						underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
							expect(lambdaContext.done).toHaveBeenCalledWith(null,  jasmine.objectContaining({
								statusCode: 200
							}));
						}).then(done, done.fail);
					});
					it('can configure success code with handler success as a number', function (done) {
						requestHandler.and.returnValue({hi: 'there'});
						underTest.get('/echo', requestHandler, {
							success: 204
						});
						underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
							expect(lambdaContext.done).toHaveBeenCalledWith(null,  jasmine.objectContaining({
								statusCode: 204
							}));
						}).then(done, done.fail);
					});
					it('can configure success code with handler success as an object key', function (done) {
						requestHandler.and.returnValue({hi: 'there'});
						underTest.get('/echo', requestHandler, {
							success: { code: 204 }
						});
						underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
							expect(lambdaContext.done).toHaveBeenCalledWith(null,  jasmine.objectContaining({
								statusCode: 204
							}));
						}).then(done, done.fail);
					});
					it('uses a default if success is defined as an object, but without code', function (done) {
						requestHandler.and.returnValue({hi: 'there'});
						underTest.get('/echo', requestHandler, {
							success: { contentType: 'text/plain' }
						});
						underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
							expect(lambdaContext.done).toHaveBeenCalledWith(null,  jasmine.objectContaining({
								statusCode: 200
							}));
						}).then(done, done.fail);
					});
					it('uses dynamic response code if provided', function (done) {
						requestHandler.and.returnValue(new underTest.ApiResponse('', {}, 203));
						underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
							expect(lambdaContext.done).toHaveBeenCalledWith(null,  jasmine.objectContaining({
								statusCode: 203
							}));
						}).then(done, done.fail);
					});
					it('uses dynamic response code over static definitions', function (done) {
						underTest.get('/echo', requestHandler, {
							success: 204
						});
						requestHandler.and.returnValue(new underTest.ApiResponse('', {}, 203));
						underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
							expect(lambdaContext.done).toHaveBeenCalledWith(null,  jasmine.objectContaining({
								statusCode: 203
							}));
						}).then(done, done.fail);
					});
					it('uses a static definition with ApiResponse if code is not set', function (done) {
						underTest.get('/echo', requestHandler, {
							success: 204
						});
						requestHandler.and.returnValue(new underTest.ApiResponse('', {}));
						underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
							expect(lambdaContext.done).toHaveBeenCalledWith(null,  jasmine.objectContaining({
								statusCode: 204
							}));
						}).then(done, done.fail);
					});
					it('uses 200 with ApiResponse if code is not set and there is no static override', function (done) {
						requestHandler.and.returnValue(new underTest.ApiResponse('', {}));
						underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
							expect(lambdaContext.done).toHaveBeenCalledWith(null,  jasmine.objectContaining({
								statusCode: 200
							}));
						}).then(done, done.fail);
					});
				});
				describe('header values', function () {
					describe('Content-Type', function () {
						it('uses application/json as the content type by default', function () {

						});
						it('uses content type is specified in the handler config', function () {

						});
						it('uses content type specified in a static header', function () {

						});
						it('uses content type specified in a dynamic header', function () {

						});
						it('uses dynamic header over everything else', function () {

						});
						it('uses static header over handler config', function () {

						});
					});
					describe('CORS headers', function () {
						it('automatically includes CORS headers with the response', function () {

						});
						it('uses custom origin if provided', function () {

						});
						it('uses custom Allow-Headers if provided', function () {

						});
					});
					describe('static headers', function () {
						it('can supply additional static headers in the handler config', function () {

						});
						it('ignores enumerated static headers -- backwards compatibility', function () {

						});
						it('overrides CORS headers with static headers', function () {

						});
					});
					describe('dynamic headers', function () {
						it('can supply additional dynamic headers in the response', function () {

						});
						it('overrides static headers with dynamic headers', function () {

						});
						it('overrides CORS headers with dynamic headers', function () {

						});
					});
					describe('when result code is a redirect', function () {
						it('packs the result into the location header', function () {

						});
						it('uses the dynamic headers if provided', function () {

						});
					});

				});
				describe('result formatting', function () {
					describe('when content type is application/json', function () {
						it('stringifies objects', function () {

						});
						it('JSON-stringifies non objects for application/json', function () {

						});
						it('uses blank object for empty string', function () {

						});
						[null, false].forEach(function (literal) {
							it('uses literal version for ' + literal, function () {

							});
						});
					});
					describe('when content type is not JSON', function () {
						it('stringifies objects', function () {

						});
						it('returns literal results for non-json responses', function () {

						});
						it('uses blank string for falsy responses', function () {

						});
					});
				});
			});
		});

		describe('intercepting calls', function () {
			var interceptSpy;
			beforeEach(function () {
				interceptSpy = jasmine.createSpy();
				underTest.get('/echo', requestHandler);
				underTest.post('/echo', postRequestHandler);
				underTest.intercept(interceptSpy);
			});
			it('rejects if the intercept rejects', function (done) {
				interceptSpy.and.returnValue(Promise.reject('BOOM'));
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(requestHandler).not.toHaveBeenCalled();
					expect(postRequestHandler).not.toHaveBeenCalled();
					expect(lambdaContext.done).toHaveBeenCalledWith('BOOM');
				}).then(done, done.fail);
			});
			it('rejects if the intercept throws an exception', function (done) {
				interceptSpy.and.throwError('BOOM');
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(requestHandler).not.toHaveBeenCalled();
					expect(postRequestHandler).not.toHaveBeenCalled();
					expect(lambdaContext.done.calls.mostRecent().args[0].message).toEqual('BOOM');
				}).then(done, done.fail);
			});
			it('routes the event returned from intercept', function (done) {
				interceptSpy.and.returnValue({
					context: {
						path: '/echo',
						method: 'POST'
					},
					queryString: {
						c: 'd'
					}
				});
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(requestHandler).not.toHaveBeenCalled();
					expect(postRequestHandler).toHaveBeenCalledWith(jasmine.objectContaining({
						context: {
							path: '/echo',
							method: 'POST'
						},
						queryString: {
							c: 'd'
						}
					}), lambdaContext);
				}).then(done, done.fail);
			});
			it('routes the event resolved by the intercept promise', function (done) {
				interceptSpy.and.returnValue(Promise.resolve({
					context: {
						path: '/echo',
						method: 'POST'
					},
					queryString: {
						c: 'd'
					}
				}));
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(requestHandler).not.toHaveBeenCalled();
					expect(postRequestHandler).toHaveBeenCalledWith(jasmine.objectContaining({
						context: {
							path: '/echo',
							method: 'POST'
						},
						queryString: {
							c: 'd'
						}
					}), lambdaContext);
				}).then(done, done.fail);
			});
			it('aborts if the intercept returns a falsy value', function (done) {
				interceptSpy.and.returnValue(false);
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(requestHandler).not.toHaveBeenCalled();
					expect(postRequestHandler).not.toHaveBeenCalled();
					expect(lambdaContext.done).toHaveBeenCalledWith(null, null);
				}).then(done, done.fail);
			});
			it('aborts if the intercept resolves with a falsy value', function (done) {
				interceptSpy.and.returnValue(Promise.resolve(false));
				underTest.proxyRouter(proxyRequest, lambdaContext).then(function () {
					expect(requestHandler).not.toHaveBeenCalled();
					expect(postRequestHandler).not.toHaveBeenCalled();
					expect(lambdaContext.done).toHaveBeenCalledWith(null, null);
				}).then(done, done.fail);
			});
		});
	});
	describe('unsupported event format', function () {
		it('causes lambda context to complete with error if no custom handler', function (done) {
			underTest.router({}, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith('event does not contain routing information');
			}).then(done, done.fail);
		});
		it('calls custom handler if provided', function (done) {
			var fakeCallback = jasmine.createSpy();
			underTest.unsupportedEvent(function (event, context, callback) {
				expect(event).toEqual({a: 1});
				expect(context).toEqual(lambdaContext);
				expect(callback).toEqual(fakeCallback);
				expect(lambdaContext.done).not.toHaveBeenCalled();
				done();
			});
			underTest.proxyRouter({a: 1}, lambdaContext, fakeCallback);
		});
	});

	describe('CORS handling', function () {
		var apiRequest;
		beforeEach(function () {
			apiRequest = { context: { path: '/existing', method: 'OPTIONS' } };
			underTest.get('/existing', requestHandler);
		});
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

		it('routes OPTIONS to return the the default configuration if no parameters set', function (done) {
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {
					statusCode: 200,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
						'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,HEAD,PATCH,OPTIONS'
					},
					body: ''
				});
			}).then(done, done.fail);
		});
		it('routes OPTIONS to return no header values if origin is set to false', function (done) {
			underTest.corsOrigin(false);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {
					statusCode: 200,
					headers: {
						'Access-Control-Allow-Origin': '',
						'Access-Control-Allow-Headers': '',
						'Access-Control-Allow-Methods': ''
					},
					body: ''
				});
			}).then(done, done.fail);
		});
		it('routes OPTIONS to return the result of a custom CORS handler in the Allowed-Origins header', function (done) {
			var corsHandler = jasmine.createSpy('corsHandler').and.returnValue('custom-origin');
			underTest.corsOrigin(corsHandler);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(corsHandler).toHaveBeenCalledWith(apiRequest);
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {
					statusCode: 200,
					headers: {
						'Access-Control-Allow-Origin': 'custom-origin',
						'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
						'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,HEAD,PATCH,OPTIONS'
					},
					body: ''
				});
			}).then(done, done.fail);
		});
		it('routes OPTIONS to return the result of a promise resolved by the CORS handler', function (done) {
			var corsPromise = Promise.resolve('custom-origin'),
				corsHandler = jasmine.createSpy('corsHandler').and.returnValue(corsPromise);
			underTest.corsOrigin(corsHandler);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(corsHandler).toHaveBeenCalledWith(apiRequest);
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {
					statusCode: 200,
					headers: {
						'Access-Control-Allow-Origin': 'custom-origin',
						'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
						'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,HEAD,PATCH,OPTIONS'
					},
					body: ''
				});
			}).then(done, done.fail);

		});
		it('routes OPTIONS to return the string set by corsOrigin', function (done) {
			underTest.corsOrigin('custom-origin-string');
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {
					statusCode: 200,
					headers: {
						'Access-Control-Allow-Origin': 'custom-origin-string',
						'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
						'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,HEAD,PATCH,OPTIONS'
					},
					body: ''
				});
			}).then(done, done.fail);
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
		it('uses corsHeaders when routing OPTIONS', function (done) {
			underTest.corsHeaders('X-Api-Request');
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {
					statusCode: 200,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Headers': 'X-Api-Request',
						'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,HEAD,PATCH,OPTIONS'
					},
					body: ''
				});
			}).then(done, done.fail);
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
		it('can set up a single post-install hook', function (done) {
			underTest.addPostDeployStep('first', function (opts, config, utils) {
				expect(opts).toEqual({a: 1});
				expect(config).toEqual({c: 2});
				expect(utils).toEqual({Promise: Promise});
				done();
			});
			underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise});
		});
		it('complains if the first argument is not a step name', function () {
			expect(function () {
				underTest.addPostDeployStep(hook);
			}).toThrowError('addPostDeployStep requires a step name as the first argument');
		});
		it('complains if the second argument is not a function', function () {
			expect(function () {
				underTest.addPostDeployStep('first');
			}).toThrowError('addPostDeployStep requires a function as the first argument');
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
		it('works with non-promise post-install hooks', function (done) {
			underTest.addPostDeployStep('first', function () {
				return 'yes';
			});
			underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise}).then(function (result) {
				expect(result).toEqual({first: 'yes'});
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
				hook.and.callFake(function (opts, config, utils) {

					expect(opts).toEqual({a: 1});
					expect(config).toEqual({c: 2});
					expect(utils).toEqual({Promise: Promise});
					expect(hook2).not.toHaveBeenCalled();
					done();
					return postPromise;
				});
				underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise}).then(done.fail, done.fail);
			});
			it('executes the second hook after the first one resolves', function (done) {
				underTest.postDeploy({a: 1}, {c: 2}, {Promise: Promise}).then(done.fail, function () {
					expect(hook2).toHaveBeenCalledWith({a: 1}, {c: 2}, {Promise: Promise});
				}).then(done);
				pResolve({url: 'http://www.google.com'});
				p2Reject('boom');
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
	describe('post-deploy config shortcut', function () {
		var apiGatewayPromise, lambdaDetails, deploymentResolve, deploymentReject;
		beforeEach(function () {
			apiGatewayPromise = jasmine.createSpyObj('apiGatewayPromise', ['createDeploymentPromise']);
			apiGatewayPromise.createDeploymentPromise.and.returnValue(new Promise(function (resolve, reject) {
				deploymentResolve = resolve;
				deploymentReject = reject;
			}));
			lambdaDetails = { apiId: 'API_1', alias: 'dev' };
			underTest.addPostDeployConfig('stageVar', 'Enter var', 'config-var');
		});
		it('does nothing if the config arg is not set', function (done) {
			underTest.postDeploy({a: 1}, lambdaDetails, {Promise: Promise, apiGatewayPromise: apiGatewayPromise}).then(function () {
				expect(apiGatewayPromise.createDeploymentPromise).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		describe('when the config arg is a string', function () {
			it('sets the variable without prompting', function (done) {
				underTest.postDeploy({a: 1, 'config-var': 'val-value'}, lambdaDetails, {Promise: Promise, apiGatewayPromise: apiGatewayPromise}).then(function (result) {
					expect(apiGatewayPromise.createDeploymentPromise).toHaveBeenCalledWith({
						restApiId: 'API_1',
						stageName: 'dev',
						variables: { stageVar: 'val-value' }
					});
					expect(prompter).not.toHaveBeenCalled();
					expect(result).toEqual({stageVar: 'val-value'});
				}).then(done, done.fail);
				deploymentResolve('OK');
			});
			it('rejects if the deployment rejects', function (done) {
				underTest.postDeploy({a: 1, 'config-var': 'val-value'}, lambdaDetails, {Promise: Promise, apiGatewayPromise: apiGatewayPromise})
				.then(done.fail, function (err) {
					expect(err).toEqual('BOOM!');
				}).then(done);
				deploymentReject('BOOM!');
			});
		});
		describe('when the config arg is true', function () {
			it('prompts for the variable', function (done) {
				underTest.postDeploy({a: 1, 'config-var': true}, lambdaDetails, {Promise: Promise, apiGatewayPromise: apiGatewayPromise}).then(done.fail, done.fail);
				prompter.and.callFake(function (arg) {
					expect(arg).toEqual('Enter var');
					done();
					return Promise.resolve('X');
				});
			});
			it('deploys the stage variable returned by the prompter', function (done) {
				underTest.postDeploy({a: 1, 'config-var': true}, lambdaDetails, {Promise: Promise, apiGatewayPromise: apiGatewayPromise}).then(function (result) {
					expect(apiGatewayPromise.createDeploymentPromise).toHaveBeenCalledWith({
						restApiId: 'API_1',
						stageName: 'dev',
						variables: { stageVar: 'X' }
					});
					expect(result).toEqual({stageVar: 'X'});
				}).then(done, done.fail);
				prompter.and.returnValue(Promise.resolve('X'));
				deploymentResolve('OK');
			});
			it('rejects if the prompter rejects', function (done) {
				underTest.postDeploy({a: 1, 'config-var': true}, lambdaDetails, {Promise: Promise, apiGatewayPromise: apiGatewayPromise}).then(done.fail, function (err) {
					expect(err).toEqual('BOOM');
					expect(apiGatewayPromise.createDeploymentPromise).not.toHaveBeenCalled();
				}).then(done);
				prompter.and.returnValue(Promise.reject('BOOM'));
			});
			it('rejects if the deployment rejects', function (done) {
				underTest.postDeploy({a: 1, 'config-var': true}, lambdaDetails, {Promise: Promise, apiGatewayPromise: apiGatewayPromise}).then(done.fail, function (err) {
					expect(err).toEqual('BOOM');
				}).then(done);
				prompter.and.returnValue(Promise.resolve('OK'));
				deploymentReject('BOOM');
			});
		});
	});
	describe('lambda context control', function () {
		it('sets the flag to kill the node vm without waiting for the event loop to empty after serializing context to request', function (done) {
			var apiRequest = {
					context: {
						path: '/test',
						method: 'GET'
					},
					queryString: {
						a: 'b'
					}
				};
			underTest.get('/test', requestHandler);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.callbackWaitsForEmptyEventLoop).toBe(false);
			}).then(done, done.fail);

		});
	});
	describe('registerAuthorizer', function () {
		it('creates no authorizers by default', function () {
			expect(underTest.apiConfig().authorizers).toBeUndefined();
		});
		it('can register an authorizer by name', function () {
			underTest.registerAuthorizer('first', { lambdaName: 'blob1' });
			expect(underTest.apiConfig().authorizers).toEqual({
				first: { lambdaName: 'blob1' }
			});
		});
		it('can register multiple authorizers by name', function () {
			underTest.registerAuthorizer('first', { lambdaName: 'blob1' });
			underTest.registerAuthorizer('second', { lambdaName: 'blob2' });
			expect(underTest.apiConfig().authorizers).toEqual({
				first: { lambdaName: 'blob1' },
				second: { lambdaName: 'blob2' }
			});
		});
		it('complains about the same name used twice', function () {
			underTest.registerAuthorizer('first', { lambdaName: 'blob1' });
			expect(function () {
				underTest.registerAuthorizer('first', { lambdaName: 'blob2' });
			}).toThrowError('Authorizer first is already defined');
		});
		it('complains about no config authorizers', function () {
			expect(function () {
				underTest.registerAuthorizer('first', {});
			}).toThrowError('Authorizer first configuration is invalid');
			expect(function () {
				underTest.registerAuthorizer('first');
			}).toThrowError('Authorizer first configuration is invalid');
		});
		it('complains about nameless authorizers', function () {
			expect(function () {
				underTest.registerAuthorizer('', {});
			}).toThrowError('Authorizer must have a name');
			expect(function () {
				underTest.registerAuthorizer();
			}).toThrowError('Authorizer must have a name');
		});
	});
});
