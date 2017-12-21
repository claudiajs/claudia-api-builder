# How to customise responses (HTTP codes, headers, content types)

By default, Claudia.js uses 500 as the HTTP response code for all errors, and 200 for successful operations. The `application/json` content type is default for both successes and failures. You can change all that by using the optional third argument to handler definition methods, or by responding with an instance of an `ApiResponse` class. 

## Static configuration

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

## Dynamic responses

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

## Custom headers


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

## Controlling Cross-Origin Resource Sharing headers

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

The browser performs a pre-flight OPTIONS call before each _real_ call (GET, POST, ...), this takes a lot of time, if the browser has to do it every time.
And you get also charged for AWS API Gateway and Lambda! 
To avoid this, you can define a `max-age` and the browser will cache the OPTIONS call for this duration.
Default: disabled

```javascript
api.corsMaxAge(60); // in seconds 
```

To see this in action, see the [Custom CORS Example Project](https://github.com/claudiajs/example-projects/blob/master/web-api-custom-cors/web.js). For more information on CORS, see the [MDN CORS page](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS).

## Custom Gateway Responses

_since claudia-api-builder 2.6, claudia 2.15_

API Gateway supports customising error responses generated by the gateway itself, without any interaction with your Lambda. This is useful if you want to provide additional headers with an error response, or if you want to change the default behaviour for unmatched paths, for example.

To define a custom API Response, use the `setGatewayResponse` method. The syntax is:

```javascript
api.setGatewayResponse(responseType, responseConfig)
```

* `responseType`: `string` &ndash; one of the supported [API Gateway Response Types](http://docs.aws.amazon.com/apigateway/api-reference/resource/gateway-response/).
* `config`: `object` &ndash; the API Gateway Response Configuration, containing optionally `statusCode`, `responseParameters` and `responseTemplates`. Check the [API Gateway Response Types](http://docs.aws.amazon.com/apigateway/api-reference/resource/gateway-response/) for more information on those parameters.


Here's an example:

```javascript
api.setGatewayResponse('DEFAULT_4XX', {
  responseParameters: {
    'gatewayresponse.header.x-response-claudia': '\'yes\'',
    'gatewayresponse.header.x-name': 'method.request.header.name',
    'gatewayresponse.header.Access-Control-Allow-Origin': '\'a.b.c\'',
    'gatewayresponse.header.Content-Type': '\'application/json\''
  },
  statusCode: 411,
  responseTemplates: {
    'application/json': '{"custom": true, "message":$context.error.messageString}'
  }
});
```

In addition to the standard parameters supported by API Gateway directly, Claudia API Builder also provides a shortcut for setting headers. Use the key `headers`, and a map `string` to `string` of header names to values.


```javascript
api.setGatewayResponse('DEFAULT_4XX', {
  statusCode: 411,
  headers: {
    'x-response-claudia': 'yes',
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'a.b.c'
    }
  }
);

```

