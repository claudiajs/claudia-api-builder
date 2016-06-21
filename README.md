#Claudia API Builder

<img src="https://claudiajs.github.io/claudiajs.com/assets/claudiajs.svg" height="300" align="right" />

Claudia API Builder makes it possible to use AWS API Gateway as if it was a lightweight JavaScript web server, so it helps developers get started easily and reduces the learning curve required to launch web APIs in AWS. 

The API Builder helps you by:

  * setting up AWS API Gateway Web interfaces for Lambda projects easily, the way JavaScript developers expect out of the box
  * routing multiple AWS API Gateway end-points to a single Lambda function, so that you can develop and deploy an entire API simpler and avoid inconsistencies.
  * handling synchronous responses or asynchronous promises, so you can develop easier
  * configuring response content types and HTTP codes easily
  * enabling you to set-up post-install configuration steps, so that you can set up the deployments easier

The API builder is designed to work with [Claudia](https://github.com/claudiajs), and add minimal overhead to client projects. 

## Simple example

```javascript
var ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder(),
	superb = require('superb');

module.exports = api;

api.get('/greet', function (request) {
	return request.queryString.name + ' is ' + superb();
});
```

For a more examples, see the [Web API Example Projects](https://github.com/claudiajs/example-projects#web-api)

## Getting started

* Check out the [Getting Started](docs/getting_started.md) guide for a basic Hello-World style example
* Check out the [API Documentation](docs/api.md) for a detailed guide on handling requests, customising responses and configuring your API

## Questions, suggestions? 
[![Join the chat at https://gitter.im/claudiajs/claudia](https://badges.gitter.im/claudiajs/claudia.svg)](https://gitter.im/claudiajs/claudia?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)


## License

MIT
