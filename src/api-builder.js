/*global module, require */
var Promise = require('bluebird');
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
		var handler;
		if (event && event.context && event.context.path && event.context.method) {
			handler = routes[event.context.path] && routes[event.context.path][event.context.method];
			if (handler) {
				return Promise.resolve(event).then(handler).then(function (result) {
					context.done(null, result);
				}, function (error) {
					context.done(error, undefined);
				});
			} else {
				context.done({type: 'InvalidRequest', message: 'no handler for ' + event.context.path + ':' + event.context.method});
			}
		} else {
			context.done({type: 'InvalidRequest', message: 'event must contain context.path and context.method'});
		}
	};
};
