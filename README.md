#Claudia API Builder

This utility simplifies Node.js Lambda - API Gateway handling. 
  * can process multiple AWS API Gateway calls from a single Lambda function in Node.js, so that  
    you can develop and deploy an entire API simpler and avoid inconsistencies.
  * can work with synchronous responses or promises, so you can develop easier
  * any exceptions or promise rejections are automatically reported to Lambda as errors
  * any synchronous responses or promise resolutions are automatically reported to Lambda as results

The API builder is designed to work with [Claudia](https://github.com/claudiajs), and add minimal overhead to client projects. 

## API definition syntax

An instance of the Claudia API Builder should be used as the module export from your API module. You can create a new API simply
by instantiating a new `ApiBuilder`, then defining HTTP handlers for paths by calling `.get`, `.put`, and `.post`. For example, the following 
snippet creates a single handler for a `GET` call to `/greet`, responding with a parameterised message:

````
var ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder(),
	superb = require('superb');

module.exports = api;

api.get('/greet', function (request) {
	'use strict';
	return request.queryString.name + ' is ' + superb();
});
````

For a more detailed example, see the [Web API Example project](https://github.com/claudiajs/example-projects/tree/master/web-api).

### The Request Object

Claudia will automatically bundle all the parameters and pass it to your handler, so you do not have to define request and response models. The `request` object passed to your handler contains the following properties:

  * `queryString`: a key-value map of query string arguments
  * `env`: a key-value map of the API Gateway stage variables (useful for storing resource identifiers and access keys)
  * `headers`: a key-value map of all the HTTP headers posted by the client
  * `post`: in case of a FORM post (`application/x-form-www-urlencoded`), a key-value map of the values posted
  * `body`: in case of an `application/json` POST or PUT, the body of the request, parsed as a JSON object

### Responding to requests

You can either respond synchronously (just return a value, as above), or respond with a `Promise`. In that case, the lambda function will wait until the 
`Promise` resolves or rejects before responding. Please note that AWS currently uses Node.js 0.10.36, which does not include the standard `Promise` library,
so you need to include a third party one. API Builder just checks for the `.then` method, so it should work with any A+ Promise library.
