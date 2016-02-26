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

````
var ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder(),
	superb = require('superb');

module.exports = api;

api.get('/greet', function (request) {
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
  * `pathParams`: arguments from dynamic path parameter mappings (such as '/people/{name}')

### Responding to requests

You can either respond synchronously (just return a value, as above), or respond with a `Promise`. In that case, the lambda function will wait until the 
`Promise` resolves or rejects before responding. Please note that AWS currently uses Node.js 0.10.36, which does not include the standard `Promise` library,
so you need to include a third party one. API Builder just checks for the `.then` method, so it should work with any A+ Promise library.

### Customising response codes and content types

By default, Claudia.js uses 500 as the HTTP response code for all errors, and 200 for successful operations. The `application/json` content type is default for both successes and failures. You can change all that by using the optional third argument to handler definition methods. All keys are optional, and the structure is:

  * `error`: a number or a key-value map. If a number is specified, it will be used as the HTTP response code. If a key-value map is specified, it should have the following keys:
    * `code`: HTTP response code
    * `contentType`: the content type of the response
  * `success`: a number or a key-value map. If a number is specified, it will be used as the HTTP response code. If a key-value map is specified, it should have the following keys:
    * `code`: HTTP response code
    * `contentType`: the content type of the response

These special rules apply to content types and codes:

  * When the error content type is `text/plain` or `text/html`, only the error message is sent back in the body, not the entire error structure.
  * When the error content type is `application/json`, the entire error structure is sent back with the response.
  * When the response type is `application/json`, the response is JSON-encoded. So if you just send back a string, it will have quotes around it.
  * When the response type is `text/plain`, `text/xml`, `text/html` or `application/xml`, the response is sent back without JSON encoding (so no extra quotes). 
  * In case of 3xx response codes for success, the response goes into the `Location` header, so you can easily create HTTP redirects.

To see these options in action, see the  [Serving HTML Example project](https://github.com/claudiajs/example-projects/tree/master/web-serving-html).
