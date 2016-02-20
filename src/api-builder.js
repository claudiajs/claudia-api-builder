/*global module */
module.exports = function ApiBuilder() {
	'use strict';
	var self = this,
		methodConfigurations = {},
		routes = {};
	['GET', 'POST', 'PUT'].forEach(function (method) {
		self[method.toLowerCase()] = function (route, handler, options) {
			var pathPart = route.replace(/^\//, '').toLowerCase(),
				canonicalRoute = route.toLowerCase();
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
		return {version: 2, routes: methodConfigurations};
	};
	self.router = function (event, context) {
		var handler, result, path;
		if (event && event.context && event.context.path && event.context.method) {
			path = event.context.path.toLowerCase();
			handler = routes[path] && routes[path][event.context.method];
			if (handler) {
				try {
					result = handler(event);
					if (result && result.then && (typeof result.then === 'function')) {
						return result.then(function (promiseResult) {
							context.done(null, promiseResult);
						}, function (promiseError) {
							context.done(promiseError, undefined);
						});
					} else {
						context.done(null, result);
					}
				} catch (e) {
					context.done(e, undefined);
				}
			} else {
				context.done({type: 'InvalidRequest', message: 'no handler for ' + event.context.path + ':' + event.context.method});
			}
		} else {
			context.done({type: 'InvalidRequest', message: 'event must contain context.path and context.method'});
		}
	};
};
