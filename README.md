#Claudia API Builder

This utility simplifies Node.js Lambda - API Gateway handling. 
  * can process multiple AWS API Gateway calls from a single Lambda function in Node.js, so that  
    you can develop and deploy an entire API simpler and avoid inconsistencies.
  * can work with synchronous responses or promises, so you can develop easier
  * any exceptions or promise rejections are automatically reported to Lambda as errors
  * any synchronous responses or promise resolutions are automatically reported to Lambda as results
    

The API builder is designed to work with [Claudia](https://github.com/claudiajs), but you can also use it stand-alone,
by passing an event that contains `{context: {route: 'HTTP_ROUTE', method: 'HTTP_METHOD' }`
