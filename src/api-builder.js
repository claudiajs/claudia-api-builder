/*global module */
module.exports = function ApiBuilder() {
	'use strict';
	var self = this,
		methodConfigurations = {},
		routes = {},
		isApiResponse = function (obj) {
			return obj && Object.getPrototypeOf(obj) === self.ApiResponse.prototype;
		},
		copyHeaders = function (handlerResult, lambdaResult) {
			lambdaResult.headers = lambdaResult.headers || {};
			Object.keys(handlerResult.headers).forEach(function (key) {
				lambdaResult.headers[key] = handlerResult.headers[key];
			});
		},
		packResult = function (handlerResult, route, method) {
			var path = route.replace(/^\//, ''),
				customHeaders = methodConfigurations[path] && methodConfigurations[path][method] && methodConfigurations[path][method].success && methodConfigurations[path][method].success.headers,
				lambdaResult;
			if (customHeaders && Array.isArray(customHeaders)) {
				customHeaders = false;
			}
			if (!customHeaders && !handlerResult) {
				return;
			}
			lambdaResult = {};
			if (customHeaders) {
				lambdaResult.headers = customHeaders;
			}
			if (handlerResult) {
				if (isApiResponse(handlerResult)) {
					lambdaResult.response = handlerResult.response;
					copyHeaders(handlerResult, lambdaResult);
				} else {
					lambdaResult.response = handlerResult;
				}

			}
			return lambdaResult;
		},
		packError = function (handlerError, route, method) {
			var path = route.replace(/^\//, ''),
				customHeaders = methodConfigurations[path] && methodConfigurations[path][method] && methodConfigurations[path][method].error && methodConfigurations[path][method].error.headers,
				lambdaError = handlerError;
			if (customHeaders && Array.isArray(customHeaders)) {
				customHeaders = false;
			}
			if (typeof handlerError === 'string') {
				lambdaError = new Error(handlerError);
			} else if (isApiResponse(handlerError)) {
				lambdaError = new Error(handlerError.response);
			}
			if (customHeaders) {
				lambdaError.headers = customHeaders;
			}
			if (isApiResponse(handlerError)) {
				copyHeaders(handlerError, lambdaError);
			}
			return lambdaError;
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
		return {version: 3, routes: methodConfigurations};
	};
	self.ApiResponse = function (responseBody, responseHeaders) {
		this.response = responseBody;
		this.headers = responseHeaders;
	};
	self.router = function (event, context) {
		var handler, result, path;
		if (event && event.context && event.context.path && event.context.method) {
			path = event.context.path;
			handler = routes[path] && routes[path][event.context.method];
			if (handler) {
				try {
					result = handler(event);
					if (result && result.then && (typeof result.then === 'function')) {
						return result.then(function (promiseResult) {
							context.done(null, packResult(promiseResult, path, event.context.method));
						}, function (promiseError) {
							context.done(packError(promiseError, path, event.context.method), undefined);
						});
					} else {
						context.done(null, packResult(result, path, event.context.method));
					}
				} catch (e) {
					context.done(packError(e, path, event.context.method), undefined);
				}
			} else {
				context.done({type: 'InvalidRequest', message: 'no handler for ' + event.context.path + ':' + event.context.method});
			}
		} else {
			context.done({type: 'InvalidRequest', message: 'event must contain context.path and context.method'});
		}
	};
};
