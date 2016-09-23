/*global require, describe, it, expect, beforeEach */
var underTest = require('../src/extend-api-gw-proxy-request');
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
				'X-Forwarded-For' : '24.135.46.241, 54.239.167.121'
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
				'httpMethod' : 'GET',
				'identity' : {
					'accountId' : null,
					'userAgent' : 'curl/7.43.0',
					'apiKey' : null,
					'cognitoIdentityId' : null,
					'user' : null,
					'cognitoIdentityPoolId' : null,
					'cognitoAuthenticationProvider' : null,
					'caller' : null,
					'userArn' : null,
					'sourceIp' : '24.135.46.241',
					'cognitoAuthenticationType' : null
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
	describe('queryString', function () {
		it('copies queryStringParameters into queryString', function () {
			expect(underTest(apiGWRequest).queryString).toEqual({
				'a' : 'b',
				'c' : 'd',
				'code' : '403'
			});
		});
		it('leaves the old values intact', function () {
			expect(underTest(apiGWRequest).queryStringParameters).toEqual({
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
		it('leaves the old values intact', function () {
			expect(underTest(apiGWRequest).stageVariables).toEqual({
				'lambdaVersion' : 'latest'
			});
		});
		it('uses empty object original stage variables are not defined', function () {
			apiGWRequest.stageVariables = null;
			expect(underTest(apiGWRequest).env).toEqual({});
		});
	});
	describe('headers', function () {
		it('leaves headers intact', function () {
			expect(underTest(apiGWRequest).headers).toEqual({
				'Authorization' : 'abc-DeF',
				'X-Forwarded-Port' : '443',
				'Content-Type' : 'application/x-www-form-urlencoded',
				'X-Forwarded-For' : '24.135.46.241, 54.239.167.121'
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
				'x-forwarded-for' : '24.135.46.241, 54.239.167.121'
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
				it('is unchanged', function () {
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
});
