# Claudia API Builder

[![npm](https://img.shields.io/npm/v/claudia-api-builder.svg?maxAge=2592000?style=plastic)](https://www.npmjs.com/package/claudia-api-builder)
[![npm](https://img.shields.io/npm/dt/claudia-api-builder.svg?maxAge=2592000?style=plastic)](https://www.npmjs.com/package/claudia-api-builder)
[![npm](https://img.shields.io/npm/l/claudia-api-builder.svg?maxAge=2592000?style=plastic)](https://github.com/claudiajs/claudia-api-builder/blob/master/LICENSE)
[![Build Status](https://travis-ci.org/claudiajs/claudia-api-builder.svg?branch=master)](https://travis-ci.org/claudiajs/claudia-api-builder)
[![Join the chat at https://gitter.im/claudiajs/claudia](https://badges.gitter.im/claudiajs/claudia.svg)](https://gitter.im/claudiajs/claudia?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Claudia API Builder makes it possible to use AWS API Gateway as if it were a lightweight JavaScript web server, so it helps developers get started easily and reduces the learning curve required to launch web APIs in AWS. [Check out this video to see how to create and deploy an API in under 5 minutes](https://vimeo.com/156232471).

[![Claudia.js Introduction Video](https://claudiajs.com/assets/claudia-intro-video.png)](https://vimeo.com/156232471)

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
	return request.queryString.name + ' is ' + superb.random();
});
```

For a more examples, see the [Web API Example Projects](https://github.com/claudiajs/example-projects#web-api)

## Getting started

* Check out the [Getting Started](https://claudiajs.com/tutorials/hello-world-api-gateway.html) guide for a basic Hello-World style example
* Check out the [API Documentation](docs/api.md) for a detailed guide on handling requests, customising responses and configuring your API

## Questions, suggestions? 
[![Join the chat at https://gitter.im/claudiajs/claudia](https://badges.gitter.im/claudiajs/claudia.svg)](https://gitter.im/claudiajs/claudia?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)


## License

[MIT](LICENSE)
