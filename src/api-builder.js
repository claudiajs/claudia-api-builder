/*global module */
module.exports = function ApiBuilder() {
	'use strict';
	var self = this,
		methodConfigurations = {},
		routes = {};
	['GET', 'POST', 'PUT'].forEach(function (method) {
		self[method.toLowerCase()] = function (route, handler) {
			var pathPart = route.replace(/^\//, '');
			if (!methodConfigurations[pathPart]) {
				methodConfigurations[pathPart] = { methods: [] };
			}
			if (methodConfigurations[pathPart].methods.indexOf(method) === -1) {
				methodConfigurations[pathPart].methods.push(method);
			}
			if (!routes[route]) {
				routes[route] = {};
			}
			routes[route][method] = handler;
		};
	});
	self.apiConfig = function () {
		return methodConfigurations;
	};
	self.router = function (event, context) {
		var handler, result;
		if (event && event.context && event.context.path && event.context.method) {
			handler = routes[event.context.path] && routes[event.context.path][event.context.method];
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
