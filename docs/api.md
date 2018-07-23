# API definition syntax

> this is the API documentation for versions 2.x and later. If you are looking for older (1.x) versions, check out [version 1.x API documentation](https://github.com/claudiajs/claudia-api-builder/blob/4f5c30df0365812765806ae2f9fd97e7a1287ed9/docs/api.md)

Claudia API builder makes it easy to configure and deploy API Gateway definitions together with a Lambda function, providing an abstraction that is similar to lightweight JavaScript web servers such as `express`. 

```javascript
var ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder(),
	superb = require('superb');

module.exports = api;

api.get('/greet', function (request) {
	return request.queryString.name + ' is ' + superb.random();
});
```

For a more detailed example, see the [Web API Example project](https://github.com/claudiajs/example-projects/tree/master/web-api).

## Defining routes

An instance of the Claudia API Builder should be used as the module export from your API module. You can create a new API simply
by instantiating a new `ApiBuilder`, then defining HTTP handlers for paths by calling `.get`, `.put`, and `.post`. 

You can also create a generic handler for any method on a path, using `.any`. See the [Web API Generic Handlers Project](https://github.com/claudiajs/example-projects/tree/master/web-api-generic-handlers) for an example.

## Responding to requests

Claudia API builder will try to automatically format the result according to the content type. If you use the 'application/json' content type, you can respond with a String or an Object, the response will be correctly encoded or serialised into JSON. 

You can either respond synchronously (just return a value), or respond with a `Promise`. In that case, the lambda function will wait until the 
`Promise` resolves or rejects before responding. API Builder just checks for the `.then` method, so it should work with any A+ Promise library. 

```javascript
api.get('/greet', function (request) {
	return request.queryString.name + ' is amazing';
});
api.post('/set-user', function (request) {
  return new Promise(function (resolve, reject) {
    // some asynchronous operation
  }).then(() => request.queryString.name + ' was saved');
});

```



To implement a custom termination workflow, use the [`request.lambdaContext`](http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html) object, and return a `Promise` that never gets resolved.

## Detailed API documentation and examples

* [The API Builder Request Object](request-object.md)
  * [How  to use the API Gateway proxy object instead of the API Builder](api-gateway-proxy-request.md)
* [How to customise responses (HTTP codes, headers, content types)](customise-responses.md)
  * [Controlling Cross-Origin Resource Sharing headers](cors.md)
* [How to set configuration and environment variables](variables.md)
* [How to set up authorization (API Keys, IAM and Cognito Authorizers)](authorization.md)
* [How to control API result caching](caching.md)
* [How to handle binary content](binary-content.md)
* [Adding post-deploy configuration steps](post-deploy.md)
* [How to filter, modify and intercept requests](intercepting.md)

