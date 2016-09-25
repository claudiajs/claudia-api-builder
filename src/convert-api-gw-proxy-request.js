/*global module, require */
var qs = require('querystring'),
	getCanonicalContentType = function (normalizedHeaders) {
		'use strict';
		var contentType = normalizedHeaders['content-type'] || '';
		if (contentType.indexOf(';') >= 0) {
			contentType = contentType.split(';')[0];
		}
		return contentType;
	},
	lowercaseKeys = function (object) {
		'use strict';
		var result = {};
		if (object) {
			Object.keys(object).forEach(function (key) {
				result[key.toLowerCase()] = object[key];
			});
		}
		return result;
	},
	copyProperties = function (from, to, keyMappings) {
		'use strict';
		Object.keys(keyMappings).forEach(function (key) {
			to[key] = from[keyMappings[key]] || {};
		});
	};

module.exports = function extendApiGWProxyRequest(request, lambdaContext) {
	'use strict';
	var result = {
			v: 3,
			rawBody: request.body || '',
			normalizedHeaders: lowercaseKeys(request.headers),
			lambdaContext: lambdaContext,
			proxyRequest: request
		},
		canonicalContentType = getCanonicalContentType(result.normalizedHeaders);

	copyProperties(request, result, {
		queryString: 'queryStringParameters',
		env: 'stageVariables',
		headers: 'headers',
		pathParams: 'pathParameters'
	});
	if (canonicalContentType === 'application/x-www-form-urlencoded') {
		result.post = qs.parse(result.rawBody);
	}
	if (canonicalContentType === 'application/json') {
		result.body = JSON.parse(result.rawBody || '{}');
	} else {
		result.body = result.rawBody;
	}
	result.context = {
		method: (request.requestContext.httpMethod || 'GET').toUpperCase(),
		path: request.requestContext.resourcePath,
		stage: request.requestContext.stage,
		sourceIp: request.requestContext.identity.sourceIp,
		accountId: request.requestContext.identity.accountId,
		user: request.requestContext.identity.user,
		userAgent: request.requestContext.identity.userAgent,
		userArn: request.requestContext.identity.userArn,
		caller: request.requestContext.identity.caller,
		apiKey: request.requestContext.identity.apiKey,
		authorizerPrincipalId: request.requestContext.authorizer ? request.requestContext.authorizer.principalId : null,
		cognitoAuthenticationProvider: request.requestContext.identity.cognitoAuthenticationProvider,
		cognitoAuthenticationType:  request.requestContext.identity.cognitoAuthenticationType,
		cognitoIdentityId:  request.requestContext.identity.cognitoIdentityId,
		cognitoIdentityPoolId: request.requestContext.identity.cognitoIdentityPoolId
	};
	return result;
};
