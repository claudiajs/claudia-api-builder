/*global module, require, Promise, console */
var convertApiGWProxyRequest = require('./convert-api-gw-proxy-request');
module.exports = function ApiBuilder(components) {
	'use strict';
	var self = this,
		requestFormat = 'CLAUDIA_API_BUILDER',
		methodConfigurations = {},
		routes = {},
		customCorsHandler,
		postDeploySteps = {},
		customCorsHeaders,
		unsupportedEventCallback,
		authorizers,
		supportedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'],
		interceptCallback,
		prompter = (components && components.prompter) || require('./ask'),
		isApiResponse = function (obj) {
			return obj && (typeof obj === 'object') && (Object.getPrototypeOf(obj) === self.ApiResponse.prototype);
		},
		packResult = function (handlerResult, route, method) {
			var path = route.replace(/^\//, ''),
				customHeaders = methodConfigurations[path] && methodConfigurations[path][method] && methodConfigurations[path][method].success && methodConfigurations[path][method].success.headers;

			if (isApiResponse(handlerResult)) {
				if (!customHeaders) {
					throw 'cannot use ApiResponse without enumerating headers in ' + method + ' ' + route;
				}
				if (!Array.isArray(customHeaders)) {
					throw 'cannot use ApiResponse with default header values in ' + method + ' ' + route;
				}
				Object.keys(handlerResult.headers).forEach(function (header) {
					if (customHeaders.indexOf(header) < 0) {
						throw 'unexpected header ' + header + ' in ' + method + ' ' + route;
					}
				});
				return { response: handlerResult.response, headers: handlerResult.headers };
			}
			if (customHeaders && Array.isArray(customHeaders)) {
				return { response: handlerResult, headers: {} };
			}
			return handlerResult;
		},
		routeCors = function (request) {
			return Promise.resolve().then(function () {
				if (customCorsHandler === false) {
					return '';
				} else if (customCorsHandler) {
					// todo: translate to header value
					return customCorsHandler(request);
				} else {
					return '*';
				}
			}).then(function (corsOrigin) {
				return {
					statusCode: 200,
					headers: {
						'Access-Control-Allow-Origin': corsOrigin,
						'Access-Control-Allow-Headers': corsOrigin && (customCorsHeaders || 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'),
						'Access-Control-Allow-Methods': corsOrigin && supportedMethods.join(',') + ',OPTIONS'
					},
					body: ''
				};
			});
		},
		routeEvent = function (routingInfo, event, context) {
			var handler;
			if (!routingInfo) {
				throw 'routingInfo not set';
			}
			if (routingInfo.method === 'OPTIONS') {
				return routeCors(event);
			}
			handler = routes[routingInfo.path] && routes[routingInfo.path][routingInfo.method];
			if (handler) {
				return Promise.resolve().then(function () {
					return handler(event, context);
				}).then(function (result) {
					return packResult(result, routingInfo.path, routingInfo.method);
				});
			} else {
				return Promise.reject('no handler for ' + routingInfo.method + ' ' + routingInfo.path);
			}
		},
		getRequestRoutingInfo = function (request) {
			if (requestFormat === 'AWS_PROXY') {
				if (!request.requestContext) {
					return {};
				}
				return {
					path: request.requestContext.resourcePath,
					method: request.requestContext.httpMethod
				};
			} else {
				return request.context || {};
			}
		},
		getRequest = function (event, context) {
			if (requestFormat === 'AWS_PROXY' || requestFormat === 'DEPRECATED') {
				return event;
			} else {
				return convertApiGWProxyRequest(event, context);
			}
		},
		executeInterceptor = function (request, context) {
			if (!interceptCallback) {
				return Promise.resolve(request);
			} else {
				return Promise.resolve().then(function () {
					return interceptCallback(request, context);
				});
			}
		};
	supportedMethods.forEach(function (method) {
		self[method.toLowerCase()] = function (route, handler, options) {
			var pathPart = route.replace(/^\//, ''),
				canonicalRoute = route;
			if (!/^\//.test(canonicalRoute)) {
				canonicalRoute = '/' + route;
			}
			if (!methodConfigurations[pathPart]) {
				methodConfigurations[pathPart] = {} ;
			}
			methodConfigurations[pathPart][method] = (options || {});
			if (!routes[canonicalRoute]) {
				routes[canonicalRoute] = {};
			}
			routes[canonicalRoute][method] = handler;
		};
	});
	self.apiConfig = function () {
		var result = {version: 3, routes: methodConfigurations};
		if (customCorsHandler !== undefined) {
			result.corsHandlers = !!customCorsHandler;
		}
		if (customCorsHeaders) {
			result.corsHeaders = customCorsHeaders;
		}
		if (authorizers) {
			result.authorizers = authorizers;
		}
		return result;
	};
	self.corsOrigin = function (handler) {
		if (!handler) {
			customCorsHandler = false;
		} else {
			if (typeof handler === 'function') {
				customCorsHandler = handler;
			} else {
				customCorsHandler = function () {
					return handler;
				};
			}
		}
	};
	self.corsHeaders = function (headers) {
		if (typeof headers === 'string') {
			customCorsHeaders = headers;
		} else {
			throw 'corsHeaders only accepts strings';
		}
	};
	self.ApiResponse = function (responseBody, responseHeaders) {
		this.response = responseBody;
		this.headers = responseHeaders;
	};
	self.unsupportedEvent = function (callback) {
		console.log('.unsupportedEvent is deprecated and will be removed in claudia api builder v3. Check https://claudiajs.com/tutorials/migrating_to_2.html');
		unsupportedEventCallback = callback;
	};
	self.intercept = function (callback) {
		interceptCallback = callback;
	};
	self.proxyRouter = function (event, context, callback) {
		var request = getRequest(event, context),
			routingInfo,
			handleError = function (e) {
				context.done(e);
			};
		context.callbackWaitsForEmptyEventLoop = false;
		return executeInterceptor(request, context).then(function (modifiedRequest) {
			if (!modifiedRequest) {
				return context.done(null, null);
			} else {
				routingInfo = getRequestRoutingInfo(modifiedRequest);
				if (routingInfo && routingInfo.path && routingInfo.method) {
					return routeEvent(routingInfo, modifiedRequest, context, callback).then(function (result) {
						context.done(null, result);
					});
				} else {
					if (unsupportedEventCallback) {
						unsupportedEventCallback(event, context, callback);
					} else {
						return Promise.reject('event does not contain routing information');
					}
				}
			}
		}).catch(handleError);

	};
	self.setRequestFormat = function (newFormat) {
		var supportedFormats = ['AWS_PROXY', 'CLAUDIA_API_BUILDER'];
		if (supportedFormats.indexOf(newFormat) >= 0) {
			requestFormat = newFormat;
		} else {
			throw 'Unsupported request format ' + newFormat;
		}
	};
	self.router = function (event, context, callback) {
		requestFormat = 'DEPRECATED';
		event.lambdaContext = context;
		console.log('.router is deprecated and will be removed in claudia api builder v3. Check https://claudiajs.com/tutorials/migrating_to_2.html');
		return self.proxyRouter(event, context, callback);
	};
	self.addPostDeployStep = function (name, stepFunction) {
		if (typeof name !== 'string') {
			throw new Error('addPostDeployStep requires a step name as the first argument');
		}
		if (typeof stepFunction !== 'function') {
			throw new Error('addPostDeployStep requires a function as the first argument');
		}
		if (postDeploySteps[name]) {
			throw new Error('Post deploy hook "' + name + '" already exists');
		}
		postDeploySteps[name] = stepFunction;
	};
	self.addPostDeployConfig = function (stageVarName, prompt, configOption) {
		self.addPostDeployStep(stageVarName, function (options, lambdaDetails, utils) {
			var configureDeployment = function (varValue) {
					var result = {
						restApiId: lambdaDetails.apiId,
						stageName: lambdaDetails.alias,
						variables: { }
					};
					result.variables[stageVarName] = varValue;
					return result;
				},
				deployStageVar = function (deployment) {
					return utils.apiGatewayPromise.createDeploymentPromise(deployment).then(function () {
						return deployment.variables[stageVarName];
					});
				},
				getVariable = function () {
					if (typeof options[configOption] === 'string') {
						return utils.Promise.resolve(options[configOption]);
					} else {
						return prompter(prompt, utils.Promise);
					}
				};
			if (options[configOption]) {
				return getVariable()
					.then(configureDeployment)
					.then(deployStageVar);
			}
		});
	};
	self.postDeploy = function (options, lambdaDetails, utils) {
		var steps = Object.keys(postDeploySteps),
			stepResults = {},
			executeStepMapper = function (stepName) {
				return utils.Promise.resolve().then(function () {
					return postDeploySteps[stepName](options, lambdaDetails, utils);
				}).then(function (result) {
					stepResults[stepName] = result;
				});
			};
		if (!steps.length) {
			return utils.Promise.resolve(false);
		}
		return utils.Promise.map(steps, executeStepMapper, {concurrency: 1}).then(function () {
			return stepResults;
		});
	};
	self.registerAuthorizer = function (name, config) {
		if (!name || typeof name !== 'string' || name.length === 0) {
			throw new Error('Authorizer must have a name');
		}
		if (!config || typeof config !== 'object' || Object.keys(config).length === 0) {
			throw new Error('Authorizer ' + name + ' configuration is invalid');
		}
		if (!authorizers) {
			authorizers = {};
		}
		if (authorizers[name]) {
			throw new Error('Authorizer ' + name + ' is already defined');
		}
		authorizers[name] = config;
	};
};
