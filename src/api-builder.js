/*global module, require */
module.exports = function ApiBuilder(components) {
	'use strict';
	var self = this,
		methodConfigurations = {},
		routes = {},
		customCorsHandler,
		postDeploySteps = {},
		customCorsHeaders,
		unsupportedEventCallback,
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
			var handler, result, path;
			if (event && event.context && event.context.path && event.context.method) {
				path = event.context.path;
				if (event.context.method === 'OPTIONS' && customCorsHandler) {
					return context.done(null, customCorsHandler(event));
				}
				handler = routes[path] && routes[path][event.context.method];
				if (handler) {
					try {
						event.lambdaContext = context;
						result = handler(event);
						if (isThenable(result)) {
							return result.then(function (promiseResult) {
								context.done(null, packResult(promiseResult, path, event.context.method));
							}, function (promiseError) {
								context.done(promiseError);
							});
						} else {
							context.done(null, packResult(result, path, event.context.method));
						}
					} catch (e) {
						context.done(e);
					}
				} else {
					context.done('no handler for ' + event.context.method + ' ' + event.context.path);
				}
			} else {
				if (unsupportedEventCallback) {
					unsupportedEventCallback.apply(this, arguments);
				} else {
					context.done('event must contain context.path and context.method');
				}
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
		var result = {version: 2, routes: methodConfigurations};
		if (customCorsHandler !== undefined) {
			result.corsHandlers = !!customCorsHandler;
		}
		if (customCorsHeaders) {
			result.corsHeaders = customCorsHeaders;
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
	self.router = function (event, context, callback) {
		var result,
			handleResult = function (r) {
				if (!r) {
					return context.done(null, null);
				}
				return routeEvent(r, context, callback);
			},
			handleError = function (e) {
				context.done(e);
			};
		if (!interceptCallback) {
			return routeEvent(event, context, callback);
		}

		try {
			result = interceptCallback(event);
			if (isThenable(result)) {
				return result.then(handleResult, handleError);
			} else {
				handleResult(result);
			}
		} catch (e) {
			handleError(e);
		}
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
};
