# Release history

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
