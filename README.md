#Claudia API Builder

<img src="https://claudiajs.github.io/claudiajs.com/assets/claudiajs.svg" height="300" align="right" />

Claudia API Builder simplifies setting up AWS API Gateway Web interfaces for Lambda projects:
  * process multiple AWS API Gateway calls from a single Lambda function in Node.js, so that you can develop and deploy an entire API simpler and avoid inconsistencies.
  * work with synchronous responses or asynchronous promises, so you can develop easier
  * configure response content types and HTTP codes easily
  * add post-install configuration steps so that you can set up the deployments easier

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
