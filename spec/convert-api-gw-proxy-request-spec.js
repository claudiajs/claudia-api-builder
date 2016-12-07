/*global require, describe, it, expect, beforeEach */
var underTest = require('../src/convert-api-gw-proxy-request');
describe('extendApiGWProxyRequest', function () {
	'use strict';
	var apiGWRequest;
	beforeEach(function () {
		apiGWRequest = {
			'stageVariables' : {
				'lambdaVersion' : 'latest'
			},
			'headers' : {
				'Authorization' : 'abc-DeF',
				'X-Forwarded-Port' : '443',
				'Content-Type' : 'application/x-www-form-urlencoded',
				'X-Forwarded-For' : '24.15.46.241, 54.239.167.121'
			},
			'body' : 'birthyear=1905&press=%20OK%20',
			'httpMethod' : 'POST',
			'pathParameters' : {
				'name' : 'sub1'
			},
			'resource' : '/hello/{name}',
			'path' : '/hello/sub1',
			'queryStringParameters' : {
				'a' : 'b',
				'c' : 'd',
				'code' : '403'
			},
			'requestContext' : {
				'resourceId' : 'rxcwwa',
				'resourcePath' : '/hello/{name}',
				'authorizer' : {
					'principalId' : 'abc'
				},
				'httpMethod' : 'POST',
				'identity' : {
					'accountId' : 'acc-id',
					'userAgent' : 'curl/7.43.0',
					'apiKey' : 'api-key',
					'cognitoIdentityId' : 'cognito-identity-id',
					'user' : 'request-user',
					'cognitoIdentityPoolId' : 'cognito-pool-id',
					'cognitoAuthenticationProvider' : 'cognito-auth-provider',
					'caller' : 'request-caller',
					'userArn' : 'user-arn',
					'sourceIp' : '24.15.46.241',
					'cognitoAuthenticationType' : 'cognito-auth-type'
				},
				'accountId' : '818931230230',
				'apiId' : 'txdif4prz3',
				'stage' : 'latest',
				'requestId' : 'c1a20045-80ee-11e6-b878-a1b0067c1281'
			}
		};
	});
	describe('versioning', function () {
		it('adds version 3', function () {
			expect(underTest(apiGWRequest).v).toEqual(3);
		});
	});
	it('does not modify the original request', function () {
		var original = JSON.parse(JSON.stringify(apiGWRequest));
		underTest(apiGWRequest);
		expect(apiGWRequest).toEqual(original);
	});
	describe('pathParams', function () {
		it('copies pathParameters into pathParams', function () {
			expect(underTest(apiGWRequest).pathParams).toEqual({
				'name' : 'sub1'
			});
		});
		it('uses empty object if the original path params are not defined', function () {
			apiGWRequest.pathParameters = null;
			expect(underTest(apiGWRequest).pathParams).toEqual({});
		});
	});
	describe('queryString', function () {
		it('copies queryStringParameters into queryString', function () {
			expect(underTest(apiGWRequest).queryString).toEqual({
				'a' : 'b',
				'c' : 'd',
				'code' : '403'
			});
		});
		it('uses empty object if the original query string is not defined', function () {
			apiGWRequest.queryStringParameters = null;
			expect(underTest(apiGWRequest).queryString).toEqual({});
		});
	});
	describe('env', function () {
		it('copies stageVariables into env', function () {
			expect(underTest(apiGWRequest).env).toEqual({
				'lambdaVersion' : 'latest'
			});
		});
		it('uses empty object original stage variables are not defined', function () {
			apiGWRequest.stageVariables = null;
			expect(underTest(apiGWRequest).env).toEqual({});
		});
	});
	describe('headers', function () {
		it('copies headers intact', function () {
			expect(underTest(apiGWRequest).headers).toEqual({
				'Authorization' : 'abc-DeF',
				'X-Forwarded-Port' : '443',
				'Content-Type' : 'application/x-www-form-urlencoded',
				'X-Forwarded-For' : '24.15.46.241, 54.239.167.121'
			});
		});
		it('replaces headers with an empty object if not defined', function () {
			apiGWRequest.headers = null;
			expect(underTest(apiGWRequest).headers).toEqual({});
		});
	});
	describe('normalizedHeaders', function () {
		it('creates a copy of headers with lowercase header names', function () {
			expect(underTest(apiGWRequest).normalizedHeaders).toEqual({
				'authorization' : 'abc-DeF',
				'x-forwarded-port' : '443',
				'content-type' : 'application/x-www-form-urlencoded',
				'x-forwarded-for' : '24.15.46.241, 54.239.167.121'
			});
		});
		it('uses empty object if headers are not defined', function () {
			apiGWRequest.headers = null;
			expect(underTest(apiGWRequest).normalizedHeaders).toEqual({});
		});
	});
	describe('post', function () {
		it('is not present if the content type is not application/x-www-form-urlencoded', function () {
			apiGWRequest.headers['Content-Type'] = 'application/xml; charset=ISO-8859-1';
			expect(Object.keys(underTest(apiGWRequest))).not.toContain('post');
		});
		it('is not present if the content type header is not defined', function () {
			delete apiGWRequest.headers['Content-Type'];
			expect(Object.keys(underTest(apiGWRequest))).not.toContain('post');
		});
		it('is a decoded URL string if the content type is application/x-www-form-urlencoded', function () {
			expect(underTest(apiGWRequest).post).toEqual({ birthyear: '1905', press: ' OK ' });
		});
		it('works with mixed case content type header', function () {
			delete apiGWRequest.headers['Content-Type'];
			apiGWRequest.headers['content-Type'] = 'application/x-www-form-urlencoded';
			expect(underTest(apiGWRequest).post).toEqual({ birthyear: '1905', press: ' OK ' });
		});
		it('is an empty object if body is not defined', function () {
			apiGWRequest.body = null;
			expect(underTest(apiGWRequest).post).toEqual({});
		});
		it('works even if the client provides a charset with the content type header', function () {
			apiGWRequest.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=ISO-8859-1';
			expect(underTest(apiGWRequest).post).toEqual({ birthyear: '1905', press: ' OK ' });
		});
	});
	describe('body', function () {
		['', 'text/plain', 'application/xml', 'text/xml', 'application/x-www-form-urlencoded'].forEach(function (contentType) {
			describe('if content type is ' + (contentType || 'not provided'), function () {
				beforeEach(function () {
					apiGWRequest.headers['Content-Type'] = contentType;
				});
				it('is just copied', function () {
					expect(underTest(apiGWRequest).body).toEqual('birthyear=1905&press=%20OK%20');
				});
				it('is a blank string if the original body is null ', function () {
					apiGWRequest.body = null;
					expect(underTest(apiGWRequest).body).toEqual('');
				});
			});
		});
		describe('if content type is application/json', function () {
			beforeEach(function () {
				apiGWRequest.body = JSON.stringify({ birthyear: '1905', press: ' OK ' });
				apiGWRequest.headers['Content-Type'] = 'application/json';
			});
			it('is a parsed JSON object if the content type is application/json', function () {
				expect(underTest(apiGWRequest).body).toEqual({ birthyear: '1905', press: ' OK ' });
			});
			it('works with mixed case content type header', function () {
				delete apiGWRequest.headers['Content-Type'];
				apiGWRequest.headers['content-Type'] = 'application/json';
				expect(underTest(apiGWRequest).body).toEqual({ birthyear: '1905', press: ' OK ' });
			});
			it('works even if the client provides a charset with the content type header', function () {
				apiGWRequest.headers['Content-Type'] = 'application/json';
				expect(underTest(apiGWRequest).body).toEqual({ birthyear: '1905', press: ' OK ' });
			});
			it('throws an error if JSON cannot be parsed', function () {
				apiGWRequest.body = '{ "a": "b"';
				expect(function () {
					underTest(apiGWRequest);
				}).toThrowError();
			});
			['', null, undefined].forEach(function (body) {
				it('is a blank object if body was [' + body + ']', function () {
					apiGWRequest.body = body;
					expect(underTest(apiGWRequest).body).toEqual({});
				});
			});
		});

	});
	describe('rawBody', function () {
		['application/json', 'text/plain', 'text/xml', null, '', undefined].forEach(function (contentType) {
			describe('when content type is "' + contentType + '"', function () {
				beforeEach(function () {
					apiGWRequest.headers['Content-Type'] = contentType;
					apiGWRequest.body = '{"a": "b"}';
				});
				it('contains the original copy of the body', function ()  {
					expect(underTest(apiGWRequest).rawBody).toEqual('{"a": "b"}');
				});
				it('is a blank string if the original body was null', function () {
					apiGWRequest.body = null;
					expect(underTest(apiGWRequest).rawBody).toEqual('');
				});
			});
		});
	});
	describe('rawBody contains object', function () {
		describe('when content type is "application/json" and body is an object body', function () {
			beforeEach(function () {
				apiGWRequest.headers['Content-Type'] = 'application/json';
				apiGWRequest.body = { a: 'b' };
			});
			it('contains the original copy of the body', function () {
				expect(underTest(apiGWRequest).body).toEqual({ a: 'b' });
			});
			it('is a empty object {} if the original body was null', function () {
				apiGWRequest.body = null;
				expect(underTest(apiGWRequest).rawBody).toEqual('');
				expect(underTest(apiGWRequest).body).toEqual({});
			});
			it('is a empty object {} if the original body was undefined', function () {
				apiGWRequest.body = undefined;
				expect(underTest(apiGWRequest).rawBody).toEqual('');
				expect(underTest(apiGWRequest).body).toEqual({});
			});
		});
	});
	describe('lambdaContext', function () {
		it('contains the value of the second argument, if provided', function () {
			expect(underTest(apiGWRequest, {a: 'b123'}).lambdaContext).toEqual({a: 'b123'});
		});
	});
	describe('proxyRequest', function () {
		it('contains the original API GW Proxy request', function () {
			expect(underTest(apiGWRequest).proxyRequest).toEqual(apiGWRequest);
		});
	});
	describe('context', function () {
		describe('method', function () {
			it('contains the http method', function () {
				expect(underTest(apiGWRequest).context.method).toEqual('POST');
			});
			it('is always uppercase', function () {
				apiGWRequest.requestContext.httpMethod = 'opTiOnS';
				expect(underTest(apiGWRequest).context.method).toEqual('OPTIONS');
			});
			it('is GET if httpMethod is not specified', function () {
				apiGWRequest.requestContext.httpMethod = null;
				expect(underTest(apiGWRequest).context.method).toEqual('GET');
			});
		});
		describe('path', function () {
			it('contains the request path', function () {
				expect(underTest(apiGWRequest).context.path).toEqual('/hello/{name}');
			});
		});
		describe('stage', function () {
			it('containst the api gateway stage', function () {
				expect(underTest(apiGWRequest).context.stage).toEqual('latest');
			});
		});
		describe('sourceIp', function () {
			it('containst the api request source IP', function () {
				expect(underTest(apiGWRequest).context.sourceIp).toEqual('24.15.46.241');
			});
		});
		describe('accountId', function () {
			it('containst the request account ID', function () {
				expect(underTest(apiGWRequest).context.accountId).toEqual('acc-id');
			});
		});
		describe('user', function () {
			it('containst the request AWS user', function () {
				expect(underTest(apiGWRequest).context.user).toEqual('request-user');
			});
		});
		describe('userAgent', function () {
			it('containst the request user agent', function () {
				expect(underTest(apiGWRequest).context.user).toEqual('request-user');
			});
		});
		describe('userArn', function () {
			it('containst the request AWS user ARN', function () {
				expect(underTest(apiGWRequest).context.userArn).toEqual('user-arn');
			});
		});
		describe('caller', function () {
			it('containst the request caller identity', function () {
				expect(underTest(apiGWRequest).context.caller).toEqual('request-caller');
			});
		});
		describe('apiKey', function () {
			it('containst the API key used for the call', function () {
				expect(underTest(apiGWRequest).context.apiKey).toEqual('api-key');
			});
		});
		describe('authorizerPrincipalId', function () {
			it('containst the authorizer principal, if provided', function () {
				expect(underTest(apiGWRequest).context.authorizerPrincipalId).toEqual('abc');
			});
			it('is null if authorizer context is not present', function () {
				apiGWRequest.requestContext.authorizer = null;
				expect(underTest(apiGWRequest).context.authorizerPrincipalId).toEqual(null);
			});
		});
		describe('cognitoAuthenticationProvider', function () {
			it('containst the cognito authentication provider', function () {
				expect(underTest(apiGWRequest).context.cognitoAuthenticationProvider).toEqual('cognito-auth-provider');
			});
		});
		describe('cognitoAuthenticationType', function () {
			it('containst the cognito authentication type', function () {
				expect(underTest(apiGWRequest).context.cognitoAuthenticationType).toEqual('cognito-auth-type');
			});
		});
		describe('cognitoIdentityId', function () {
			it('containst the cognito identity ID', function () {
				expect(underTest(apiGWRequest).context.cognitoIdentityId).toEqual('cognito-identity-id');
			});
		});
		describe('cognitoIdentityPoolId', function () {
			it('containst the cognito identity pool ID', function () {
				expect(underTest(apiGWRequest).context.cognitoIdentityPoolId).toEqual('cognito-pool-id');
			});
		});
		it('is an empty object if request context is not defined', function () {
			apiGWRequest.requestContext = null;
			expect(underTest(apiGWRequest).context).toEqual({});
		});
	});
});
