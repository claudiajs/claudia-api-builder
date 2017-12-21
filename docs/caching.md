# Controlling API Gateway caching parameters

To use API Gateway caching, API endpoints need to declare parameters. Since `claudia 2.1.2`, dynamic path parameters (eg from API endpoints `/person/{name}`) are set automatically. You can also use query string and header parameters to control caching, but you'll need to set them explicitly.

Use the `requestParameters` configuration key, and provide a key-value hash object. For keys, either use the full API Gateway parameter location mapping (for example `method.request.querystring.name`) or create sub-objects `querystring` and `header` with just the parameter names inside. The values should be `true` or `false`, and indicate whether a parameter is required (`true`) or optional (`false`). For more information, check out [Request and Response Data Mappings](http://docs.aws.amazon.com/apigateway/latest/developerguide/request-response-data-mappings.html) from the API Gateway guide.

```javascript
// set query string and header params using fully qualified names
api.get('/test', function () { // handler }, 
  { 
    requestParameters: { 
      'method.request.querystring.name' : true, 
      'method.request.header.x-123': true 
      } 
  });

// set query string and header params using object notation
api.get('/test', function () {}, 
  {
    requestParameters: { 
      querystring: { name : false }, 
      header: {'x-123': true} 
    } 
  })

// no need to set path params, done automatically
api.get('/some/{path}/param', function () { } ); 

// add specific header/query string to automatically created path params 
api.get('/some/{path}/param', function () { },  
  {
    requestParameters: { 
      querystring: { name : false }, 
      header: {'x-123': true} 
    } 
  });
```

