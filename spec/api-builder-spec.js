/*global describe, it, expect, jasmine, require, beforeEach, afterEach */
const ApiBuilder = require('../src/api-builder'),
	convertApiGWProxyRequest = require('../src/convert-api-gw-proxy-request');
describe('ApiBuilder', () => {
	'use strict';
	let underTest, requestHandler, lambdaContext, requestPromise, requestResolve, requestReject,
		postRequestHandler, prompter, logger;
	const responseHeaders = function (headerName) {
			const headers = lambdaContext.done.calls.argsFor(0)[1].headers;
			if (headerName) {
				return headers[headerName];
			} else {
				return headers;
			}
		},
		contentType = function () {
			return responseHeaders('Content-Type');
		},
		responseStatusCode = function () {
			return lambdaContext.done.calls.argsFor(0)[1].statusCode;
		},
		responseBase64Flag = function () {
			return lambdaContext.done.calls.argsFor(0)[1].isBase64Encoded;
		},
		responseBody = function () {
			return lambdaContext.done.calls.argsFor(0)[1].body;
		};

	beforeEach(() => {
		prompter = jasmine.createSpy();
		logger = jasmine.createSpy();
		underTest = new ApiBuilder({prompter: prompter, logger: logger});
		requestHandler = jasmine.createSpy('handler');
		postRequestHandler = jasmine.createSpy('postHandler');
		lambdaContext = jasmine.createSpyObj('lambdaContext', ['done']);
		requestPromise = new Promise(function (resolve, reject) {
			requestResolve = resolve;
			requestReject = reject;
		});
	});
	describe('methods', () => {
		it('should include a `get` method', () => {
			expect(typeof underTest.get).toEqual('function');
		});
		it('should include a `put` method', () => {
			expect(typeof underTest.put).toEqual('function');
		});
		it('should include a `post` method', () => {
			expect(typeof underTest.post).toEqual('function');
		});
		it('should include a `delete` method', () => {
			expect(typeof underTest.delete).toEqual('function');
		});
		it('should include a `head` method', () => {
			expect(typeof underTest.head).toEqual('function');
		});
		it('should include a `patch` method', () => {
			expect(typeof underTest.patch).toEqual('function');
		});
		it('should include a `any` method', () => {
			expect(typeof underTest.any).toEqual('function');
		});
	});
	describe('configuration', () => {
		it('carries version 4', () => {
			expect(underTest.apiConfig().version).toEqual(4);
		});
		it('can configure a single GET method', () => {
			underTest.get('/echo', requestHandler);
			expect(underTest.apiConfig().routes).toEqual({
				'echo': { 'GET': {}}
			});
		});
		it('can configure a single route with multiple methods', () => {
			underTest.get('/echo', requestHandler);
			underTest.post('/echo', postRequestHandler);
			expect(underTest.apiConfig().routes).toEqual({
				'echo': {'GET': {}, 'POST': {}}
			});
		});
		it('can override existing route', () => {
			underTest.get('/echo', requestHandler);
			underTest.get('/echo', postRequestHandler);
			expect(underTest.apiConfig().routes).toEqual({
				'echo': { 'GET': {}}
			});
		});
		it('can accept a route without a slash', () => {
			underTest.get('echo', requestHandler);
			expect(underTest.apiConfig().routes).toEqual({
				'echo': { 'GET': {}}
			});
		});
		it('can accept routes in mixed case', () => {
			underTest.get('EcHo', requestHandler);
			expect(underTest.apiConfig().routes).toEqual({
				'EcHo': { 'GET': {}}
			});
		});
		it('records options', () => {
			underTest.get('echo', requestHandler, {errorCode: 403});
			expect(underTest.apiConfig().routes).toEqual({
				'echo': { 'GET': {errorCode: 403}}
			});
		});
	});
	describe('router', () => {
		['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'HEAD'].forEach(function (method) {
			it(`can route calls to a ${method} method`, done => {
				const apiRequest = {
					context: {
						path: '/test',
						method: method
					},
					queryString: {
						a: 'b'
					}
				};
				underTest[method.toLowerCase()]('/test', requestHandler);
				underTest.router(apiRequest, lambdaContext)
					.then(() => expect(requestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext))
					.then(done, done.fail);
			});
		});
	});
	describe('proxyRouter', () => {
		let proxyRequest, apiRequest;
		beforeEach(() => {
			proxyRequest = {
				httpMethod: 'GET',
				path: '/',
				queryStringParameters: {
					'a': 'b'
				},
				requestContext: {
					resourcePath: '/',
					httpMethod: 'GET'
				}
			};
			apiRequest = convertApiGWProxyRequest(proxyRequest, lambdaContext);
			underTest.get('/', requestHandler);
		});
		it('converts API gateway proxy requests then routes call', done => {
			underTest.proxyRouter(proxyRequest, lambdaContext)
				.then(() => expect(requestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext))
				.then(done, done.fail);
		});
		it('converts the request if request format = CLAUDIA_API_BUILDER', done => {
			underTest = new ApiBuilder({requestFormat: 'CLAUDIA_API_BUILDER'});
			underTest.get('/', requestHandler);
			underTest.proxyRouter(proxyRequest, lambdaContext)
				.then(() => {
					expect(requestHandler).toHaveBeenCalledWith(jasmine.objectContaining({
						lambdaContext: lambdaContext,
						proxyRequest: proxyRequest,
						queryString: { a: 'b' }
					}), lambdaContext);
				})
				.then(done, done.fail);
		});
		describe('variable merging', () => {
			let oldPe;
			beforeEach(() => {
				proxyRequest.requestContext.stage = 'stg1';
				proxyRequest.stageVariables = {
					'from_stage': 'stg',
					'in_both': 'stg'
				};
				oldPe = process.env;
				process.env = {
					stg1_from_process: 'pcs',
					stg1_in_both: 'pcs',
					global_process: 'pcs'
				};
			});
			afterEach(() => {
				process.env = oldPe;
			});
			it('merges variables if options.mergeVars is set', done => {
				underTest = new ApiBuilder({mergeVars: true});
				underTest.get('/', requestHandler);
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
						expect(requestHandler).toHaveBeenCalledWith(jasmine.objectContaining({
							env: {
								'from_process': 'pcs',
								'from_stage': 'stg',
								'in_both': 'stg',
								'global_process': 'pcs',
								'stg1_from_process': 'pcs',
								'stg1_in_both': 'pcs'
							}
						}), lambdaContext);
					})
					.then(done, done.fail);
			});
			it('does not merge variables if options.mergeVars is not set', done => {
				underTest = new ApiBuilder();
				underTest.get('/', requestHandler);
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
						expect(requestHandler).toHaveBeenCalledWith(jasmine.objectContaining({
							env: {
								'from_stage': 'stg',
								'in_both': 'stg'
							}
						}), lambdaContext);
					})
					.then(done, done.fail);
			});

		});
		it('responds with invalid request if conversion fails', done => {
			underTest = new ApiBuilder({requestFormat: 'CLAUDIA_API_BUILDER'});
			underTest.get('/', requestHandler);
			proxyRequest.headers = {
				'Content-Type': 'application/json'
			};
			proxyRequest.body = 'birthyear=1905&press=%20OK%20';
			underTest.proxyRouter(proxyRequest, lambdaContext)
				.then(() => {
					expect(responseStatusCode()).toEqual(500);
					expect(responseBody()).toEqual('The content does not match the supplied content type');
				})
				.then(done, done.fail);
		});
		it('does not convert the request before routing if requestFormat = AWS_PROXY', done => {
			underTest = new ApiBuilder({requestFormat: 'AWS_PROXY'});
			underTest.get('/', requestHandler);
			underTest.proxyRouter(proxyRequest, lambdaContext)
				.then(() => expect(requestHandler).toHaveBeenCalledWith(proxyRequest, lambdaContext))
				.then(done, done.fail);
		});
		it('correctly routes greedy proxy paths', done => {
			const request = {
				'httpMethod': 'GET',
				'path': '/coconuts',
				'resource': '/{proxy+}',
				'requestContext': {
					'path': '/{proxy+}',
					'resourcePath': '/{proxy+}'
				}
			};
			underTest = new ApiBuilder({requestFormat: 'AWS_PROXY'});
			underTest.get('/coconuts', requestHandler);
			underTest.proxyRouter(request, lambdaContext)
				.then(() => expect(requestHandler).toHaveBeenCalledWith(request, lambdaContext))
				.then(done, done.fail);
		});
		['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'HEAD'].forEach(function (method) {
			it(`can route calls to a ${method} method`, done => {
				proxyRequest.requestContext.httpMethod = method;
				proxyRequest.requestContext.resourcePath = '/test';
				apiRequest.context.method = method;
				apiRequest.context.path = '/test';
				underTest[method.toLowerCase()]('/test', requestHandler);
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => expect(requestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext))
					.then(done, done.fail);
			});
		});
	});
	describe('routing to ANY', () => {
		let proxyRequest, apiRequest, genericHandler, specificHandler;
		['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'HEAD'].forEach(method => {
			describe(`when using ${method}`, () => {
				beforeEach(() => {
					proxyRequest = {
						queryStringParameters: {
							'a': 'b'
						},
						requestContext: {
							resourcePath: '/test1',
							httpMethod: method
						}
					};
					genericHandler = jasmine.createSpy('genericHandler');
					specificHandler = jasmine.createSpy('specificHandler');
					apiRequest = convertApiGWProxyRequest(proxyRequest, lambdaContext);
					underTest.any('/test1', genericHandler);
				});
				it('routes to the generic handler if it is set up and no handler is defined for the actual method', done => {
					underTest.proxyRouter(proxyRequest, lambdaContext)
						.then(() => expect(genericHandler).toHaveBeenCalledWith(apiRequest, lambdaContext))
						.then(done, done.fail);
				});
				it('routes to specific method handler over a generic handler', done => {
					underTest[method.toLowerCase()]('/test1', specificHandler);
					underTest.proxyRouter(proxyRequest, lambdaContext)
						.then(() => {
							expect(specificHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
							expect(genericHandler).not.toHaveBeenCalled();
						})
						.then(done, done.fail);
				});
				it('reports all methods as allowed for CORS if a generic handler is set', done => {
					proxyRequest.requestContext.httpMethod = 'OPTIONS';
					underTest.proxyRouter(proxyRequest, lambdaContext)
						.then(() => expect(responseHeaders('Access-Control-Allow-Methods')).toEqual('DELETE,GET,HEAD,PATCH,POST,PUT,OPTIONS'))
						.then(done, done.fail);
				});
				it('does not duplicate methods in CORS headers if both specific and generic handlers are set', done => {
					underTest[method.toLowerCase()]('/test1', specificHandler);
					proxyRequest.requestContext.httpMethod = 'OPTIONS';
					underTest.proxyRouter(proxyRequest, lambdaContext)
						.then(() => expect(responseHeaders('Access-Control-Allow-Methods')).toEqual('DELETE,GET,HEAD,PATCH,POST,PUT,OPTIONS'))
						.then(done, done.fail);
				});
			});
		});
	});
	describe('call execution', () => {
		let apiRequest, proxyRequest;
		beforeEach(() => {
			underTest.get('/echo', requestHandler);
			proxyRequest = {
				requestContext: {
					resourcePath: '/echo',
					httpMethod: 'GET'
				}
			};
			apiRequest = convertApiGWProxyRequest(proxyRequest, lambdaContext);
		});

		describe('routing calls', () => {
			it('can route to /', done => {
				underTest.get('/', postRequestHandler);
				proxyRequest.requestContext.resourcePath = apiRequest.context.path = '/';
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => expect(postRequestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext))
					.then(done, done.fail);
			});
			it('complains about an unsuported route', done => {
				proxyRequest.requestContext.resourcePath = apiRequest.context.path = '/no';
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => expect(lambdaContext.done).toHaveBeenCalledWith('no handler for GET /no'))
					.then(done, done.fail);
			});
			it('complains about an unsupported call', done => {
				underTest.proxyRouter({}, lambdaContext)
					.then(() => expect(lambdaContext.done).toHaveBeenCalledWith('event does not contain routing information'))
					.then(done, done.fail);
			});
			it('can route calls to a single GET method', done => {
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => expect(requestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext))
					.then(done, done.fail);
			});
			it('can route calls in mixed case', done => {
				underTest.get('/CamelCase', postRequestHandler);
				proxyRequest.requestContext.resourcePath = apiRequest.context.path = '/CamelCase';
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => expect(postRequestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext))
					.then(done, done.fail);
			});
			it('can route calls configured without a slash', done => {
				underTest.post('echo', postRequestHandler);
				proxyRequest.requestContext.httpMethod = apiRequest.context.method = 'POST';
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
						expect(postRequestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
						expect(requestHandler).not.toHaveBeenCalled();
					})
					.then(done, done.fail);
			});
			it('can route to multiple methods', done => {
				underTest.post('/echo', postRequestHandler);
				proxyRequest.requestContext.httpMethod = apiRequest.context.method = 'POST';
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
						expect(postRequestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
						expect(requestHandler).not.toHaveBeenCalled();
					})
					.then(done, done.fail);
			});
			it('can route to multiple routes', done => {
				underTest.post('/echo2', postRequestHandler);
				proxyRequest.requestContext.resourcePath = apiRequest.context.path = '/echo2';
				proxyRequest.requestContext.httpMethod = apiRequest.context.method = 'POST';
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
						expect(postRequestHandler).toHaveBeenCalledWith(apiRequest, lambdaContext);
						expect(requestHandler).not.toHaveBeenCalled();
					})
					.then(done, done.fail);
			});
		});
		describe('response processing', () => {
			describe('synchronous', () => {
				it('can handle synchronous exceptions in the routed method', done => {
					requestHandler.and.throwError('Error');
					underTest.proxyRouter(proxyRequest, lambdaContext)
						.then(() => expect(responseStatusCode()).toEqual(500))
						.then(done, done.fail);
				});
				it('can handle successful synchronous results from the request handler', done => {
					requestHandler.and.returnValue({hi: 'there'});
					underTest.proxyRouter(proxyRequest, lambdaContext)
						.then(() => expect(responseStatusCode()).toEqual(200))
						.then(done, done.fail);
				});
			});
			describe('asynchronous', () => {
				it('waits for promises to resolve or reject before responding', done => {
					requestHandler.and.callFake(() => {
						expect(requestHandler).toHaveBeenCalled();
						expect(lambdaContext.done).not.toHaveBeenCalled();
						done();
						return new Promise(() => false);
					});
					underTest.proxyRouter(proxyRequest, lambdaContext)
						.then(done.fail, done.fail);
				});

				it('synchronously handles plain objects that have a then key, but are not promises', done => {
					requestHandler.and.returnValue({then: 1});
					underTest.proxyRouter(proxyRequest, lambdaContext)
						.then(() => expect(responseStatusCode()).toEqual(200))
						.then(done, done.fail);
				});
				it('handles request promise rejecting', done => {
					requestHandler.and.returnValue(requestPromise);
					underTest.proxyRouter(proxyRequest, lambdaContext)
						.then(() => expect(responseStatusCode()).toEqual(500))
						.then(done, done.fail);
					requestReject('Abort');
				});
				it('handles request promise resolving', done => {
					requestHandler.and.returnValue(requestPromise);
					underTest.proxyRouter(proxyRequest, lambdaContext)
						.then(() => expect(responseStatusCode()).toEqual(200))
						.then(done, done.fail);
					requestResolve({hi: 'there'});
				});
			});
		});

		describe('result packaging', () => {
			describe('error handling', () => {
				beforeEach(() => {
					requestHandler.and.throwError('Oh!');
				});

				describe('status code', () => {
					it('uses 500 by default', done => {
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(500))
							.then(done, done.fail);
					});
					it('can configure code with handler error as a number', done => {
						underTest.get('/echo', requestHandler, {
							error: 404
						});
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(404))
							.then(done, done.fail);
					});
					it('can configure code with handler error as an object key', done => {
						underTest.get('/echo', requestHandler, {
							error: { code: 404 }
						});
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(404))
							.then(done, done.fail);
					});
					it('uses a default if handler error is defined as an object, but without code', done => {
						underTest.get('/echo', requestHandler, {
							error: { contentType: 'text/plain' }
						});
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(500))
							.then(done, done.fail);
					});
					it('uses dynamic response code if provided', done => {
						requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('', {}, 403)));
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(403))
							.then(done, done.fail);
					});
					it('uses dynamic response code over static definitions', done => {
						requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('', {}, 503)));
						underTest.get('/echo', requestHandler, {
							error: 404
						});
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(503))
							.then(done, done.fail);
					});
					it('uses a static definition with ApiResponse if code is not set', done => {
						underTest.get('/echo', requestHandler, {
							error: 404
						});
						requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('', {})));
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(404))
							.then(done, done.fail);
					});
					it('uses 500 with ApiResponse if code is not set and there is no static override', done => {
						requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('', {})));
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(500))
							.then(done, done.fail);
					});
				});

				/**/

				describe('header values', () => {
					describe('Content-Type', () => {
						it('uses application/json as the content type by default', done => {
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('application/json'))
								.then(done, done.fail);
						});
						it('uses content type is specified in the handler config', done => {
							underTest.get('/echo', requestHandler, {
								error: { contentType: 'text/plain' }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/plain'))
								.then(done, done.fail);
						});
						it('uses content type specified in a static header', done => {
							underTest.get('/echo', requestHandler, {
								error: { headers: { 'Content-Type': 'text/plain' } }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/plain'))
								.then(done, done.fail);
						});
						it('works with mixed case specified in a static header', done => {
							underTest.get('/echo', requestHandler, {
								error: { headers: { 'conTent-tyPe': 'text/plain' } }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/plain'))
								.then(done, done.fail);
						});
						it('ignores static headers that do not specify content type', done => {
							underTest.get('/echo', requestHandler, {
								error: { headers: { 'a-api-type': 'text/plain' } }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('application/json'))
								.then(done, done.fail);
						});
						it('ignores enumerated headers - backwards compatibility', done => {
							underTest.get('/echo', requestHandler, {
								error: { headers: ['a-api-type', 'text/plain'] }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('application/json'))
								.then(done, done.fail);
						});
						it('uses content type specified in a dynamic header', done => {
							requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('', {'Content-Type': 'text/xml'})));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/xml'))
								.then(done, done.fail);
						});
						it('works with mixed case specified in dynamic header', done => {
							requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('', {'Content-Type': 'text/xml'})));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/xml'))
								.then(done, done.fail);
						});
						it('uses dynamic header over everything else', done => {
							underTest.get('/echo', requestHandler, {
								error: { contentType: 'text/xml', headers: { 'Content-Type': 'text/plain' } }
							});
							requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('', {'Content-Type': 'text/markdown'})));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/markdown'))
								.then(done, done.fail);
						});
						it('uses static header over handler config', done => {
							underTest.get('/echo', requestHandler, {
								error: { contentType: 'text/xml', headers: { 'Content-Type': 'text/plain' } }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/plain'))
								.then(done, done.fail);
						});
					});
					describe('CORS headers', () => {
						it('automatically includes CORS headers with the response', done => {
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									expect(responseHeaders()).toEqual(jasmine.objectContaining({
										'Access-Control-Allow-Origin': '*',
										'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
										'Access-Control-Allow-Methods': 'GET,OPTIONS'
									}));
								})
								.then(done, done.fail);
						});
						it('uses custom origin if provided', done => {
							underTest.corsOrigin('blah.com');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									expect(responseHeaders()).toEqual(jasmine.objectContaining({
										'Access-Control-Allow-Origin': 'blah.com',
										'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
										'Access-Control-Allow-Methods': 'GET,OPTIONS'
									}));
								})
								.then(done, done.fail);
						});
						it('uses custom Allow-Headers if provided', done => {
							underTest.corsHeaders('X-Api-Key1');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Access-Control-Allow-Headers')).toEqual('X-Api-Key1'))
								.then(done, done.fail);
						});
						it('clears headers if cors is not allowed', done => {
							underTest.corsOrigin(false);
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									const headers = responseHeaders();
									expect (headers.hasOwnProperty('Access-Control-Allow-Origin')).toBeFalsy();
									expect (headers.hasOwnProperty('Access-Control-Allow-Headers')).toBeFalsy();
									expect (headers.hasOwnProperty('Access-Control-Allow-Methods')).toBeFalsy();
								})
								.then(done, done.fail);
						});
						it('reports all methods as allowed in case of a {proxy+} route request not matching any configured route', done => {
							proxyRequest = {
								requestContext: {
									resourcePath: '/abc/def',
									httpMethod: 'OPTIONS'
								}
							};
							underTest.corsOrigin(() => 'something.com');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									expect(responseHeaders()).toEqual(jasmine.objectContaining({
										'Access-Control-Allow-Origin': 'something.com',
										'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
										'Access-Control-Allow-Methods': 'DELETE,GET,HEAD,PATCH,POST,PUT,OPTIONS'
									}));
								})
								.then(done, done.fail);

						});
					});
					describe('static headers', () => {
						it('can supply additional static headers in the handler config', done => {
							underTest.get('/echo', requestHandler, {
								error: { contentType: 'text/xml', headers: { 'Api-Key': 'text123' } }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Api-Key')).toEqual('text123'))
								.then(done, done.fail);
						});
						it('ignores enumerated static headers -- backwards compatibility', done => {
							underTest.get('/echo', requestHandler, {
								error: { contentType: 'text/xml', headers: ['Api-Key'] }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Api-Key')).toBeUndefined())
								.then(done, done.fail);
						});
						it('overrides CORS headers with static headers', done => {
							underTest.get('/echo', requestHandler, {
								error: { contentType: 'text/xml', headers: {'Access-Control-Allow-Origin': 'x.com' } }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Access-Control-Allow-Origin')).toEqual('x.com'))
								.then(done, done.fail);
						});
					});
					describe('dynamic headers', () => {
						it('can supply additional dynamic headers in the response', done => {
							requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('', {'Api-Type': 'text/markdown'})));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Api-Type')).toEqual('text/markdown'))
								.then(done, done.fail);
						});
						it('overrides static headers with dynamic headers', done => {
							underTest.get('/echo', requestHandler, {
								error: { contentType: 'text/xml', headers: { 'Api-Type': '123'} }
							});
							requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('', {'Api-Type': 'text/markdown'})));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Api-Type')).toEqual('text/markdown'))
								.then(done, done.fail);
						});
						it('overrides CORS headers with dynamic headers', done => {
							requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('', {'Access-Control-Allow-Origin': 'x.com'})));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Access-Control-Allow-Origin')).toEqual('x.com'))
								.then(done, done.fail);
						});
					});
					describe('when result code is a redirect', () => {
						beforeEach(() => {
							requestHandler.and.callFake(() => {
								throw 'https://www.google.com';
							});
						});
						it('packs the result into the location header', done => {
							underTest.get('/echo', requestHandler, {
								error: 302
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.google.com'))
								.then(done, done.fail);
						});
						it('includes CORS headers', done => {
							underTest.get('/echo', requestHandler, {
								error: 302
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Access-Control-Allow-Origin')).toEqual('*'))
								.then(done, done.fail);
						});
						it('uses the dynamic headers if provided', done => {
							underTest.get('/echo', requestHandler, {
								error: 302
							});
							requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('https://www.google.com', {'Location': 'https://www.amazon.com'})));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.amazon.com'))
								.then(done, done.fail);
						});
						it('uses body of a dynamic response if no location header', done => {
							underTest.get('/echo', requestHandler, {
								error: 302
							});
							requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('https://www.google.com', {'X-Val1': 'v2'})));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									expect(responseHeaders('Location')).toEqual('https://www.google.com');
									expect(responseHeaders('X-Val1')).toEqual('v2');
								})
								.then(done, done.fail);
						});
						it('uses mixed case dynamic header', done => {
							underTest.get('/echo', requestHandler, {
								error: 302
							});
							requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('https://www.google.com', {'LocaTion': 'https://www.amazon.com'})));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.amazon.com'))
								.then(done, done.fail);
						});
						it('uses the static header if no response body', done => {
							underTest.get('/echo', requestHandler, {
								error: { code: 302, headers: {'Location': 'https://www.google.com'} }
							});
							requestHandler.and.returnValue(Promise.reject());
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.google.com'))
								.then(done, done.fail);
						});
						it('uses the response body over the static header', done => {
							underTest.get('/echo', requestHandler, {
								error: { code: 302, headers: {'Location': 'https://www.google.com'} }
							});
							requestHandler.and.returnValue(Promise.reject('https://www.xkcd.com'));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.xkcd.com'))
								.then(done, done.fail);
						});
						it('uses the dynamic header value over the static header', done => {
							underTest.get('/echo', requestHandler, {
								error: { code: 302, headers: {'Location': 'https://www.google.com'} }
							});
							requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('https://www.google.com', {'Location': 'https://www.amazon.com'})));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.amazon.com'))
								.then(done, done.fail);
						});
					});
					describe('when the result code is 3xx but not a redirect', () => {
						it('does not modify the body or the headers', done => {
							underTest.get('/echo', requestHandler, {
								success: { code: 304 }
							});
							requestHandler.and.returnValue({hi: 'there'});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									expect(JSON.parse(responseBody())).toEqual({hi: 'there'});
									expect(responseHeaders('Location')).toBeUndefined();
								})
								.then(done, done.fail);
						});
					});
				});
				describe('error logging', () => {
					it('logs stack from error objects', done => {
						const e = new Error('exploded!');
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(logger).toHaveBeenCalledWith(e.stack))
							.then(done, done.fail);
						requestHandler.and.throwError(e);
					});
					it('logs string error messages', done => {
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(logger).toHaveBeenCalledWith('boom!'))
							.then(done, done.fail);
						requestHandler.and.callFake(() => {
							throw 'boom!';
						});
					});
					it('logs JSON stringify of an API response object', done => {
						const apiResp = new underTest.ApiResponse('boom!', {'X-Api': 1}, 404);
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(logger).toHaveBeenCalledWith(JSON.stringify(apiResp)))
							.then(done, done.fail);
						requestHandler.and.returnValue(Promise.reject(apiResp));

					});
					it('survives circular JSON when logging API response object', done => {
						const apiResp = new underTest.ApiResponse('boom!', {'X-Api': 1}, 404);
						apiResp.resp = apiResp;
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(logger).toHaveBeenCalledWith('[Circular]'))
							.then(done, done.fail);
						requestHandler.and.returnValue(Promise.reject(apiResp));

					});

				});
				describe('result formatting', () => {
					['application/json', 'application/json; charset=UTF-8'].forEach(respContentType => {
						describe(`when content type is ${respContentType}`, () => {
							beforeEach(() => {
								underTest.get('/echo', requestHandler, {
									error: { headers: { 'Content-Type': respContentType } }
								});
							});
							it('extracts message from Error objects', done => {
								underTest.proxyRouter(proxyRequest, lambdaContext)
									.then(() => expect(responseBody()).toEqual('{"errorMessage":"boom!"}'))
									.then(done, done.fail);
								requestHandler.and.throwError('boom!');
							});

							it('includes string error messages', done => {
								underTest.proxyRouter(proxyRequest, lambdaContext)
									.then(() => expect(responseBody()).toEqual('{"errorMessage":"boom!"}'))
									.then(done, done.fail);
								requestHandler.and.callFake(() => {
									throw 'boom!';
								});
							});
							it('extracts message from rejected async Errors', done => {
								underTest.proxyRouter(proxyRequest, lambdaContext)
									.then(() => expect(responseBody()).toEqual('{"errorMessage":"boom!"}'))
									.then(done, done.fail);
								requestHandler.and.callFake(() => new Promise(() => {
									throw new Error('boom!');
								}));
							});
							it('extracts message from rejected promises', done => {
								underTest.proxyRouter(proxyRequest, lambdaContext)
									.then(() => expect(responseBody()).toEqual('{"errorMessage":"boom!"}'))
									.then(done, done.fail);
								requestHandler.and.returnValue(Promise.reject('boom!'));
							});
							it('survives circular JSON', done => {
								const circular = {name: 'explosion'};
								circular.circular = circular;

								underTest.proxyRouter(proxyRequest, lambdaContext)
									.then(() => expect(responseBody()).toEqual('{"errorMessage":"[Circular]"}'))
									.then(done, done.fail);
								requestHandler.and.returnValue(Promise.reject(circular));
							});
							it('extracts content from ApiResponse objects', done => {
								underTest.proxyRouter(proxyRequest, lambdaContext)
									.then(() => {
										expect(responseBody()).toEqual('{"errorMessage":"boom!"}');
										expect(responseStatusCode()).toEqual(404);
									}).then(done, done.fail);
								requestHandler.and.returnValue(Promise.reject(new underTest.ApiResponse('boom!', {'X-Api': 1}, 404)));
							});
							['', undefined, null, false].forEach(literal => {
								it(`uses blank message for [${literal}]`, done => {
									underTest.proxyRouter(proxyRequest, lambdaContext)
										.then(() => expect(responseBody()).toEqual('{"errorMessage":""}'))
										.then(done, done.fail);
									requestHandler.and.returnValue(Promise.reject(literal));
								});
							});
						});
					});
					describe('when content type is not JSON', () => {
						beforeEach(() => {
							underTest.get('/echo', requestHandler, {
								error: { headers: { 'Content-Type': 'application/xml' } }
							});
						});
						it('extracts message from Error objects', done => {
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('boom!'))
								.then(done, done.fail);
							requestHandler.and.throwError('boom!');
						});
						it('includes string error messages', done => {
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('boom!'))
								.then(done, done.fail);
							requestHandler.and.callFake(() => {
								throw 'boom!';
							});
						});
						it('extracts message from rejected async Errors', done => {
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('boom!'))
								.then(done, done.fail);
							requestHandler.and.callFake(() => new Promise(() => {
								throw new Error('boom!');
							}));
						});
						it('extracts message from rejected promises', done => {
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('boom!'))
								.then(done, done.fail);
							requestHandler.and.returnValue(Promise.reject('boom!'));
						});
						['', undefined, null, false].forEach(literal => {
							it(`uses blank message for [${literal}]`, done => {
								underTest.proxyRouter(proxyRequest, lambdaContext)
									.then(() => expect(responseBody()).toEqual(''))
									.then(done, done.fail);
								requestHandler.and.returnValue(Promise.reject(literal));
							});
						});
					});
				});
				/**/

			});
			describe('success handling', () => {
				describe('status code', () => {
					it('uses 200 by default', done => {
						requestHandler.and.returnValue({hi: 'there'});
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(200))
							.then(done, done.fail);
					});
					it('can configure success code with handler success as a number', done => {
						requestHandler.and.returnValue({hi: 'there'});
						underTest.get('/echo', requestHandler, {
							success: 204
						});
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(204))
							.then(done, done.fail);
					});
					it('can configure success code with handler success as an object key', done => {
						requestHandler.and.returnValue({hi: 'there'});
						underTest.get('/echo', requestHandler, {
							success: { code: 204 }
						});
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(204))
							.then(done, done.fail);
					});
					it('uses a default if success is defined as an object, but without code', done => {
						requestHandler.and.returnValue({hi: 'there'});
						underTest.get('/echo', requestHandler, {
							success: { contentType: 'text/plain' }
						});
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(200))
							.then(done, done.fail);
					});
					it('uses dynamic response code if provided', done => {
						requestHandler.and.returnValue(new underTest.ApiResponse('', {}, 203));
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(203))
							.then(done, done.fail);
					});
					it('uses dynamic response code over static definitions', done => {
						underTest.get('/echo', requestHandler, {
							success: 204
						});
						requestHandler.and.returnValue(new underTest.ApiResponse('', {}, 203));
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(203))
							.then(done, done.fail);
					});
					it('uses a static definition with ApiResponse if code is not set', done => {
						underTest.get('/echo', requestHandler, {
							success: 204
						});
						requestHandler.and.returnValue(new underTest.ApiResponse('', {}));
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(204))
							.then(done, done.fail);
					});
					it('uses 200 with ApiResponse if code is not set and there is no static override', done => {
						requestHandler.and.returnValue(new underTest.ApiResponse('', {}));
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseStatusCode()).toEqual(200))
							.then(done, done.fail);
					});
				});
				describe('isBase64Encoded', () => {
					it('is not set if the contentHandling is not defined', done => {
						underTest.get('/echo', requestHandler);
						requestHandler.and.returnValue('hi there');
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseBase64Flag()).toBeUndefined())
							.then(done, done.fail);
					});
					it('is not set if the contentHandling is CONVERT_TO_TEXT', done => {
						underTest.get('/echo', requestHandler, { success: { contentHandling: 'CONVERT_TO_TEXT' }});
						requestHandler.and.returnValue('hi there');
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseBase64Flag()).toBeUndefined())
							.then(done, done.fail);
					});
					it('is set if the responseContentHandling is CONVERT_TO_BINARY', done => {
						underTest.get('/echo', requestHandler, { success: {contentHandling: 'CONVERT_TO_BINARY' }});
						requestHandler.and.returnValue('hi there');
						underTest.proxyRouter(proxyRequest, lambdaContext)
							.then(() => expect(responseBase64Flag()).toBe(true))
							.then(done, done.fail);
					});
				});
				describe('header values', () => {
					describe('Content-Type', () => {
						it('uses application/json as the content type by default', done => {
							requestHandler.and.returnValue({hi: 'there'});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('application/json'))
								.then(done, done.fail);
						});
						it('uses content type is specified in the handler config', done => {
							underTest.get('/echo', requestHandler, {
								success: { contentType: 'text/plain' }
							});
							requestHandler.and.returnValue({hi: 'there'});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/plain'))
								.then(done, done.fail);
						});
						it('uses content type specified in a static header', done => {
							underTest.get('/echo', requestHandler, {
								success: { headers: { 'Content-Type': 'text/plain' } }
							});
							requestHandler.and.returnValue({hi: 'there'});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/plain'))
								.then(done, done.fail);
						});
						it('works with mixed case specified in a static header', done => {
							underTest.get('/echo', requestHandler, {
								success: { headers: { 'conTent-tyPe': 'text/plain' } }
							});
							requestHandler.and.returnValue({hi: 'there'});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/plain'))
								.then(done, done.fail);
						});
						it('ignores static headers that do not specify content type', done => {
							underTest.get('/echo', requestHandler, {
								success: { headers: { 'a-api-type': 'text/plain' } }
							});
							requestHandler.and.returnValue({hi: 'there'});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('application/json'))
								.then(done, done.fail);

						});
						it('ignores enumerated headers - backwards compatibility', done => {
							underTest.get('/echo', requestHandler, {
								success: { headers: ['a-api-type', 'text/plain'] }
							});
							requestHandler.and.returnValue({hi: 'there'});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('application/json'))
								.then(done, done.fail);
						});
						it('uses content type specified in a dynamic header', done => {
							requestHandler.and.returnValue(new underTest.ApiResponse('', {'Content-Type': 'text/xml'}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/xml'))
								.then(done, done.fail);
						});
						it('works with mixed case specified in dynamic header', done => {
							requestHandler.and.returnValue(new underTest.ApiResponse('', {'Content-Type': 'text/xml'}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/xml'))
								.then(done, done.fail);
						});
						it('uses dynamic header over everything else', done => {
							underTest.get('/echo', requestHandler, {
								success: { contentType: 'text/xml', headers: { 'Content-Type': 'text/plain' } }
							});
							requestHandler.and.returnValue(new underTest.ApiResponse('', {'Content-Type': 'text/markdown'}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/markdown'))
								.then(done, done.fail);
						});
						it('uses static header over handler config', done => {
							underTest.get('/echo', requestHandler, {
								success: { contentType: 'text/xml', headers: { 'Content-Type': 'text/plain' } }
							});
							requestHandler.and.returnValue('abc');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(contentType()).toEqual('text/plain'))
								.then(done, done.fail);
						});
					});
					describe('CORS headers', () => {
						beforeEach(() => {
							requestHandler.and.returnValue('abc');
						});
						it('automatically includes CORS headers with the response', done => {
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									expect(responseHeaders()).toEqual(jasmine.objectContaining({
										'Access-Control-Allow-Origin': '*',
										'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
										'Access-Control-Allow-Methods': 'GET,OPTIONS'
									}));
								})
								.then(done, done.fail);
						});
						it('uses custom origin if provided', done => {
							underTest.corsOrigin('blah.com');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									expect(responseHeaders()).toEqual(jasmine.objectContaining({
										'Access-Control-Allow-Origin': 'blah.com',
										'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
										'Access-Control-Allow-Methods': 'GET,OPTIONS'
									}));
								})
								.then(done, done.fail);
						});
						it('uses custom Allow-Headers if provided', done => {
							underTest.corsHeaders('X-Api-Key1');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Access-Control-Allow-Headers')).toEqual('X-Api-Key1'))
								.then(done, done.fail);
						});
						it('clears headers if cors is not allowed', done => {
							underTest.corsOrigin(false);
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									const headers = responseHeaders();
									expect (headers.hasOwnProperty('Access-Control-Allow-Origin')).toBeFalsy();
									expect (headers.hasOwnProperty('Access-Control-Allow-Headers')).toBeFalsy();
									expect (headers.hasOwnProperty('Access-Control-Allow-Methods')).toBeFalsy();
								})
								.then(done, done.fail);
						});
					});
					describe('static headers', () => {
						it('can supply additional static headers in the handler config', done => {
							underTest.get('/echo', requestHandler, {
								success: { contentType: 'text/xml', headers: { 'Api-Key': 'text123' } }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Api-Key')).toEqual('text123'))
								.then(done, done.fail);
						});
						it('ignores enumerated static headers -- backwards compatibility', done => {
							underTest.get('/echo', requestHandler, {
								success: { contentType: 'text/xml', headers: ['Api-Key'] }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Api-Key')).toBeUndefined())
								.then(done, done.fail);
						});
						it('overrides CORS headers with static headers', done => {
							underTest.get('/echo', requestHandler, {
								success: { contentType: 'text/xml', headers: {'Access-Control-Allow-Origin': 'x.com' } }
							});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Access-Control-Allow-Origin')).toEqual('x.com'))
								.then(done, done.fail);
						});
					});
					describe('dynamic headers', () => {
						it('can supply additional dynamic headers in the response', done => {
							requestHandler.and.returnValue(new underTest.ApiResponse('', {'Api-Type': 'text/markdown'}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Api-Type')).toEqual('text/markdown'))
								.then(done, done.fail);
						});
						it('overrides static headers with dynamic headers', done => {
							underTest.get('/echo', requestHandler, {
								success: { contentType: 'text/xml', headers: { 'Api-Type': '123'} }
							});
							requestHandler.and.returnValue(new underTest.ApiResponse('', {'Api-Type': 'text/markdown'}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Api-Type')).toEqual('text/markdown'))
								.then(done, done.fail);
						});
						it('overrides CORS headers with dynamic headers', done => {
							requestHandler.and.returnValue(new underTest.ApiResponse('', {'Access-Control-Allow-Origin': 'x.com'}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Access-Control-Allow-Origin')).toEqual('x.com'))
								.then(done, done.fail);
						});
					});
					describe('when result code is a redirect', () => {
						it('packs the result into the location header', done => {
							underTest.get('/echo', requestHandler, {
								success: 302
							});
							requestHandler.and.returnValue('https://www.google.com');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.google.com'))
								.then(done, done.fail);
						});
						it('includes CORS headers', done => {
							underTest.get('/echo', requestHandler, {
								success: 302
							});
							requestHandler.and.returnValue('https://www.google.com');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Access-Control-Allow-Origin')).toEqual('*'))
								.then(done, done.fail);
						});
						it('uses the dynamic headers if provided', done => {
							underTest.get('/echo', requestHandler, {
								success: 302
							});
							requestHandler.and.returnValue(new underTest.ApiResponse('https://www.google.com', {'Location': 'https://www.amazon.com'}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.amazon.com'))
								.then(done, done.fail);
						});
						it('uses body of a dynamic response if no location header', done => {
							underTest.get('/echo', requestHandler, {
								success: 302
							});
							requestHandler.and.returnValue(new underTest.ApiResponse('https://www.google.com', {'X-Val1': 'v2'}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									expect(responseHeaders('Location')).toEqual('https://www.google.com');
									expect(responseHeaders('X-Val1')).toEqual('v2');
								})
								.then(done, done.fail);
						});
						it('uses mixed case dynamic header', done => {
							underTest.get('/echo', requestHandler, {
								success: 302
							});
							requestHandler.and.returnValue(new underTest.ApiResponse('https://www.google.com', {'LocaTion': 'https://www.amazon.com'}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.amazon.com'))
								.then(done, done.fail);
						});
						it('uses the static header if no response body', done => {
							underTest.get('/echo', requestHandler, {
								success: { code: 302, headers: {'Location': 'https://www.google.com'} }
							});
							requestHandler.and.returnValue('');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.google.com'))
								.then(done, done.fail);
						});
						it('uses the response body over the static header', done => {
							underTest.get('/echo', requestHandler, {
								success: { code: 302, headers: {'Location': 'https://www.google.com'} }
							});
							requestHandler.and.returnValue('https://www.xkcd.com');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.xkcd.com'))
								.then(done, done.fail);
						});
						it('uses the dynamic header value over the static header', done => {
							underTest.get('/echo', requestHandler, {
								success: { code: 302, headers: {'Location': 'https://www.google.com'} }
							});
							requestHandler.and.returnValue(new underTest.ApiResponse('https://www.google.com', {'Location': 'https://www.amazon.com'}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseHeaders('Location')).toEqual('https://www.amazon.com'))
								.then(done, done.fail);
						});
					});

				});
				describe('result formatting', () => {
					['application/json', 'application/json; charset=UTF-8'].forEach(function (respContentType) {
						describe(`when content type is ${respContentType}`, () => {
							beforeEach(() => {
								underTest.get('/echo', requestHandler, {
									success: { headers: { 'Content-Type': respContentType } }
								});
							});
							it('stringifies objects', done => {
								requestHandler.and.returnValue({hi: 'there'});
								underTest.proxyRouter(proxyRequest, lambdaContext)
									.then(() => {
										expect(responseBody()).toEqual('{"hi":"there"}');
										expect(responseStatusCode()).toEqual(200);
									})
									.then(done, done.fail);
							});
							it('survives circular results', done => {
								const circular = {hi: 'there'};
								circular.circular = circular;
								requestHandler.and.returnValue(circular);
								underTest.proxyRouter(proxyRequest, lambdaContext)
									.then(() =>  {
										expect(responseStatusCode()).toEqual(500);
										expect(responseBody()).toEqual('{"errorMessage":"Response contains a circular reference and cannot be serialized to JSON"}');
									})
									.then(done, done.fail);
							});
							it('JSON-stringifies non objects', done => {
								requestHandler.and.returnValue('OK');
								underTest.proxyRouter(proxyRequest, lambdaContext)
									.then(() => expect(responseBody()).toEqual('"OK"'))
									.then(done, done.fail);
							});
							['', undefined].forEach(function (literal) {
								it(`uses blank object for [${literal}]`, done => {
									requestHandler.and.returnValue(literal);
									underTest.proxyRouter(proxyRequest, lambdaContext)
										.then(() => expect(responseBody()).toEqual('{}'))
										.then(done, done.fail);
								});
							});
							[null, false].forEach(function (literal) {
								it(`uses literal version for ${literal}`, done => {
									requestHandler.and.returnValue(literal);
									underTest.proxyRouter(proxyRequest, lambdaContext)
										.then(() => expect(responseBody()).toEqual('' + literal))
										.then(done, done.fail);
								});
							});
						});
					});
					describe('when content type is not JSON', () => {
						beforeEach(() => {
							underTest.get('/echo', requestHandler, {
								success: { headers: { 'Content-Type': 'application/xml' } }
							});
						});
						it('stringifies objects', done => {
							requestHandler.and.returnValue({hi: 'there'});
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('{"hi":"there"}'))
								.then(done, done.fail);
						});
						it('survives circular responses', done => {
							const circular = {hi: 'there'};
							circular.circular = circular;
							requestHandler.and.returnValue(circular);
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => {
									expect(responseBody()).toEqual('[Circular]');
									expect(responseStatusCode()).toEqual(200);
								})
								.then(done, done.fail);
						});
						it('base64 encodes buffers', done => {
							requestHandler.and.returnValue(new Buffer([100, 200, 300]));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('ZMgs'))
								.then(done, done.fail);
						});
						it('extracts content from ApiResponse objects', done => {
							requestHandler.and.returnValue(new underTest.ApiResponse('content123', {}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('content123'))
								.then(done, done.fail);
						});
						it('stringifies objects from ApiResponse objects', done => {
							requestHandler.and.returnValue(new underTest.ApiResponse({'h1': 'content123'}, {}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('{"h1":"content123"}'))
								.then(done, done.fail);
						});
						it('base64 encodes buffers from ApiResponse objects', done => {
							requestHandler.and.returnValue(new underTest.ApiResponse(new Buffer([100, 200, 300]), {}));
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('ZMgs'))
								.then(done, done.fail);
						});
						it('returns literal results for strings', done => {
							requestHandler.and.returnValue('OK');
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('OK'))
								.then(done, done.fail);
						});
						it('returns string results for numbers', done => {
							requestHandler.and.returnValue(123);
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('123'))
								.then(done, done.fail);
						});
						it('returns string results for true', done => {
							requestHandler.and.returnValue(true);
							underTest.proxyRouter(proxyRequest, lambdaContext)
								.then(() => expect(responseBody()).toEqual('true'))
								.then(done, done.fail);
						});
						describe('uses blank string for', () => {
							[null, false, '', undefined].forEach(function (resp) {
								it(`[${resp}]`, done => {
									requestHandler.and.returnValue(resp);
									underTest.proxyRouter(proxyRequest, lambdaContext)
										.then(() => expect(responseBody()).toEqual(''))
										.then(done, done.fail);
								});
							});
						});
					});
				});
			});
		});

		describe('intercepting calls', () => {
			let interceptSpy;
			beforeEach(() => {
				interceptSpy = jasmine.createSpy();
				underTest.get('/echo', requestHandler);
				underTest.post('/echo', postRequestHandler);
				underTest.intercept(interceptSpy);
			});
			it('passes the converted proxy request to interceptor if the request comes from API gateway', done => {
				interceptSpy.and.returnValue(false);
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => expect(interceptSpy.calls.argsFor(0)[0]).toEqual(apiRequest))
					.then(done, done.fail);
			});
			it('passes the original request to interception if it does not come from API Gateway', done => {
				const customObject = {
					slackRequest: 'abc',
					slackToken: 'def'
				};
				underTest.proxyRouter(customObject, lambdaContext)
					.then(() => expect(interceptSpy.calls.argsFor(0)[0]).toEqual(customObject))
					.then(done, done.fail);
			});
			it('rejects if the intercept rejects', done => {
				interceptSpy.and.returnValue(Promise.reject('BOOM'));
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
						expect(requestHandler).not.toHaveBeenCalled();
						expect(postRequestHandler).not.toHaveBeenCalled();
						expect(lambdaContext.done).toHaveBeenCalledWith('BOOM');
					})
					.then(done, done.fail);
			});
			it('rejects if the intercept throws an exception', done => {
				interceptSpy.and.throwError('BOOM');
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
						expect(requestHandler).not.toHaveBeenCalled();
						expect(postRequestHandler).not.toHaveBeenCalled();
						expect(lambdaContext.done.calls.mostRecent().args[0].message).toEqual('BOOM');
					})
					.then(done, done.fail);
			});
			it('passes if the intercept throws an ApiResponse exception', done => {
				interceptSpy.and.returnValue(new underTest.ApiResponse('BODY', {}, 403));
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
						expect(requestHandler).not.toHaveBeenCalled();
						expect(postRequestHandler).not.toHaveBeenCalled();
						expect(responseStatusCode()).toEqual(403);
						expect(responseBody()).toEqual('"BODY"');
						expect(contentType()).toEqual('application/json');
					})
					.then(done, done.fail);
			});
			it('routes the event returned from intercept', done => {
				interceptSpy.and.returnValue({
					context: {
						path: '/echo',
						method: 'POST'
					},
					queryString: {
						c: 'd'
					}
				});
				underTest.proxyRouter(proxyRequest, lambdaContext).then(() => {
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
			it('routes the event resolved by the intercept promise', done => {
				interceptSpy.and.returnValue(Promise.resolve({
					context: {
						path: '/echo',
						method: 'POST'
					},
					queryString: {
						c: 'd'
					}
				}));
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
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
					})
					.then(done, done.fail);
			});
			it('aborts if the intercept returns a falsy value', done => {
				interceptSpy.and.returnValue(false);
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
						expect(requestHandler).not.toHaveBeenCalled();
						expect(postRequestHandler).not.toHaveBeenCalled();
						expect(lambdaContext.done).toHaveBeenCalledWith(null, null);
					})
					.then(done, done.fail);
			});
			it('aborts if the intercept resolves with a falsy value', done => {
				interceptSpy.and.returnValue(Promise.resolve(false));
				underTest.proxyRouter(proxyRequest, lambdaContext)
					.then(() => {
						expect(requestHandler).not.toHaveBeenCalled();
						expect(postRequestHandler).not.toHaveBeenCalled();
						expect(lambdaContext.done).toHaveBeenCalledWith(null, null);
					})
					.then(done, done.fail);
			});
		});
	});
	describe('unsupported event format', () => {
		it('causes lambda context to complete with error if no custom handler', done => {
			underTest.router({}, lambdaContext)
				.then(() => expect(lambdaContext.done).toHaveBeenCalledWith('event does not contain routing information'))
				.then(done, done.fail);
		});
		it('calls custom handler if provided', done => {
			const fakeCallback = jasmine.createSpy();
			underTest.unsupportedEvent((event, context, callback) => {
				expect(event).toEqual({a: 1});
				expect(context).toEqual(lambdaContext);
				expect(callback).toEqual(fakeCallback);
				expect(lambdaContext.done).not.toHaveBeenCalled();
				done();
			});
			underTest.proxyRouter({a: 1}, lambdaContext, fakeCallback);
		});
	});

	describe('CORS handling', () => {
		let apiRequest;
		beforeEach(() => {
			apiRequest = { context: { path: '/existing', method: 'OPTIONS' } };
			underTest.get('/existing', requestHandler);
		});
		it('does not set corsHandlers unless corsOrigin called', () => {
			expect(underTest.apiConfig().corsHandlers).toBeUndefined();
		});
		it('sets corsHandlers to false if called with false', () => {
			underTest.corsOrigin(false);
			expect(underTest.apiConfig().corsHandlers).toBe(false);
		});
		it('sets corsHandlers to true if passed a function', () => {
			underTest.corsOrigin(() => { });
			expect(underTest.apiConfig().corsHandlers).toBe(true);
		});
		it('sets corsHandlers to true if passed a string', () => {
			underTest.corsOrigin('origin');
			expect(underTest.apiConfig().corsHandlers).toBe(true);
		});
		it('sets corsMaxAge to 10', () => {
			underTest.corsMaxAge(10);
			expect(underTest.apiConfig().corsMaxAge).toBe(10);
		});

		it('routes OPTIONS to return the default configuration if no parameters set', done => {
			underTest.router(apiRequest, lambdaContext)
				.then(() => {
					expect(lambdaContext.done).toHaveBeenCalledWith(null, {
						statusCode: 200,
						headers: {
							'Access-Control-Allow-Origin': '*',
							'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
							'Access-Control-Allow-Methods': 'GET,OPTIONS',
							'Access-Control-Allow-Credentials': 'true',
							'Access-Control-Max-Age': '0'
						},
						body: ''
					});
				})
				.then(done, done.fail);
		});
		it('routes OPTIONS to return no header values if origin is set to false', done => {
			underTest.corsOrigin(false);
			underTest.router(apiRequest, lambdaContext)
				.then(() => {
					expect(lambdaContext.done).toHaveBeenCalledWith(null, {
						statusCode: 200,
						headers: {
						},
						body: ''
					});
				})
				.then(done, done.fail);
		});
		it('routes OPTIONS to return the result of a custom CORS handler in the Allowed-Origins header', done => {
			const corsHandler = jasmine.createSpy('corsHandler').and.returnValue('custom-origin');
			underTest.corsOrigin(corsHandler);
			underTest.router(apiRequest, lambdaContext)
				.then(() => {
					expect(corsHandler).toHaveBeenCalledWith(apiRequest);
					expect(lambdaContext.done).toHaveBeenCalledWith(null, {
						statusCode: 200,
						headers: {
							'Access-Control-Allow-Origin': 'custom-origin',
							'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
							'Access-Control-Allow-Methods': 'GET,OPTIONS',
							'Access-Control-Allow-Credentials': 'true',
							'Access-Control-Max-Age': '0'
						},
						body: ''
					});
				})
				.then(done, done.fail);
		});
		it('routes OPTIONS to return the result of a promise resolved by the CORS handler', done => {
			const corsPromise = Promise.resolve('custom-origin'),
				corsHandler = jasmine.createSpy('corsHandler').and.returnValue(corsPromise);
			underTest.corsOrigin(corsHandler);
			underTest.router(apiRequest, lambdaContext)
				.then(() => {
					expect(corsHandler).toHaveBeenCalledWith(apiRequest);
					expect(lambdaContext.done).toHaveBeenCalledWith(null, {
						statusCode: 200,
						headers: {
							'Access-Control-Allow-Origin': 'custom-origin',
							'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
							'Access-Control-Allow-Methods': 'GET,OPTIONS',
							'Access-Control-Allow-Credentials': 'true',
							'Access-Control-Max-Age': '0'
						},
						body: ''
					});
				})
				.then(done, done.fail);
		});
		it('routes OPTIONS to return the string set by corsOrigin', done => {
			underTest.corsOrigin('custom-origin-string');
			underTest.router(apiRequest, lambdaContext)
				.then(() => {
					expect(lambdaContext.done).toHaveBeenCalledWith(null, {
						statusCode: 200,
						headers: {
							'Access-Control-Allow-Origin': 'custom-origin-string',
							'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
							'Access-Control-Allow-Methods': 'GET,OPTIONS',
							'Access-Control-Allow-Credentials': 'true',
							'Access-Control-Max-Age': '0'
						},
						body: ''
					});
				})
				.then(done, done.fail);
		});
		it('does not set corsHeaders unless corsHeaders called', () => {
			expect(underTest.apiConfig().corsHeaders).toBeUndefined();
		});
		it('sets corsHeaders to a string, if provided', () => {
			underTest.corsHeaders('X-Api-Request');
			expect(underTest.apiConfig().corsHeaders).toEqual('X-Api-Request');
		});
		it('throws an error if the cors headers is not a string', () => {
			expect(() => {
				underTest.corsHeaders(() => { });
			}).toThrow('corsHeaders only accepts strings');
		});
		it('uses corsHeaders when routing OPTIONS', done => {
			underTest.corsHeaders('X-Api-Request');
			underTest.router(apiRequest, lambdaContext)
				.then(() => {
					expect(lambdaContext.done).toHaveBeenCalledWith(null, {
						statusCode: 200,
						headers: {
							'Access-Control-Allow-Origin': '*',
							'Access-Control-Allow-Headers': 'X-Api-Request',
							'Access-Control-Allow-Methods': 'GET,OPTIONS',
							'Access-Control-Allow-Credentials': 'true',
							'Access-Control-Max-Age': '0'
						},
						body: ''
					});
				})
				.then(done, done.fail);
		});
		it('uses all available methods on a resource in Allow-Methods', done => {
			underTest.post('/existing', requestHandler);
			underTest.put('/existing', requestHandler);
			underTest.router(apiRequest, lambdaContext)
				.then(() => {
					expect(lambdaContext.done).toHaveBeenCalledWith(null, {
						statusCode: 200,
						headers: {
							'Access-Control-Allow-Origin': '*',
							'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
							'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
							'Access-Control-Allow-Credentials': 'true',
							'Access-Control-Max-Age': '0'
						},
						body: ''
					});
				})
				.then(done, done.fail);
		});
		it('routes OPTIONS to return the max-age set by corsMaxAge', done => {
			underTest.corsOrigin('custom-origin-string');
			underTest.corsMaxAge(60);
			underTest.router(apiRequest, lambdaContext)
				.then(() => {
					expect(lambdaContext.done).toHaveBeenCalledWith(null, {
						statusCode: 200,
						headers: {
							'Access-Control-Allow-Origin': 'custom-origin-string',
							'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
							'Access-Control-Allow-Methods': 'GET,OPTIONS',
							'Access-Control-Allow-Credentials': 'true',
							'Access-Control-Max-Age': 60
						},
						body: ''
					});
				})
				.then(done, done.fail);
		});
	});
	describe('post install hooks', () => {
		let pResolve, postPromise, hook;

		beforeEach(() => {
			postPromise = new Promise(resolve => {
				pResolve = resolve;
			});
			hook = jasmine.createSpy().and.returnValue(postPromise);
		});
		it('can set up a single post-install hook', done => {
			underTest.addPostDeployStep('first', (opts, config, utils) => {
				expect(opts).toEqual({a: 1});
				expect(config).toEqual({c: 2});
				expect(utils).toEqual({});
				done();
			});
			underTest.postDeploy({a: 1}, {c: 2}, {});
		});
		it('complains if the first argument is not a step name', () => {
			expect(() => {
				underTest.addPostDeployStep(hook);
			}).toThrowError('addPostDeployStep requires a step name as the first argument');
		});
		it('complains if the second argument is not a function', () => {
			expect(() => {
				underTest.addPostDeployStep('first');
			}).toThrowError('addPostDeployStep requires a function as the second argument');
		});
		it('does not execute the hook before postDeploy is called', () => {
			underTest.addPostDeployStep('first', hook);
			expect(hook).not.toHaveBeenCalled();
		});
		it('cannot add a hook with the same name twice', () => {
			underTest.addPostDeployStep('first', hook);
			expect(() => {
				underTest.addPostDeployStep('first', hook);
			}).toThrowError('Post deploy hook "first" already exists');
		});
		it('does not resolve until the post-install hook resolves', done => {
			const hasResolved = jasmine.createSpy();
			underTest.addPostDeployStep('first', hook);
			underTest.postDeploy({a: 1}, {c: 2}, {})
				.then(hasResolved, done.fail);
			Promise.resolve()
				.then(() => expect(hasResolved).not.toHaveBeenCalled())
				.then(done, done.fail);
		});
		it('resolves when the post-install resolves', done => {
			underTest.addPostDeployStep('first', hook);
			underTest.postDeploy({a: 1}, {c: 2}, {})
				.then(result => expect(result).toEqual({first: { url: 'http://www.google.com' }}))
				.then(done, done.fail);
			pResolve({url: 'http://www.google.com'});
		});
		it('works with non-promise post-install hooks', done => {
			underTest.addPostDeployStep('first', () => {
				return 'yes';
			});
			underTest.postDeploy({a: 1}, {c: 2}, {})
				.then(result => expect(result).toEqual({first: 'yes'}))
				.then(done, done.fail);
			pResolve({url: 'http://www.google.com'});
		});
		it('returns false when post-deploy hooks are not set up', done => {
			underTest.postDeploy({a: 1}, {c: 2}, {})
				.then(result => expect(result).toBeFalsy())
				.then(done, done.fail);
		});
		describe('multiple hooks', () => {
			let p2Resolve, p2Reject,
				postPromise2, hook2;
			beforeEach(() => {
				postPromise2 = new Promise((resolve, reject) => {
					p2Resolve = resolve;
					p2Reject = reject;
				});
				hook2 = jasmine.createSpy().and.returnValue(postPromise2);
				underTest.addPostDeployStep('first', hook);
				underTest.addPostDeployStep('second', hook2);
			});
			it('does not execute the hooks immediately', () => {
				expect(hook).not.toHaveBeenCalled();
				expect(hook2).not.toHaveBeenCalled();
			});
			it('does not execute the second hook until the first resolves', done => {
				hook.and.callFake((opts, config, utils) => {
					expect(opts).toEqual({a: 1});
					expect(config).toEqual({c: 2});
					expect(utils).toEqual({});
					expect(hook2).not.toHaveBeenCalled();
					done();
					return postPromise;
				});
				underTest.postDeploy({a: 1}, {c: 2}, {})
					.then(done.fail, done.fail);
			});
			it('executes the second hook after the first one resolves', done => {
				underTest.postDeploy({a: 1}, {c: 2}, {})
					.then(done.fail, () => expect(hook2).toHaveBeenCalledWith({a: 1}, {c: 2}, {}))
					.then(done);
				pResolve({url: 'http://www.google.com'});
				p2Reject('boom');
			});
			it('resolves when the second hook resolves', done => {
				underTest.postDeploy({a: 1}, {c: 2}, {})
					.then(result => {
						expect(result).toEqual({
							first: { url: 'http://www.google.com' },
							second: { url: 'http://www.xkcd.com' }
						});
					})
					.then(done, done.fail);

				pResolve({url: 'http://www.google.com'});
				p2Resolve({url: 'http://www.xkcd.com'});
			});
		});
	});
	describe('post-deploy config shortcut', () => {
		let apiGatewayPromise, lambdaDetails, deploymentResolve, deploymentReject;
		beforeEach(() => {
			apiGatewayPromise = jasmine.createSpyObj('apiGatewayPromise', ['createDeploymentPromise']);
			apiGatewayPromise.createDeploymentPromise.and.returnValue(new Promise((resolve, reject) => {
				deploymentResolve = resolve;
				deploymentReject = reject;
			}));
			lambdaDetails = { apiId: 'API_1', alias: 'dev' };
			underTest.addPostDeployConfig('stageVar', 'Enter var', 'config-var');
		});
		it('does nothing if the config arg is not set', done => {
			underTest.postDeploy({a: 1}, lambdaDetails, {apiGatewayPromise: apiGatewayPromise})
				.then(() => expect(apiGatewayPromise.createDeploymentPromise).not.toHaveBeenCalled())
				.then(done, done.fail);
		});
		describe('when the config arg is a string', () => {
			it('sets the variable without prompting', done => {
				underTest.postDeploy({a: 1, 'config-var': 'val-value'}, lambdaDetails, {apiGatewayPromise: apiGatewayPromise})
					.then(result => {
						expect(apiGatewayPromise.createDeploymentPromise).toHaveBeenCalledWith({
							restApiId: 'API_1',
							stageName: 'dev',
							variables: { stageVar: 'val-value' }
						});
						expect(prompter).not.toHaveBeenCalled();
						expect(result).toEqual({stageVar: 'val-value'});
					})
					.then(done, done.fail);
				deploymentResolve('OK');
			});
			it('rejects if the deployment rejects', done => {
				underTest.postDeploy({a: 1, 'config-var': 'val-value'}, lambdaDetails, {apiGatewayPromise: apiGatewayPromise})
					.then(done.fail, err => expect(err).toEqual('BOOM!'))
					.then(done);
				deploymentReject('BOOM!');
			});
		});
		describe('when the config arg is true', () => {
			it('prompts for the variable', done => {
				underTest.postDeploy({a: 1, 'config-var': true}, lambdaDetails, {apiGatewayPromise: apiGatewayPromise})
					.then(done.fail, done.fail);
				prompter.and.callFake(arg => {
					expect(arg).toEqual('Enter var');
					done();
					return Promise.resolve('X');
				});
			});
			it('deploys the stage variable returned by the prompter', done => {
				underTest.postDeploy({a: 1, 'config-var': true}, lambdaDetails, {apiGatewayPromise: apiGatewayPromise})
					.then(result => {
						expect(apiGatewayPromise.createDeploymentPromise).toHaveBeenCalledWith({
							restApiId: 'API_1',
							stageName: 'dev',
							variables: { stageVar: 'X' }
						});
						expect(result).toEqual({stageVar: 'X'});
					})
					.then(done, done.fail);
				prompter.and.returnValue(Promise.resolve('X'));
				deploymentResolve('OK');
			});
			it('rejects if the prompter rejects', done => {
				underTest.postDeploy({a: 1, 'config-var': true}, lambdaDetails, {apiGatewayPromise: apiGatewayPromise})
					.then(done.fail, err => {
						expect(err).toEqual('BOOM');
						expect(apiGatewayPromise.createDeploymentPromise).not.toHaveBeenCalled();
					})
					.then(done);
				prompter.and.returnValue(Promise.reject('BOOM'));
			});
			it('rejects if the deployment rejects', done => {
				underTest.postDeploy({a: 1, 'config-var': true}, lambdaDetails, {apiGatewayPromise: apiGatewayPromise})
					.then(done.fail, err => expect(err).toEqual('BOOM'))
					.then(done);
				prompter.and.returnValue(Promise.resolve('OK'));
				deploymentReject('BOOM');
			});
		});
	});
	describe('lambda context control', () => {
		it('sets the flag to kill the node vm without waiting for the event loop to empty after serializing context to request', done => {
			const apiRequest = {
				context: {
					path: '/test',
					method: 'GET'
				},
				queryString: {
					a: 'b'
				}
			};
			underTest.get('/test', requestHandler);
			underTest.router(apiRequest, lambdaContext)
				.then(() => expect(lambdaContext.callbackWaitsForEmptyEventLoop).toBe(false))
				.then(done, done.fail);
		});
	});
	describe('setGatewayResponse', () => {
		it('does not create any custom responses by default', () => {
			expect(underTest.apiConfig().customResponses).toBeUndefined();
		});
		it('adds a custom response by type', () => {
			underTest.setGatewayResponse('DEFAULT_4XX', {statusCode: 411});
			expect(underTest.apiConfig().customResponses).toEqual({
				'DEFAULT_4XX': {statusCode: 411}
			});
		});
		it('adds multiple responses', () => {
			underTest.setGatewayResponse('DEFAULT_4XX', {statusCode: 411});
			underTest.setGatewayResponse('DEFAULT_5XX', {statusCode: 511});
			expect(underTest.apiConfig().customResponses).toEqual({
				'DEFAULT_4XX': {statusCode: 411},
				'DEFAULT_5XX': {statusCode: 511}
			});
		});
		it('rejects to redefine a response', () => {
			underTest.setGatewayResponse('DEFAULT_4XX', {statusCode: 411});
			expect(() => underTest.setGatewayResponse('DEFAULT_4XX', {statusCode: 411})).toThrowError('Response type DEFAULT_4XX is already defined');
		});
		it('rejects to define a blank response', () => {
			expect(() => underTest.setGatewayResponse('', {statusCode: 411})).toThrowError('response type must be a string');
		});
		it('rejects to define a unconfigured response', () => {
			expect(() => underTest.setGatewayResponse('DEFAULT_4XX', {})).toThrowError('Response type DEFAULT_4XX configuration is invalid');
			expect(() => underTest.setGatewayResponse('DEFAULT_4XX', 5)).toThrowError('Response type DEFAULT_4XX configuration is invalid');
		});
	});
	describe('registerAuthorizer', () => {
		it('creates no authorizers by default', () => {
			expect(underTest.apiConfig().authorizers).toBeUndefined();
		});
		it('can register an authorizer by name', () => {
			underTest.registerAuthorizer('first', { lambdaName: 'blob1' });
			expect(underTest.apiConfig().authorizers).toEqual({
				first: { lambdaName: 'blob1' }
			});
		});
		it('can register multiple authorizers by name', () => {
			underTest.registerAuthorizer('first', { lambdaName: 'blob1' });
			underTest.registerAuthorizer('second', { lambdaName: 'blob2' });
			expect(underTest.apiConfig().authorizers).toEqual({
				first: { lambdaName: 'blob1' },
				second: { lambdaName: 'blob2' }
			});
		});
		it('complains about the same name used twice', () => {
			underTest.registerAuthorizer('first', { lambdaName: 'blob1' });
			expect(() => {
				underTest.registerAuthorizer('first', { lambdaName: 'blob2' });
			}).toThrowError('Authorizer first is already defined');
		});
		it('complains about no config authorizers', () => {
			expect(() => {
				underTest.registerAuthorizer('first', {});
			}).toThrowError('Authorizer first configuration is invalid');
			expect(() => {
				underTest.registerAuthorizer('first');
			}).toThrowError('Authorizer first configuration is invalid');
		});
		it('complains about nameless authorizers', () => {
			expect(() => {
				underTest.registerAuthorizer('', {});
			}).toThrowError('Authorizer must have a name');
			expect(() => {
				underTest.registerAuthorizer();
			}).toThrowError('Authorizer must have a name');
		});
	});
	describe('setBinaryMediaTypes', () => {
		it('keeps default binaryMediaTypes undefined if not set', () => {
			expect(underTest.apiConfig().binaryMediaTypes).toEqual(
				['image/webp', 'image/*', 'image/jpg', 'image/jpeg', 'image/gif', 'image/png', 'application/octet-stream', 'application/pdf', 'application/zip']
			);
		});
		it('removes binaryMediaTypes to if set to false', () => {
			underTest.setBinaryMediaTypes(false);
			expect(underTest.apiConfig().binaryMediaTypes).toBeUndefined();
		});
		it('sets binaryMediaTypes to a given array', () => {
			underTest.setBinaryMediaTypes(['image/jpg']);
			expect(underTest.apiConfig().binaryMediaTypes).toEqual(['image/jpg']);
		});
	});
	describe('error status code', () => {
		it('assigns the default code to a thrown error', done => {
			underTest.get('/error', () => {
				const error = new Error('DB Unavailable');
				throw error;
			});
			const event = {
				requestContext: {
					httpMethod: 'GET',
					resourcePath: '/error'
				}
			};
			return underTest.proxyRouter(event, lambdaContext)
				.then(() => {
					expect(responseStatusCode()).toEqual(500);
					expect(responseBody()).toEqual('{"errorMessage":"DB Unavailable"}');
				}).then(done, done.fail);
		});
	});
});
