#Claudia API Builder

<img src="https://claudiajs.github.io/claudiajs.com/assets/claudiajs.svg" height="300" align="right" />

This utility simplifies Node.js Lambda - API Gateway handling. It helps you:
  * process multiple AWS API Gateway calls from a single Lambda function in Node.js, so that  
    you can develop and deploy an entire API simpler and avoid inconsistencies.
  * work with synchronous responses or promises, so you can develop easier
    * handle exceptions or promise rejections automatically as Lambda errors
    * handle synchronous responses or promise resolutions automatically as Lambda
  * configure response content types and HTTP codes easily

The API builder is designed to work with [Claudia](https://github.com/claudiajs), and add minimal overhead to client projects. 

[![Join the chat at https://gitter.im/claudiajs/claudia](https://badges.gitter.im/claudiajs/claudia.svg)](https://gitter.im/claudiajs/claudia?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)


## API definition syntax

An instance of the Claudia API Builder should be used as the module export from your API module. You can create a new API simply
by instantiating a new `ApiBuilder`, then defining HTTP handlers for paths by calling `.get`, `.put`, and `.post`. For example, the following 
snippet creates a single handler for a `GET` call to `/greet`, responding with a parameterised message:

```javascript
var ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder(),
	superb = require('superb');

module.exports = api;

api.get('/greet', function (request) {
	return request.queryString.name + ' is ' + superb();
});
```

For a more detailed example, see the [Web API Example project](https://github.com/claudiajs/example-projects/tree/master/web-api).

### The Request Object

Claudia will automatically bundle all the parameters and pass it to your handler, so you do not have to define request and response models. The `request` object passed to your handler contains the following properties:

  * `queryString`: a key-value map of query string arguments
  * `env`: a key-value map of the API Gateway stage variables (useful for storing resource identifiers and access keys)
  * `headers`: a key-value map of all the HTTP headers posted by the client
  * `post`: in case of a FORM post (`application/x-form-www-urlencoded`), a key-value map of the values posted
  * `body`: in case of an `application/json`, the body of the request, parsed as a JSON object; in case of `application/xml` or `text/plain` POST or PUT, the body of the request as a string 
  * `pathParams`: arguments from dynamic path parameter mappings (such as '/people/{name}')
  * `lambdaContext`: (since `1.3.0`) the [Lambda Context object](http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html) for the active request
  * `context`: a key-value map of elements from the API Gateway context, see the [$context variable](http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html#context-variable-reference) documentation for more info on individual fields 
     * `method`: HTTP invocation method
     * `path`: the active resource path (will include generic path components, eg /people/{name})
     * `stage` : API Gateway stage 
     * `sourceIp`: Source IP 
     * `accountId`: identity account ID
     * `user` : user identity from the context
     * `userAgent` : user agent from the API Gateway context
     * `userArn` : user ARN from the API Gateway context
     * `caller` : caller identity
     * `apiKey`: API key used for the call
     * `authorizerPrincipalId`
     * `cognitoAuthenticationProvider`
     * `cognitoAuthenticationType` 
     * `cognitoIdentityId`
     * `cognitoIdentityPoolId`


### Responding to requests

You can either respond synchronously (just return a value, as above), or respond with a `Promise`. In that case, the lambda function will wait until the 
`Promise` resolves or rejects before responding. API Builder just checks for the `.then` method, so it should work with any A+ Promise library. 

### Customising response codes and content types

By default, Claudia.js uses 500 as the HTTP response code for all errors, and 200 for successful operations. The `application/json` content type is default for both successes and failures. You can change all that by using the optional third argument to handler definition methods. All keys are optional, and the structure is:

  * `error`: a number or a key-value map. If a number is specified, it will be used as the HTTP response code. If a key-value map is specified, it should have the following keys:
    * `code`: HTTP response code
    * `contentType`: the content type of the response
    * `headers`: a key-value map of hard-coded header values, or an array enumerating custom header names. See [Custom headers](#custom-headers) below for more information
  * `success`: a number or a key-value map. If a number is specified, it will be used as the HTTP response code. If a key-value map is specified, it should have the following keys:
    * `code`: HTTP response code
    * `contentType`: the content type of the response
    * `headers`: a key-value map of hard-coded header values, or an array enumerating custom header names. See [Custom headers](#custom-headers) below for more information
  * `apiKeyRequired`: boolean, determines if a valid API key is required to call this method. See [Requiring Api Keys](#requiring-api-keys) below for more information

For example:

```javascript
api.get('/greet', function (request) {
	return request.queryString.name + ' is ' + superb();
}, {
  success: { contentType: 'text/plain' }, 
  error: {code: 403}
});

```

These special rules apply to content types and codes:

  * When the error content type is `text/plain` or `text/html`, only the error message is sent back in the body, not the entire error structure.
  * When the error content type is `application/json`, the entire error structure is sent back with the response.
  * When the response type is `application/json`, the response is JSON-encoded. So if you just send back a string, it will have quotes around it.
  * When the response type is `text/plain`, `text/xml`, `text/html` or `application/xml`, the response is sent back without JSON encoding (so no extra quotes). 
  * In case of 3xx response codes for success, the response goes into the `Location` header, so you can easily create HTTP redirects.

To see these options in action, see the  [Serving HTML Example project](https://github.com/claudiajs/example-projects/tree/master/web-serving-html).

### Requiring API Keys

You can force a method to require an API key by using an optional third argument to handler definition methods, and setting the `apiKeyRequired` property on it. For example:

```javascript
api.get('/echo', function (request) { ... }, {apiKeyRequired: true});
```

See [How to Use an API Key in API Gateway](http://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-api-keys.html) for more information on creating and using API keys.

### Custom headers

Claudia API Builder provides limited support for custom HTTP headers. AWS API Gateway requires all custom headers to be enumerated upfront, and you can use the `success.headers` and `error.headers` keys of your handler configuration for that. There are two options for enumerating headers:

1. Hard-code header values in the configuration (useful for ending sessions in case of errors, redirecting to a well-known location after log-outs etc). To do this, list headers as key-value pairs. For example: 
  ```javascript
  api.get('/hard-coded-headers', function () {
  	return 'OK';
  }, {success: {headers: {'X-Version': '101', 'Content-Type': 'text/plain'}}});
  ```

2. Dynamically assign header values from your API code. To do this, evaluate header names as an array, then return an instance of `ApiResponse(contents, headers)` from your handler method. For example:
  ```javascript
  api.get('/programmatic-headers', function () {
	  return new api.ApiResponse('OK', {'X-Version': '202', 'Content-Type': 'text/plain'});
  }, {success: {headers: ['X-Version', 'Content-Type']}});

  ```

Due to the limitations with Lambda error processing, the `error.headers` key can only be hard-coded. Dynamic values for error handlers are not supported.

To see custom headers in action, see the [Custom Headers Example Project](https://github.com/claudiajs/example-projects/blob/master/web-api-custom-headers/web.js).

### Controlling Cross-Origin Resource Sharing headers

Claudia API builder automatically sets up the API to allow cross-origin resource sharing (CORS). The most common usage scenario for API Gateway projects is to provide dynamic functions to Web sites served on a different domain, so CORS is necessary to support that use case. To simplify things, by default, APIs allow calls from any domain. 

If you plan to proxy both the main web site and the APIs through a CDN and put them under a single domain, or if you want to restrict access to your APIs, you can override the default behaviour for CORS handling. 

To completely prevent CORS access, use:

```javascript
api.corsOrigin(false)
```

To hard-code the CORS origin to a particular domain, call the `corsOrigin` function with a string, representing the target origin:

```javascript
api.corsOrigin('https://www.claudiajs.com')
```

To dynamically choose an origin (for example to support different configurations for development and production use, or to allow multiple sub-domains to access your API), call pass a JavaScript function into `corsOrigin`. Your function will receive the request object (filled with stage variables and the requesting headers) and should return a string with the contents of the origin header. This has to be a synchronous function (promises are not supported).

```javascript
api.corsOrigin(function (request) {
	if (/claudiajs.com$/.test(request.headers.Origin)) {
		return request.headers.Origin;
	}
	return '';
});
```

If your API endpoints use HTTP headers as parameters, you may need to allow additional headers in `Access-Control-Allow-Headers`. To do so, just call the `corsHeaders` method on the API, and pass a string with the `Allow-Header` value. 

```javascript
api.corsHeaders('Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Api-Version');
```

To see this in action, see the [Custom CORS Example Project](https://github.com/claudiajs/example-projects/blob/master/web-api-custom-cors/web.js). For more information on CORS, see the [MDN CORS page](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS).

### Adding post-deploy steps

If you need to configure the API automatically (for example set up stage variables, execute calls to third parties to set up webhooks and so on), add a post-deploy step to your API. The syntax is:

```javascript
api.addPostDeployStep(stepName, function (commandLineOptions, lambdaProperties, utils) {} )
```

* `stepName`: `string` &ndash; a unique post-deploy step name, that will be used to report results. 
* `commandLineOptions`: `object` &ndash; key-value pairs of options passed to Claudia from the command line. Use this to detect, for example, if the user required re-configuring the API, or to pass parameters to the configuration function from the command line
* `lambdaProperties`: `object` &ndash; contains the following keys
  * `name`: `string` &ndash; the lambda function name
  * `alias`: `string` &ndash; the active lambda version alias. Use this as the stage name if you want to configure stage variables
  * `apiId`: `string` &ndash; the API Gateway API ID
  * `apiUrl`: `string` &ndash; the root URL of the API, accessible from the web
  * `region`: `string` &ndash; the AWS Region where the Lambda and API are deployed
* `utils`: `object` &ndash; key-value hash containing utility objects that you can use to simplify common tasks without introducing additional dependencies to your API project
  * `Promise`: the A+ Promise implementation used by Claudia 
  * `aws`: the AWS SDK object, initialised with the login details of the current user (note that the JavaScript API does not initialise the Region property by default, so you may need to pass that to an individual service when you use it).
  * `apiGatewayPromise`: a promisified version of the ApiGateway SDK (so instead of `createDeployment` that requires a callback, you can use `createDeploymentPromise` that returns a `Promise`). This object also takes care of AWS rate limits and automatically retries in case of `TooManyRequests` exceptions, so if you want to execute API gateway configuration calls from the post-deploy step, it's generally better to use this object instead of creating your own service instance. 

The post-deploy step method can return a string or an object, or a Promise returning a string or an object. If it returns a Promise, the deployment will pause until the Promise resolves. In case of multiple post-deployment steps, they get executed in sequence, not concurrently. Any values returned from the method, or resolved by the Promise, will be included in the final installation report presented to the users. So you can take advantage of this, for example, to provide configuration information for third-party components that users need to set up manually.

Too see this in action, see the [Post-deploy](https://github.com/claudiajs/example-projects/tree/master/web-api-postdeploy) example project.
