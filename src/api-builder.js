/*global module, require, Promise */
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
		isThenable = function (param) {
			return param && param.then && (typeof param.then === 'function');
		},
		routeEvent = function (event, context /*, callback*/) {
			var handler, result, routingInfo = getRequestRoutingInfo(event);
			context.callbackWaitsForEmptyEventLoop = false;
			if (routingInfo.path && routingInfo.method) {
				if (routingInfo.method === 'OPTIONS' && customCorsHandler) {
					// todo: translate to header value
					return context.done(null, customCorsHandler(event));
				}
				handler = routes[routingInfo.path] && routes[routingInfo.path][routingInfo.method];
				if (handler) {
					try {
						if (requestFormat === 'CLAUDIA_API_BUILDER') {
							event.lambdaContext = context;
						}
						result = handler(event, context);
						if (isThenable(result)) {
							return result.then(function (promiseResult) {
								context.done(null, packResult(promiseResult, routingInfo.path, routingInfo.method));
							}, function (promiseError) {
								context.done(promiseError);
							});
						} else {
							context.done(null, packResult(result, routingInfo.path, routingInfo.method));
						}
					} catch (e) {
						context.done(e);
					}
				} else {
					context.done('no handler for ' + routingInfo.method + ' ' + routingInfo.path);
				}
			} else {
				if (unsupportedEventCallback) {
					unsupportedEventCallback.apply(this, arguments);
				} else {
					context.done('event must contain context.path and context.method');
				}
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
	['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'].forEach(function (method) {
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
		unsupportedEventCallback = callback;
	};
	self.intercept = function (callback) {
		interceptCallback = callback;
	};
	self.proxyRouter = function (event, context, callback) {
		var request = getRequest(event, context),
			handleError = function (e) {
				context.done(e);
			};
		return executeInterceptor(request, context).then(function (modifiedRequest) {
			if (!modifiedRequest) {
				return context.done(null, null);
			} else {
				return routeEvent(modifiedRequest, context, callback);
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
