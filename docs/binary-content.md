# Binary content handling

_since `claudia-api-builder 2.4.0`, `claudia 2.6.0`._

API Gateway has basic support for binary data handling, by converting incoming binary data into base64 strings, and decoding outgoing base64 strings into binary content. Claudia API Builder allows you to configure and manage those transformations:

* use `api.setBinaryMediaTypes(array)` to configure MIME types your API wants to treat as binary. By default, common image types, application/pdf and application/octet-stream are treated as binary. 
* use `requestContentHandling` in the handler configuration to set the required incoming binary content handling behaviour (API Gateway Integration content handling). Valid values are `'CONVERT_TO_BINARY'` and `'CONVERT_TO_TEXT'`
* use `success.contentHandling` in the handler configuration to set the required response content handling behaviour (API Gateway Integration Response content handling). Valid values are `'CONVERT_TO_BINARY'` and `'CONVERT_TO_TEXT'`. Remember to set the `success.contentType` to the appropriate binary content type as well. 

```javascript
api.setBinaryMediaTypes(['image/gif']); 

api.post('/thumb', (request) => {
  //...
}, { 
  requestContentHandling: 'CONVERT_TO_TEXT', 
  success: { 
    contentType: 'image/png', 
    contentHandling: 'CONVERT_TO_BINARY' 
  } 
});
```

Claudia API Builder makes it easier to process binary content, by automatically encoding and decoding `Buffer` objects. Return a `Buffer` (eg the result of `fs.readFile`) from an endpoint handler, and Claudia will automatically convert it into a base64 string. If the incoming request is base64 encoded, Claudia API Builder will decode it for you, and set `request.body` to a `Buffer` with the decoded content.

Check out the [Handling Binary Content Tutorial](https://claudiajs.com/tutorials/binary-content.html) and the [Binary Content Example Project](https://github.com/claudiajs/example-projects/tree/master/binary-content).
