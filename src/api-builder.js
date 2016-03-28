/*global module */
module.exports = function ApiBuilder() {
	'use strict';
	var self = this,
		methodConfigurations = {},
		routes = {},
		customCorsHandler,
		customCorsHeaders,
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
	self.router = function (event, context) {
		var handler, result, path;
		if (event && event.context && event.context.path && event.context.method) {
			path = event.context.path;
			if (event.context.method === 'OPTIONS' && customCorsHandler) {
				return context.done(null, customCorsHandler(event));
			}
			handler = routes[path] && routes[path][event.context.method];
			if (handler) {
				try {
					result = handler(event);
					if (result && result.then && (typeof result.then === 'function')) {
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
			context.done('event must contain context.path and context.method');
		}
	};
};
