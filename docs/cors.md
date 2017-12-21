# Controlling Cross-Origin Resource Sharing headers

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
