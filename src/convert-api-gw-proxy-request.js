/*global module, require */
var qs = require('querystring'),
	lowercaseKeys = require('./lowercase-keys'),
	getCanonicalContentType = function (normalizedHeaders) {
		'use strict';
		var contentType = normalizedHeaders['content-type'] || '';
		if (contentType.indexOf(';') >= 0) {
			contentType = contentType.split(';')[0];
		}
		return contentType;
	},
	copyProperties = function (from, to, keyMappings) {
		'use strict';
		Object.keys(keyMappings).forEach(function (key) {
			to[key] = from[keyMappings[key]] || {};
		});
	},
	convertContext = function (requestContext) {
		'use strict';
		var identity = requestContext.identity || {};
		return {
			method: (requestContext.httpMethod || 'GET').toUpperCase(),
			path: requestContext.resourcePath,
			stage: requestContext.stage,
			sourceIp: identity.sourceIp,
			accountId: identity.accountId,
			user: identity.user,
			userAgent: identity.userAgent,
			userArn: identity.userArn,
			caller: identity.caller,
			apiKey: identity.apiKey,
			authorizerPrincipalId: requestContext.authorizer ? requestContext.authorizer.principalId : null,
			cognitoAuthenticationProvider: identity.cognitoAuthenticationProvider,
			cognitoAuthenticationType:  identity.cognitoAuthenticationType,
			cognitoIdentityId:  identity.cognitoIdentityId,
			cognitoIdentityPoolId: identity.cognitoIdentityPoolId
		};

	};

module.exports = function convertApiGWProxyRequest(request, lambdaContext) {
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
	if (canonicalContentType === 'application/json' &&
		(typeof result.rawBody !== 'object' || !result.rawBody) // null will also result in type 'object'
	) {
		result.body = JSON.parse(result.rawBody || '{}');
	} else {
		result.body = result.rawBody;
	}
	result.context = request.requestContext ? convertContext(request.requestContext) : {};
	return result;
};
