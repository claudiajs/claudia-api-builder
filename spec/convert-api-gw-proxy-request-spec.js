/*global require, describe, it, expect, beforeEach */
const underTest = require('../src/convert-api-gw-proxy-request');
describe('extendApiGWProxyRequest', () => {
	'use strict';
	let apiGWRequest;
	beforeEach(() => {
		apiGWRequest = {
			'stageVariables': {
				'lambdaVersion': 'latest'
			},
			'headers': {
				'Authorization': 'abc-DeF',
				'X-Forwarded-Port': '443',
				'Content-Type': 'application/x-www-form-urlencoded',
				'X-Forwarded-For': '24.15.46.241, 54.239.167.121'
			},
			'body': 'birthyear=1905&press=%20OK%20',
			'httpMethod': 'POST',
			'pathParameters': {
				'name': 'sub1'
			},
			'resource': '/hello/{name}',
			'path': '/hello/sub1',
			'queryStringParameters': {
				'a': 'b',
				'c': 'd',
				'code': '403'
			},
			'requestContext': {
				'resourceId': 'rxcwwa',
				'resourcePath': '/hello/{name}',
				'authorizer': {
					'principalId': 'abc'
				},
				'httpMethod': 'POST',
				'identity': {
					'accountId': 'acc-id',
					'userAgent': 'curl/7.43.0',
					'apiKey': 'api-key',
					'cognitoIdentityId': 'cognito-identity-id',
					'user': 'request-user',
					'cognitoIdentityPoolId': 'cognito-pool-id',
					'cognitoAuthenticationProvider': 'cognito-auth-provider',
					'caller': 'request-caller',
					'userArn': 'user-arn',
					'sourceIp': '24.15.46.241',
					'cognitoAuthenticationType': 'cognito-auth-type'
				},
				'accountId': '818931230230',
				'apiId': 'txdif4prz3',
				'stage': 'latest',
				'requestId': 'c1a20045-80ee-11e6-b878-a1b0067c1281'
			}
		};
	});
	describe('versioning', () => {
		it('adds version 3', () => {
			expect(underTest(apiGWRequest).v).toEqual(3);
		});
	});
	it('does not modify the original request', () => {
		const original = JSON.parse(JSON.stringify(apiGWRequest));
		underTest(apiGWRequest);
		expect(apiGWRequest).toEqual(original);
	});
	describe('pathParams', () => {
		it('copies pathParameters into pathParams', () => {
			expect(underTest(apiGWRequest).pathParams).toEqual({
				'name': 'sub1'
			});
		});
		it('uses empty object if the original path params are not defined', () => {
			apiGWRequest.pathParameters = null;
			expect(underTest(apiGWRequest).pathParams).toEqual({});
		});
	});
	describe('queryString', () => {
		it('copies queryStringParameters into queryString', () => {
			expect(underTest(apiGWRequest).queryString).toEqual({
				'a': 'b',
				'c': 'd',
				'code': '403'
			});
		});
		it('uses empty object if the original query string is not defined', () => {
			apiGWRequest.queryStringParameters = null;
			expect(underTest(apiGWRequest).queryString).toEqual({});
		});
	});
	describe('env', () => {
		it('copies stageVariables into env', () => {
			expect(underTest(apiGWRequest).env).toEqual({
				'lambdaVersion': 'latest'
			});
		});
		it('uses empty object original stage variables are not defined', () => {
			apiGWRequest.stageVariables = null;
			expect(underTest(apiGWRequest).env).toEqual({});
		});
	});
	describe('headers', () => {
		it('copies headers intact', () => {
			expect(underTest(apiGWRequest).headers).toEqual({
				'Authorization': 'abc-DeF',
				'X-Forwarded-Port': '443',
				'Content-Type': 'application/x-www-form-urlencoded',
				'X-Forwarded-For': '24.15.46.241, 54.239.167.121'
			});
		});
		it('replaces headers with an empty object if not defined', () => {
			apiGWRequest.headers = null;
			expect(underTest(apiGWRequest).headers).toEqual({});
		});
	});
	describe('normalizedHeaders', () => {
		it('creates a copy of headers with lowercase header names', () => {
			expect(underTest(apiGWRequest).normalizedHeaders).toEqual({
				'authorization': 'abc-DeF',
				'x-forwarded-port': '443',
				'content-type': 'application/x-www-form-urlencoded',
				'x-forwarded-for': '24.15.46.241, 54.239.167.121'
			});
		});
		it('uses empty object if headers are not defined', () => {
			apiGWRequest.headers = null;
			expect(underTest(apiGWRequest).normalizedHeaders).toEqual({});
		});
	});
	describe('post', () => {
		it('is not present if the content type is not application/x-www-form-urlencoded', () => {
			apiGWRequest.headers['Content-Type'] = 'application/xml; charset=ISO-8859-1';
			expect(Object.keys(underTest(apiGWRequest))).not.toContain('post');
		});
		it('is not present if the content type header is not defined', () => {
			delete apiGWRequest.headers['Content-Type'];
			expect(Object.keys(underTest(apiGWRequest))).not.toContain('post');
		});
		it('is a decoded URL string if the content type is application/x-www-form-urlencoded', () => {
			expect(underTest(apiGWRequest).post).toEqual({ birthyear: '1905', press: ' OK ' });
		});
		it('works with mixed case content type header', () => {
			delete apiGWRequest.headers['Content-Type'];
			apiGWRequest.headers['content-Type'] = 'application/x-www-form-urlencoded';
			expect(underTest(apiGWRequest).post).toEqual({ birthyear: '1905', press: ' OK ' });
		});
		it('is an empty object if body is not defined', () => {
			apiGWRequest.body = null;
			expect(underTest(apiGWRequest).post).toEqual({});
		});
		it('works even if the client provides a charset with the content type header', () => {
			apiGWRequest.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=ISO-8859-1';
			expect(underTest(apiGWRequest).post).toEqual({ birthyear: '1905', press: ' OK ' });
		});
	});
	describe('body', () => {
		['', 'text/plain', 'application/xml', 'text/xml', 'application/x-www-form-urlencoded'].forEach(function (contentType) {
			describe('if content type is ' + (contentType || 'not provided'), () => {
				beforeEach(() => {
					apiGWRequest.headers['Content-Type'] = contentType;
				});
				it('is just copied', () => {
					expect(underTest(apiGWRequest).body).toEqual('birthyear=1905&press=%20OK%20');
				});
				it('is a blank string if the original body is null ', () => {
					apiGWRequest.body = null;
					expect(underTest(apiGWRequest).body).toEqual('');
				});
			});
		});
		describe('if content type is application/json', () => {
			beforeEach(() => {
				apiGWRequest.body = JSON.stringify({ birthyear: '1905', press: ' OK ' });
				apiGWRequest.headers['Content-Type'] = 'application/json';
			});
			it('is a parsed JSON object if the content type is application/json', () => {
				expect(underTest(apiGWRequest).body).toEqual({ birthyear: '1905', press: ' OK ' });
			});
			it('works with mixed case content type header', () => {
				delete apiGWRequest.headers['Content-Type'];
				apiGWRequest.headers['content-Type'] = 'application/json';
				expect(underTest(apiGWRequest).body).toEqual({ birthyear: '1905', press: ' OK ' });
			});
			it('works even if the client provides a charset with the content type header', () => {
				apiGWRequest.headers['Content-Type'] = 'application/json';
				expect(underTest(apiGWRequest).body).toEqual({ birthyear: '1905', press: ' OK ' });
			});
			it('throws an error if JSON cannot be parsed', () => {
				apiGWRequest.body = '{ "a": "b"';
				expect(() => {
					underTest(apiGWRequest);
				}).toThrowError();
			});
			['', null, undefined].forEach(function (body) {
				it(`is a blank object if body was [${body}]`, () => {
					apiGWRequest.body = body;
					expect(underTest(apiGWRequest).body).toEqual({});
				});
			});
		});
		describe('when it is base64encoded', () => {
			let encoded, decoded;
			beforeEach(() => {
				decoded = JSON.stringify({ a: 'b' });
				encoded = new Buffer(decoded).toString('base64');
				apiGWRequest.body = encoded;
				apiGWRequest.isBase64Encoded = true;
			});
			it('decodes then parses application/json', () => {
				apiGWRequest.headers['Content-Type'] = 'application/json';
				expect(underTest(apiGWRequest).body).toEqual(JSON.parse(decoded));
				expect(underTest(apiGWRequest).rawBody).toEqual(encoded);
			});
			['text/plain', 'application/xml', 'text/xml'].forEach(textContent => {
				it(`decodes ${textContent} into utf8`, () => {
					apiGWRequest.headers['Content-Type'] = textContent;
					expect(underTest(apiGWRequest).body).toEqual(decoded);
					expect(underTest(apiGWRequest).rawBody).toEqual(encoded);
				});
			});
			it('keeps other types as a binary buffer', () => {
				apiGWRequest.headers['Content-Type'] = 'application/octet-stream';
				expect(underTest(apiGWRequest).body).toEqual(new Buffer(decoded));
				expect(underTest(apiGWRequest).rawBody).toEqual(encoded);
			});
			it('decodes application/x-www-form-urlencoded', () => {
				apiGWRequest.headers['Content-Type'] = 'application/x-www-form-urlencoded';
				apiGWRequest.body = new Buffer('birthyear=1905&press=%20OK%20').toString('base64');

				const result = underTest(apiGWRequest);

				expect(result.body).toEqual('birthyear=1905&press=%20OK%20');
				expect(result.rawBody).toEqual(apiGWRequest.body);
				expect(result.post).toEqual({birthyear: '1905', press: ' OK '});
			});
		});

	});
	describe('rawBody', () => {
		['application/json', 'text/plain', 'text/xml', null, '', undefined].forEach(function (contentType) {
			describe(`when content type is "${contentType}"`, () => {
				beforeEach(() => {
					apiGWRequest.headers['Content-Type'] = contentType;
					apiGWRequest.body = '{"a": "b"}';
				});
				it('contains the original copy of the body', function () {
					expect(underTest(apiGWRequest).rawBody).toEqual('{"a": "b"}');
				});
				it('is a blank string if the original body was null', () => {
					apiGWRequest.body = null;
					expect(underTest(apiGWRequest).rawBody).toEqual('');
				});
			});
		});
	});
	describe('rawBody contains object', () => {
		describe('when content type is "application/json" and body is an object body', () => {
			beforeEach(() => {
				apiGWRequest.headers['Content-Type'] = 'application/json';
				apiGWRequest.body = { a: 'b' };
			});
			it('contains the original copy of the body', () => {
				expect(underTest(apiGWRequest).body).toEqual({ a: 'b' });
			});
			it('is a empty object {} if the original body was null', () => {
				apiGWRequest.body = null;
				expect(underTest(apiGWRequest).rawBody).toEqual('');
				expect(underTest(apiGWRequest).body).toEqual({});
			});
			it('is a empty object {} if the original body was undefined', () => {
				apiGWRequest.body = undefined;
				expect(underTest(apiGWRequest).rawBody).toEqual('');
				expect(underTest(apiGWRequest).body).toEqual({});
			});
		});
	});
	describe('lambdaContext', () => {
		it('contains the value of the second argument, if provided', () => {
			expect(underTest(apiGWRequest, {a: 'b123'}).lambdaContext).toEqual({a: 'b123'});
		});
	});
	describe('proxyRequest', () => {
		it('contains the original API GW Proxy request', () => {
			expect(underTest(apiGWRequest).proxyRequest).toEqual(apiGWRequest);
		});
	});
	describe('context', () => {
		describe('method', () => {
			it('contains the http method', () => {
				expect(underTest(apiGWRequest).context.method).toEqual('POST');
			});
			it('is always uppercase', () => {
				apiGWRequest.requestContext.httpMethod = 'opTiOnS';
				expect(underTest(apiGWRequest).context.method).toEqual('OPTIONS');
			});
			it('is GET if httpMethod is not specified', () => {
				apiGWRequest.requestContext.httpMethod = null;
				expect(underTest(apiGWRequest).context.method).toEqual('GET');
			});
		});
		describe('path', () => {
			it('contains the request path', () => {
				expect(underTest(apiGWRequest).context.path).toEqual('/hello/{name}');
			});
		});
		describe('stage', () => {
			it('containst the api gateway stage', () => {
				expect(underTest(apiGWRequest).context.stage).toEqual('latest');
			});
		});
		describe('sourceIp', () => {
			it('containst the api request source IP', () => {
				expect(underTest(apiGWRequest).context.sourceIp).toEqual('24.15.46.241');
			});
		});
		describe('accountId', () => {
			it('containst the request account ID', () => {
				expect(underTest(apiGWRequest).context.accountId).toEqual('acc-id');
			});
		});
		describe('user', () => {
			it('containst the request AWS user', () => {
				expect(underTest(apiGWRequest).context.user).toEqual('request-user');
			});
		});
		describe('userAgent', () => {
			it('containst the request user agent', () => {
				expect(underTest(apiGWRequest).context.user).toEqual('request-user');
			});
		});
		describe('userArn', () => {
			it('containst the request AWS user ARN', () => {
				expect(underTest(apiGWRequest).context.userArn).toEqual('user-arn');
			});
		});
		describe('caller', () => {
			it('containst the request caller identity', () => {
				expect(underTest(apiGWRequest).context.caller).toEqual('request-caller');
			});
		});
		describe('apiKey', () => {
			it('containst the API key used for the call', () => {
				expect(underTest(apiGWRequest).context.apiKey).toEqual('api-key');
			});
		});
		describe('authorizerPrincipalId', () => {
			it('containst the authorizer principal, if provided', () => {
				expect(underTest(apiGWRequest).context.authorizerPrincipalId).toEqual('abc');
			});
			it('is null if authorizer context is not present', () => {
				apiGWRequest.requestContext.authorizer = null;
				expect(underTest(apiGWRequest).context.authorizerPrincipalId).toEqual(null);
			});
		});
		describe('authorizer', () => {
			it('containst the authorizer information, if provided', () => {
				expect(underTest(apiGWRequest).context.authorizer).toEqual({principalId: 'abc'});
			});
			it('is null if authorizer context is not present', () => {
				apiGWRequest.requestContext.authorizer = null;
				expect(underTest(apiGWRequest).context.authorizer).toEqual(null);
			});
		});
		describe('cognitoAuthenticationProvider', () => {
			it('containst the cognito authentication provider', () => {
				expect(underTest(apiGWRequest).context.cognitoAuthenticationProvider).toEqual('cognito-auth-provider');
			});
		});
		describe('cognitoAuthenticationType', () => {
			it('containst the cognito authentication type', () => {
				expect(underTest(apiGWRequest).context.cognitoAuthenticationType).toEqual('cognito-auth-type');
			});
		});
		describe('cognitoIdentityId', () => {
			it('containst the cognito identity ID', () => {
				expect(underTest(apiGWRequest).context.cognitoIdentityId).toEqual('cognito-identity-id');
			});
		});
		describe('cognitoIdentityPoolId', () => {
			it('containst the cognito identity pool ID', () => {
				expect(underTest(apiGWRequest).context.cognitoIdentityPoolId).toEqual('cognito-pool-id');
			});
		});
		it('is an empty object if request context is not defined', () => {
			apiGWRequest.requestContext = null;
			expect(underTest(apiGWRequest).context).toEqual({});
		});
	});
});
