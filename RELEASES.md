# Release history

## 4.1.0 15 June 2017

- ApiResponse is now static, so it's easier to use in your own functions, thanks to [Aaron J. Lang](https://github.com/aaronjameslang)
- bugfix for greedy path routing when the API_GW request type is used, thanks to [Aaron J. Lang](https://github.com/aaronjameslang)


## 4.0.0 9 April 2017

- bumping version for sync with claudia

## 2.5.1, 7 June 2017

- easier handling for Lambda environment and stage variables, using `{mergeVars: true}` 

## 2.4.2, 3 May 2017

- API builder will not explode, but provide a helpful error message when invalid or circular JSON structures passed as application/json requests or responses

## 2.4.0, 17 January 2017

- support for API Gateway Binary content handling

## 2.3.0, 3 December 2016

- expose CORS Max-Age in the config, so Claudia can set it even when default CORS settings are used on API Gateway

## 2.2.0, 28 November 2016

- Allow ApiResponse to be returned from an interceptor, so it can send back a custom error code

## 2.1.0, 24 November 2016

- enable max-age to be specified on CORS headers (thanks to [Philipp Holly](https://github.com/phips28)) \
- limit magic location header only to actual 3xx redirects (301 and 302), allowing other codes such as 304 to be handled differently, fixes [issue 20](https://github.com/claudiajs/claudia-api-builder/issues/20) 

## 2.0.2, 25. October 2016

- bugfix for setting the Access-Control-Allow-Credentials header, thanks to [StampStyle](https://github.com/StampStyle)

## 2.0.1, 16. October 2016

- bugfix for intercepting non-web requests, where 2.0 introduced backwards incompatibility wrapping even non-API Gateway requests into proxyRequest. The behaviour is now compatible with 1.x, where non-web requests are sent to the intercepting function unmodified.

## 2.0.0, 27. September 2016 

- support for API Gateway [Lambda Proxy Integrations](docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-create-api-as-simple-proxy-for-lambda.html)
- support for routing via .ANY method
- support for selecting request type (either CLAUDIA_API_BUILDER or AWS_PROXY)
- support for dynamic response codes
- completed CORS support (all HTTP method request handlers can now also limit CORS allowed origins, instead of just the OPTIONS one)
- support for asynchronous CORS origin filters
- stopping support for Node 0.10
- (will only work with claudia 2.x)

## 1.6.0, 26 August 2016

- support for custom authorizers

## 1.5.1, 4 August 2016

- by default, API processing stops the node VM using the [callbackWaitsForEmptyEventLoop](http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html) Lambda context parameter. This is to prevent runaway node.js events caused by third party libs causing the Lambda VM to become stuck after a request completes. If you really want the VM execution to continue until the event loop empties, even after your API process is done, then set `lambdaContext.callbackWaitsForEmptyEventLoop` to `true` in your request handler.

## 1.5.0, 12 July 2016

- support for intercepting and modifying requests

## 1.4.1, 1.4.0, 11 July 2016

- shortcut for configuring stage variables during deployment
- you can now provide a handler for unsupported event formats, and invoke the same Lambda from a source that's not API Gateway
