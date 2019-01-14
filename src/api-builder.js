const util = require('util'),
	convertApiGWProxyRequest = require('./convert-api-gw-proxy-request'),
	sequentialPromiseMap = require('./sequential-promise-map'),
	lowercaseKeys = require('./lowercase-keys');
module.exports = function ApiBuilder(options) {
	'use strict';
	let customCorsHandler,
		customCorsHeaders,
		customCorsMaxAge,
		customResponses,
		unsupportedEventCallback,
		authorizers,
		interceptCallback,
		requestFormat,
		binaryMediaTypes;

	const self = this,
		safeStringify = function (object) {
			return util.format('%j', object);
		},
		getRequestFormat = function (newFormat) {
			const supportedFormats = ['AWS_PROXY', 'CLAUDIA_API_BUILDER'];
			if (!newFormat) {
				return 'CLAUDIA_API_BUILDER';
			} else {
				if (supportedFormats.indexOf(newFormat) >= 0) {
					return newFormat;
				} else {
					throw `Unsupported request format ${newFormat}`;
				}
			}
		},
		defaultBinaryMediaTypes = [
			'image/webp',
			'image/*',
			'image/jpg',
			'image/jpeg',
			'image/gif',
			'image/png',
			'application/octet-stream',
			'application/pdf',
			'application/zip'
		],
		logger = (options && options.logger) || console.log,
		methodConfigurations = {},
		routes = {},
		postDeploySteps = {},
		v2DeprecationWarning = function (what) {
			logger(`${what} are deprecated, and be removed in claudia api builder v3. Check https://claudiajs.com/tutorials/migrating_to_2.html`);
		},
		supportedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'],
		prompter = (options && options.prompter) || require('./ask'),
		isApiResponse = function (obj) {
			return obj && (typeof obj === 'object') && (Object.getPrototypeOf(obj) === self.ApiResponse.prototype);
		},
		mergeObjects = function (from, to) {
			return Object.assign(to, from);
		},
		isRedirect = function (code) {
			return /3[0-9][1-3]/.test(code);
		},
		getContentType = function (configuration, result) {
			const staticHeader = (configuration && configuration.headers && lowercaseKeys(configuration.headers)['content-type']),
				dynamicHeader = (result && isApiResponse(result) && result.headers && lowercaseKeys(result.headers)['content-type']),
				staticConfig = configuration && configuration.contentType;

			return dynamicHeader || staticHeader || staticConfig || 'application/json';
		},
		getStatusCode = function (configuration, result, resultType) {
			const defaultCode = {
					'success': 200,
					'error': 500
				},
				staticCode = (configuration && configuration.code) || (typeof configuration === 'number' && configuration),
				dynamicCode = result && (isApiResponse(result) && result.code);
			return dynamicCode || staticCode || defaultCode[resultType];
		},
		getRedirectLocation = function (configuration, result) {
			const dynamicHeader = result && isApiResponse(result) && result.headers && lowercaseKeys(result.headers).location,
				dynamicBody = isApiResponse(result) ? result.response : result,
				staticHeader = configuration && configuration.headers && lowercaseKeys(configuration.headers).location;
			return dynamicHeader || dynamicBody || staticHeader;
		},
		getCanonicalContentType = function (contentType) {
			return (contentType && contentType.split(';')[0]) || 'application/json';
		},
		safeToString = function (contents) {
			if (!contents) {
				return '';
			}
			if (Buffer.isBuffer(contents)) {
				return contents.toString('base64');
			}
			if (typeof contents === 'string') {
				return contents;
			}
			if (typeof contents === 'object') {
				return safeStringify(contents);
			}
			return String(contents);
		},
		getSuccessBody = function (contentType, handlerResult) {
			const contents = isApiResponse(handlerResult) ? handlerResult.response : handlerResult;
			if (getCanonicalContentType(contentType) === 'application/json') {
				if (contents === '' || contents ===	undefined) {
					return '{}';
				} else {
					try {
						return JSON.stringify(contents);
					} catch (e) {
						throw new Error('Response contains a circular reference and cannot be serialized to JSON');
					}
				}
			} else {
				return safeToString(contents);
			}
		},
		isError = function (object) {
			return object && (object.message !== undefined) && object.stack;
		},
		logError = function (err) {
			let logInfo = err;
			if (isApiResponse(err)) {
				logInfo = safeStringify(err);
			} else if (isError(err)) {
				logInfo = err.stack;
			}
			logger(logInfo);
		},
		getErrorResponseContents = function (handlerResult) {
			if (!handlerResult) {
				return '';
			}
			if (isApiResponse(handlerResult)) {
				return handlerResult.response;
			}
			if (isError(handlerResult) && handlerResult.message) {
				return handlerResult.message;
			}
			return handlerResult;
		},
		getErrorBody = function (contentType, handlerResult) {
			const responseContents = safeToString(getErrorResponseContents(handlerResult));

			if (isApiResponse(handlerResult) || getCanonicalContentType(contentType) !== 'application/json') {
				return responseContents;
			}
			return JSON.stringify({errorMessage: responseContents || '' });
		},
		getBody = function (contentType, handlerResult, resultType) {
			return resultType === 'success' ? getSuccessBody(contentType, handlerResult) : getErrorBody(contentType, handlerResult);
		},
		packResult = function (handlerResult, routingInfo, corsHeaders, resultType) {
			const path = routingInfo.path.replace(/^\//, ''),
				method = routingInfo.method,
				configuration = methodConfigurations[path] && methodConfigurations[path][method] && methodConfigurations[path][method][resultType],
				customHeaders = configuration && configuration.headers,
				contentType = getContentType(configuration, handlerResult),
				statusCode = getStatusCode(configuration, handlerResult, resultType),
				result = {
					statusCode: statusCode,
					headers: { 'Content-Type': contentType },
					body: getBody(contentType, handlerResult, resultType)
				};
			if (configuration && configuration.contentHandling === 'CONVERT_TO_BINARY' && resultType === 'success') {
				result.isBase64Encoded = true;
			}
			mergeObjects(corsHeaders, result.headers);
			if (customHeaders) {
				if (Array.isArray(customHeaders)) {
					v2DeprecationWarning('enumerated headers');
				} else {
					mergeObjects(customHeaders, result.headers);
				}
			}
			if (isApiResponse(handlerResult)) {
				mergeObjects(handlerResult.headers, result.headers);
			}
			if (isRedirect(statusCode)) {
				result.headers.Location = getRedirectLocation(configuration, handlerResult);
			}
			return result;
		},
		getCorsHeaders = function (request, methods) {
			if (methods.indexOf('ANY') >= 0 || methods.length === 0) {
				methods = supportedMethods;
			}
			return Promise.resolve().then(() => {
				if (customCorsHandler === false) {
					return '';
				} else if (customCorsHandler) {
					return customCorsHandler(request);
				} else {
					return '*';
				}
			}).then(corsOrigin => {
				if (!corsOrigin) {
					return {};
				};
				return {
					'Access-Control-Allow-Origin': corsOrigin,
					'Access-Control-Allow-Headers': (customCorsHeaders || 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'),
					'Access-Control-Allow-Methods': methods.sort().join(',') + ',OPTIONS',
					'Access-Control-Allow-Credentials': 'true',
					'Access-Control-Max-Age': customCorsMaxAge || '0'
				};
			});
		},
		routeEvent = function (routingInfo, event, context) {
			if (!routingInfo) {
				throw 'routingInfo not set';
			}
			const handler = routes[routingInfo.path] && (
				routes[routingInfo.path][routingInfo.method] ||
				routes[routingInfo.path].ANY
			);
			return getCorsHeaders(event, Object.keys(routes[routingInfo.path] || {}))
				.then(corsHeaders => {
					if (routingInfo.method === 'OPTIONS') {
						return {
							statusCode: 200,
							body: '',
							headers: corsHeaders
						};
					} else if (handler) {
						return Promise.resolve()
							.then(() => handler(event, context))
							.then(result => packResult(result, routingInfo, corsHeaders, 'success'))
							.catch(error => {
								logError(error);
								return packResult(error, routingInfo, corsHeaders, 'error');
							});
					} else {
						return Promise.reject(`no handler for ${routingInfo.method} ${routingInfo.path}`);
					}
				});

		},
		getRequestRoutingInfo = function (request) {
			if (requestFormat === 'AWS_PROXY') {
				if (!request.requestContext) {
					return {};
				}
				return {
					path: request.requestContext.resourcePath,
					method: request.requestContext.httpMethod
				};
			} else {
				return request.context || {};
			}
		},
		isFromApiGw = function (event) {
			return event && event.requestContext && event.requestContext.resourcePath && event.requestContext.httpMethod;
		},
		getRequest = function (event, context) {
			if (requestFormat === 'AWS_PROXY' || requestFormat === 'DEPRECATED' || !isFromApiGw(event)) {
				return event;
			} else {
				return convertApiGWProxyRequest(event, context, options && options.mergeVars);
			}
		},
		executeInterceptor = function (request, context) {
			if (!interceptCallback) {
				return Promise.resolve(request);
			} else {
				return Promise.resolve()
					.then(() => interceptCallback(request, context));
			}
		},
		setUpHandler = function (method) {
			self[method.toLowerCase()] = function (route, handler, options) {
				const pathPart = route.replace(/^\//, '');
				let canonicalRoute = route;
				if (!/^\//.test(canonicalRoute)) {
					canonicalRoute = '/' + route;
				}
				if (!methodConfigurations[pathPart]) {
					methodConfigurations[pathPart] = {};
				}
				methodConfigurations[pathPart][method] = (options || {});
				if (!routes[canonicalRoute]) {
					routes[canonicalRoute] = {};
				}
				routes[canonicalRoute][method] = handler;
			};
		};

	self.apiConfig = function () {
		const result = {version: 4, routes: methodConfigurations};
		if (customCorsHandler !== undefined) {
			result.corsHandlers = !!customCorsHandler;
		}
		if (customCorsHeaders) {
			result.corsHeaders = customCorsHeaders;
		}
		if (customCorsMaxAge) {
			result.corsMaxAge = customCorsMaxAge;
		}
		if (authorizers) {
			result.authorizers = authorizers;
		}
		if (binaryMediaTypes) {
			result.binaryMediaTypes = binaryMediaTypes;
		}
		if (customResponses) {
			result.customResponses = customResponses;
		}
		return result;
	};
	self.corsOrigin = function (handler) {
		if (!handler) {
			customCorsHandler = false;
		} else {
			if (typeof handler === 'function') {
				customCorsHandler = handler;
			} else {
				customCorsHandler = function () {
					return handler;
				};
			}
		}
	};
	self.corsHeaders = function (headers) {
		if (typeof headers === 'string') {
			customCorsHeaders = headers;
		} else {
			throw 'corsHeaders only accepts strings';
		}
	};
	self.corsMaxAge = function (age) {
		if (!isNaN(age)) {
			customCorsMaxAge = age;
		} else {
			throw 'corsMaxAge only accepts numbers';
		}
	};
	self.ApiResponse = module.exports.ApiResponse; // TODO deprecated, remove for next major version?
	self.unsupportedEvent = function (callback) {
		v2DeprecationWarning('.unsupportedEvent handlers');
		unsupportedEventCallback = callback;
	};
	self.intercept = function (callback) {
		interceptCallback = callback;
	};
	self.proxyRouter = function (event, context, callback) {
		let routingInfo, request;
		const handleError = function (e) {
			context.done(e);
		};
		context.callbackWaitsForEmptyEventLoop = false;
		try {
			request = getRequest(event, context);
		} catch (e) {
			return Promise.resolve().then(() => context.done(null, {
				statusCode: 500,
				headers: { 'Content-Type': 'text/plain' },
				body: (e && e.message) || 'Invalid request'
			}));
		}
		return executeInterceptor(request, context)
			.then(modifiedRequest => {
				if (!modifiedRequest) {
					return context.done(null, null);
				} else if (isApiResponse(modifiedRequest)) {
					return context.done(null, packResult(modifiedRequest, getRequestRoutingInfo(request), {}, 'success'));
				} else {
					routingInfo = getRequestRoutingInfo(modifiedRequest);
					if (routingInfo && routingInfo.path && routingInfo.method) {
						return routeEvent(routingInfo, modifiedRequest, context, callback)
							.then(result => context.done(null, result));
					} else {
						if (unsupportedEventCallback) {
							return unsupportedEventCallback(event, context, callback);
						} else {
							return Promise.reject('event does not contain routing information');
						}
					}
				}
			}).catch(handleError);
	};
	self.router = function (event, context, callback) {
		requestFormat = 'DEPRECATED';
		event.lambdaContext = context;
		v2DeprecationWarning('.router methods');
		return self.proxyRouter(event, context, callback);
	};
	self.addPostDeployStep = function (name, stepFunction) {
		if (typeof name !== 'string') {
			throw new Error('addPostDeployStep requires a step name as the first argument');
		}
		if (typeof stepFunction !== 'function') {
			throw new Error('addPostDeployStep requires a function as the second argument');
		}
		if (postDeploySteps[name]) {
			throw new Error(`Post deploy hook "${name}" already exists`);
		}
		postDeploySteps[name] = stepFunction;
	};
	self.addPostDeployConfig = function (stageVarName, prompt, configOption) {
		self.addPostDeployStep(stageVarName, (options, lambdaDetails, utils) => {
			const configureDeployment = function (varValue) {
					const result = {
						restApiId: lambdaDetails.apiId,
						stageName: lambdaDetails.alias,
						variables: { }
					};
					result.variables[stageVarName] = varValue;
					return result;
				},
				deployStageVar = function (deployment) {
					return utils.apiGatewayPromise.createDeploymentPromise(deployment)
						.then(() => deployment.variables[stageVarName]);
				},
				getVariable = function () {
					if (typeof options[configOption] === 'string') {
						return Promise.resolve(options[configOption]);
					} else {
						return prompter(prompt);
					}
				};
			if (options[configOption]) {
				return getVariable()
					.then(configureDeployment)
					.then(deployStageVar);
			}
		});
	};
	self.postDeploy = function (options, lambdaDetails, utils) {
		const steps = Object.keys(postDeploySteps),
			stepResults = {},
			executeStepMapper = function (stepName) {
				return Promise.resolve()
					.then(() => postDeploySteps[stepName](options, lambdaDetails, utils))
					.then(result => stepResults[stepName] = result);
			};
		if (!steps.length) {
			return Promise.resolve(false);
		}
		return sequentialPromiseMap(steps, executeStepMapper)
			.then(() => stepResults);
	};
	self.registerAuthorizer = function (name, config) {
		if (!name || typeof name !== 'string' || name.length === 0) {
			throw new Error('Authorizer must have a name');
		}
		if (!config || typeof config !== 'object' || Object.keys(config).length === 0) {
			throw new Error(`Authorizer ${name} configuration is invalid`);
		}
		if (!authorizers) {
			authorizers = {};
		}
		if (authorizers[name]) {
			throw new Error(`Authorizer ${name} is already defined`);
		}
		authorizers[name] = config;
	};
	self.setBinaryMediaTypes = function (types) {
		binaryMediaTypes = types;
	};
	self.setGatewayResponse = function (responseType, config) {
		if (!responseType || typeof responseType !== 'string') {
			throw new Error('response type must be a string');
		}
		if (!config || typeof config !== 'object' || Object.keys(config).length === 0) {
			throw new Error(`Response type ${responseType} configuration is invalid`);
		}
		if (!customResponses) {
			customResponses = {};
		}
		if (customResponses[responseType]) {
			throw new Error(`Response type ${responseType} is already defined`);
		}
		customResponses[responseType] = config;
	};
	binaryMediaTypes = defaultBinaryMediaTypes;
	requestFormat = getRequestFormat(options && options.requestFormat);
	['ANY'].concat(supportedMethods).forEach(setUpHandler);
};

module.exports.ApiResponse = function (response, headers, code) {
	'use strict';
	this.response = response;
	this.headers = headers;
	this.code = code;
};

