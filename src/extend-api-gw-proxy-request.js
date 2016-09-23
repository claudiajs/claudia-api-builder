/*global module, require */
var qs = require('querystring');
module.exports = function extendApiGWProxyRequest(request) {
	'use strict';
	var copyArgs = { queryString: 'queryStringParameters', env: 'stageVariables' },
		canonicalContentType;
	request.v = 3;
	Object.keys(copyArgs).forEach(function (apiBuilderKey) {
		request[apiBuilderKey] = request[copyArgs[apiBuilderKey]] || {};
	});
	if (!request.headers) {
		request.headers = {};
	}
	request.normalizedHeaders = {};
	Object.keys(request.headers).forEach(function (header) {
		request.normalizedHeaders[header.toLowerCase()] = request.headers[header];
	});
	canonicalContentType = request.normalizedHeaders['content-type'] || '';
	if (canonicalContentType.indexOf(';') >= 0) {
		canonicalContentType = canonicalContentType.split(';')[0];
	}
	if (canonicalContentType === 'application/x-www-form-urlencoded') {
		request.post = qs.parse(request.body || '');
	}
	if (!request.body) {
		request.body = '';
	}
	if (canonicalContentType === 'application/json') {
		request.body = JSON.parse(request.body || '{}');
	}
	return request;
};
