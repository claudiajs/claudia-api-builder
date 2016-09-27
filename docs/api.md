# API definition syntax

> this is the API documentation for version 2.x. If you are looking for older (1.x) versions, check out [version 1.x API documentation](https://github.com/claudiajs/claudia-api-builder/blob/4f5c30df0365812765806ae2f9fd97e7a1287ed9/docs/api.md)

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

## The Request Object

Claudia will automatically bundle all the parameters and pass it to your handler, so you do not have to define request and response models. The `request` object passed to your handler contains the following properties:

* `queryString`: a key-value map of query string arguments
* `env`: a key-value map of the API Gateway stage variables (useful for storing resource identifiers and access keys)
* `headers`: a key-value map of all the HTTP headers posted by the client (header names have the same case as in the request)
* `normalizedHeaders`:  a key-value map of all the HTTP headers posted by the client (header names are lowercased for easier processing)
* `post`: in case of a FORM post (`application/x-form-www-urlencoded`), a key-value map of the values posted
* `body`: in case of an `application/json`, the body of the request, parsed as a JSON object; in case of `application/xml` or `text/plain` POST or PUT, the body of the request as a string 
* `rawBody`: the unparsed body of the request as a string
* `pathParams`: arguments from dynamic path parameter mappings (such as '/people/{name}')
* `lambdaContext`: the [Lambda Context object](http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html) for the active request
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

### Using the API Gateway Proxy Request Object 

As an alternative to the Claudia API Builder request, you can also use the [API Gateway Proxy Request](http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html#api-gateway-simple-proxy-for-lambda-input-format) object directly. To do that, pass the `AWS_PROXY` format to the constructor when instantiating an api builder.

```javascript
var ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder('AWS_PROXY');

```

## Responding to requests

You can either respond synchronously (just return a value, as above), or respond with a `Promise`. In that case, the lambda function will wait until the 
`Promise` resolves or rejects before responding. API Builder just checks for the `.then` method, so it should work with any A+ Promise library. 

To implement a custom termination workflow, use the [`request.lambdaContext`](http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html) object, and return a `Promise` that never gets resolved.

### Customising response codes and content types

By default, Claudia.js uses 500 as the HTTP response code for all errors, and 200 for successful operations. The `application/json` content type is default for both successes and failures. You can change all that by using the optional third argument to handler definition methods, or by responding with an instance of an `ApiResponse` class. 

#### Static configuration

You can provide static configuration to a handler, by setting the third argument of the method. All the keys are optional, and the structure is:

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

#### Dynamic responses

Reply with an instance of `api.ApiResponse` to dynamically set headers and the response code. 

```javascript
new ApiResponse(body, headers, httpCode)
```

* `body`: string &ndash; the body of the response
* `header`: object &ndash; key-value map of header names to header values, all strings
* `httpCode`: numeric response code. Defaults to 200 for successful responses and 500 for errors.

Here's an example:

```javascript
api.get('/programmatic-headers', function () {
  return new api.ApiResponse('OK', {'X-Version': '202', 'Content-Type': 'text/plain'}, 204);
});

```

#### Custom headers


You can Hard-code header values in the configuration (useful for ending sessions in case of errors, redirecting to a well-known location after log-outs etc),  use the `success.headers` and `error.headers` keys. To do this, list headers as key-value pairs. For example: 

  ```javascript
  api.get('/hard-coded-headers', function () {
  	return 'OK';
  }, {success: {headers: {'X-Version': '101', 'Content-Type': 'text/plain'}}});
  ```

You can also dynamically assign header values from your API code. Return an instance of `ApiResponse(contents, headers, httpCode)` from your handler method. For example:

```javascript
api.get('/programmatic-headers', function () {
  return new api.ApiResponse('OK', {'X-Version': '202', 'Content-Type': 'text/plain'});
}, {success: {headers: ['X-Version', 'Content-Type']}});

```

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

To dynamically choose an origin (for example to support different configurations for development and production use, or to allow multiple sub-domains to access your API), pass a JavaScript function into `corsOrigin`. Your function will receive the request object (filled with stage variables and the requesting headers) and should return a string with the contents of the origin header. This has to be a synchronous function (promises are not supported).

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

## Configuring the API

There are two common ways for passing configuration variables to your API:

* Store configuration into AWS API Gateway Stage Variables. This is a good option for alphanumeric keys and short configuration items. Different Lambda versions (development, testing, production) will automatically get the correct values through the `request.env` object.
* Store configuration into a file deployed with the function, and then detect which file to load by using `request.context.stage`.

### Configuring stage variables using post-deployment steps 

_since 1.4.0_

If your API depends on configuration in stage variables, you can automate the configuration process during deployment. Claudia will then enable users to configure the variable value either from the command line, or by prompting interactively during deployment. The syntax is:

```javascript
api.addPostDeployConfig(stageVarName, prompt, configOption);
```

* `stageVarName`: `string` &ndash; the name of the stage variable you want to configure. To stay safe, use alphanumeric characters only, API Gateway does not allow special characters in variable names
* `prompt`: `string` &ndash; the text to display when prompting the users to interactively enter the variable
* `configOption`: `string` &ndash; the name of the command-line option that will be used as a flag for the configuration process. 


If the configuration option is provided as a string, the value is automatically sent to AWS for the current stage without prompting. If the configuration option is provided without value, API Builder will ask the users to interactively enter it. Here's an example:

```javascript
api.addPostDeployConfig('message', 'Enter a message:', 'custom-message');
```

In this case, `message` is the name of the stage variable (it will be available as `request.env.message` later). `Enter a message:` is the prompt that the users will see during deployment, and `custom-message` is the configuration option required to trigger the step. When an API contains that line, you can make Claudia ask you to define the stage variable by running

```bash
claudia update --custom-message
```

Likewise, you can provide the value directly in the command line for unattended operation

```bash
claudia update --custom-message Ping
```

To see this in action, see the [Post-deploy configuration](https://github.com/claudiajs/example-projects/tree/master/web-api-postdeploy-configuration) example project.

Note that the sequence of post-deployment steps is not guaranteed. Create isolated steps, don't assume any particular order between them.

### Adding generic post-deploy steps

If you need to configure the API automatically (for example execute calls to third parties to set up webhooks and so on), add a post-deploy step to your API. The syntax is:

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

Note that the sequence of post-deployment steps is not guaranteed. Create isolated steps, don't assume any particular order between them.

To see this in action, see the [Post-deploy](https://github.com/claudiajs/example-projects/tree/master/web-api-postdeploy) example project.

### Requiring API Keys

You can force a method to require an API key by using an optional third argument to handler definition methods, and setting the `apiKeyRequired` property on it. For example:

```javascript
api.get('/echo', function (request) { ... }, {apiKeyRequired: true});
```

See [How to Use an API Key in API Gateway](http://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-api-keys.html) for more information on creating and using API keys.

### Require Authorization

_since claudia 1.4.5_

APIs by default do not require user level authorization, to enable browsers to call them. API Gateway also allows you to set fine-grained permissions based on IAM policies. To do that, configure the request processor by adding an `authorizationType` field, with the value of `AWS_IAM` &ndash; here's an example:

```javascript
api.get('/hello', function (request) {...}, {authorizationType: 'AWS_IAM'} );
```

See the [Permissions Documentation Page](http://docs.aws.amazon.com/apigateway/latest/developerguide/permissions.html) of the API Gateway developer guide for information on how to set up user policies for authorization.

### Overriding executing credentials

_since claudia 1.5.0_ 

By default, API Gateway requests will execute under the credentials of the user who created them. You can make the API execute under the credentials of a particular user/IAM role, or pass the caller credentials to the underlying Lambda function by setting the `invokeWithCredentials` flag. Set it to a IAM ARN to use a particular set of credentials, or to `true` to pass caller credentials. If you use this flag, the `authorizationType` is automatically set to `AWS_IAM`, so you don't need to specify it separately. 

```javascript
// use caller credentials
api.get('/hello', function (request) {...}, {invokeWithCredentials: true} );
// use specific credentials
api.get('/hello', function (request) {...}, {invokeWithCredentials: 'arn:aws:iam::123456789012:role/apigAwsProxyRole'} );
```

### Using custom authorizers

_since: claudia-api-builder 1.6.0, claudia 1.7.1_

You can set up a [custom authorizer](http://docs.aws.amazon.com/apigateway/latest/developerguide/use-custom-authorizer.html) with your API by registering the authorizer using `api.registerAuthorizer`, and then referencing the authorizer by name in the `customAuthorizer` flag of the request handler options. You can register the authorizer in several ways:

```javascript
api.registerAuthorizer(name, options);
```

* `name`: `string` &ndash; the name for this authorizer
* `option`: `object` &ndash; a key-value map containing the following properties
 * `lambdaName` &ndash; the name of a Lambda function for the authorizer. Mandatory unless `lambdaArn` is provided.
 * `lambdaArn` &ndash; full ARN of a Lambda function for the authorizer. Useful to wire up authorizers in third-party AWS accounts. If used, don't specify `lambdaName` or `lambdaVersion`.
 * `lambdaVersion` &ndash; _optional_. Additional qualifier for the Lambda authorizer execution. Can be a string version alias, a numerical version or `true`. if `true`, the API will pass the current stage name as the qualifier. This allows you to use different versions of the authorizer for different versions of the API, for example for testing and production. If not defined, the latest version of the Lambda authorizer will be used for all stages of the API.
 * `headerName`: `string` &ndash; _optional_ the header name that contains the authentication token. If not specified, Claudia will use the `Authorization` header
 * `validationExpression`: `string` &ndash; _optional_ a regular expression to validate authentication tokens
 * `credentials`: `string` &ndash; _optional_ an IAM role ARN for the credentials used to invoke the authorizer
 * `resultTtl`: `int` &ndash; _optional_ period (in seconds) API gateway is allowed to cache policies returned by the custom authorizer


Here are a few examples:

```javascript
// use always the latest version of a Lambda in the same AWS account, 
// authenticate with the Authorization header
api.registerAuthorizer('companyAuth', { lambdaName: 'companyAuthLambda' })

// use always the latest version of a Lambda in the same AWS account, 
// authenticate with the UserToken header
api.registerAuthorizer('companyAuth', { lambdaName: 'companyAuthLambda', headerName: 'UserToken' })

// use the authorizer version corresponding to the API stage 
api.registerAuthorizer('companyAuth', { lambdaName: 'companyAuthLambda', lambdaVersion: true })

// use a hard-coded lambda version for all stages
api.registerAuthorizer('companyAuth', { lambdaName: 'companyAuthLambda', lambdaVersion: '12' })

// use a third-party authorizer with an ARN and a specific header
api.registerAuthorizer('companyAuth', { lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:MagicAuth', headerName: 'MagicAuth' })
``` 

When the authorizer is specified using `lambdaName`, Claudia will automatically assign the correct access privileges so that your API can call the authorizer. When the authorizer is specified using `lambdaArn`, you need to ensure the right privileges exist between the API and the third-party authorizer Lambda function.

Note that `request.context.authorizerPrincipalId` will contain the principal ID passed by the custom authorizer automatically.

Check out the [Custom Authorizers Example](https://github.com/claudiajs/example-projects/tree/master/custom-authorizers) to see this in action.

## Intercepting requests

API builder allows you to intercept requests and filter or modify them before proceeding with the normal routing process. To do that, call the `intercept` method

```javascript
api.intercept(function (event) { ... });
```

The following rules apply for intercepting requests:

* stop without executing the request, but don't cause an error: return a falsy value, or a promise resolving to a falsy value
* stop without executing the request, but with an error: throw an exception, or return a promise that rejects
* execute the original request: return the original event, or a promise resolving with the original event
* execute a modified request: return the modified event, or a promise resolving with the modified event

Check out the [Intercepting Requests Example](https://github.com/claudiajs/example-projects/tree/master/intercepting-requests) to see this in action.


