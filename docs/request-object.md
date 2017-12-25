# The API Builder Request Object

Claudia will automatically bundle all the parameters and pass it to your handler, so you do not have to define request and response models or worry about query strings and body parsing.

```javascript
var ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder();
api.get('/', function (request) {

});
```

Note that the Claudia Request Object differs from the API Gateway Proxy request, although they have similar properties. The reasons are historic - we created the API Builder project before API Gateway had the support for proxy requests, and we kept using the legacy structure by default for backwards compatibility. For greenfield projects, you can also [use the API Gateway proxy object directly](api-gateway-proxy-request.md).

The `request` object passed to your handler contains the following properties:

* `queryString`: a key-value map of query string arguments
* `env`: a key-value map of the API Gateway stage variables, optionally merged with Lambda environment variables (see [Environment Variables](#environment-variables))
* `headers`: a key-value map of all the HTTP headers posted by the client (header names have the same case as in the request)
* `normalizedHeaders`:  a key-value map of all the HTTP headers posted by the client (header names are lowercased for easier processing)
* `post`: in case of a FORM post (`application/x-www-form-urlencoded`), a key-value map of the values posted
* `body`: in case of an `application/json`, the body of the request, parsed as a JSON object; in case of `application/xml` or `text/plain` POST or PUT, the body of the request as a string. In case of binary content, a `Buffer`.
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


