### Using the API Gateway Proxy Request Object 

As an alternative to the Claudia API Builder request, you can also use the [API Gateway Proxy Request](http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html#api-gateway-simple-proxy-for-lambda-input-format) object directly. To do that, pass the `AWS_PROXY` format as the `requestFormat` option to the constructor when instantiating the API builder.

```javascript
var ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder({requestFormat: 'AWS_PROXY'});

api.get('/', request => {
  // request is now the raw API Gateway proxy object 
  // not the API Builder replacement
});
```

