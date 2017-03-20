/*global module, require */
const qs = require('querystring'),
	lowercaseKeys = require('./lowercase-keys'),
	getCanonicalContentType = function (normalizedHeaders) {
		'use strict';
		let contentType = normalizedHeaders['content-type'] || '';
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
		const identity = requestContext.identity || {};
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
			cognitoAuthenticationType: identity.cognitoAuthenticationType,
			cognitoIdentityId: identity.cognitoIdentityId,
			cognitoIdentityPoolId: identity.cognitoIdentityPoolId,
			authorizer: requestContext.authorizer
		};

	},
	getConvertedBody = function (body, contentType, isBase64Encoded) {
		'use strict';
		const textContentTypes = ['application/json', 'text/plain', 'application/xml', 'text/xml', 'application/x-www-form-urlencoded'];
		if (!isBase64Encoded) {
			return body;
		} else {
			const buffer = new Buffer(body, 'base64');
			if (textContentTypes.indexOf(contentType) >= 0) {
				return buffer.toString('utf8');
			} else {
				return buffer;
			}
		}
	};

module.exports = function convertApiGWProxyRequest(request, lambdaContext) {
	'use strict';
	const result = {
			v: 3,
			rawBody: request.body || '',
			normalizedHeaders: lowercaseKeys(request.headers),
			lambdaContext: lambdaContext,
			proxyRequest: request
		},
		canonicalContentType = getCanonicalContentType(result.normalizedHeaders),
		convertedBody = getConvertedBody(result.rawBody, canonicalContentType, request.isBase64Encoded);

	copyProperties(request, result, {
		queryString: 'queryStringParameters',
		env: 'stageVariables',
		headers: 'headers',
		pathParams: 'pathParameters'
	});
	if (canonicalContentType === 'application/x-www-form-urlencoded') {
		result.post = qs.parse(convertedBody);
	}
	if (canonicalContentType === 'application/json' &&
		(typeof convertedBody !== 'object' || !convertedBody) // null will also result in type 'object'
	) {
		result.body = JSON.parse(convertedBody || '{}');
	} else {
		result.body = convertedBody;
	}
	result.context = request.requestContext ? convertContext(request.requestContext) : {};
	return result;
};
