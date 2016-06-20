# Getting Started with Claudia Api Builder

This is a quick introduction to creating a hello-world style project with Claudia API Builder, and deploying it to AWS Lambda and API Gateway.

## Prerequisites

* Node.js 4.3.2
* NPM
* AWS account with access to IAM, Lambda and API Gateway

### Setting up the AWS credentials

Claudia.js (and the bot builder extension) just uses the standard AWS Node.js SDK, so if you have that configured, there is no additional configuration required. See [Configuring Access Credentials](https://github.com/claudiajs/claudia/blob/master/getting_started.md#configuring-access-credentials) in the Claudia.js getting started guide for more information.

## Initialising the project

Create a directory, and initialise a new NPM project, for example, using `npm init`. (If you create the `package.json` by hand instead, make sure to give it a name.) 

Add the Claudia API Builder as a project dependency:

```bash
npm install claudia-api-builder --save
```

Finally, install Claudia.js in your global path:

```bash
npm install -g claudia
```

## Creating a web endpoint

Next, create `app.js` with the following code:

```javascript
var ApiBuilder = require('claudia-api-builder'),
  api = new ApiBuilder();
module.exports = api;

api.get('/hello', function () {
  return 'hello world';
});
```

## Deploying to AWS 

You can now send your new microservice to the AWS cloud. Run the following command:

```bash
claudia create --region us-east-1 --api-module app
```

In a few moments, Claudia will respond with the details of the new Lambda function and REST API, looking similar to the one below:

```bash
{
  "lambda": {
    "role": "test-executor",
    "name": "test",
    "region": "us-east-1"
  },
  "api": {
    "id": "8x7uh8ho5k",
    "module": "app",
    "url": "https://8x7uh8ho5k.execute-api.us-east-1.amazonaws.com/latest"
  }
}
```

The result will contain the root URL of your new API. We created an endpoint for `/hello`, so just add `/hello` to the URL, and try it out in a browser or from the console. For example, execute:

```bash
curl https://8x7uh8ho5k.execute-api.us-east-1.amazonaws.com/latest/hello
```

You should see the 'hello world' response -- and your first Lambda is now live in the cloud!

In the background, Claudia.js created a copy of the project, packaged all the NPM dependencies, tested that the API is deployable, zipped everything up and sent it to Lambda, created the correct IAM access privileges, configured an API with the `/hello` endpoint, linked it to the new Lambda function and installed the correct transformation templates. 

## Updating the deployment

Claudia also saved the resulting configuration into a local file (`claudia.json`), so that you can easily update the function without remembering any of those details. Try this next:

Install the `superb` module as a project dependency:

```bash
npm install superb --save
```

Add a new endpoint to the API by appending these lines to your `api.js`:

```javascript
api.get('/greet', function (request) {
  var superb = require('superb');
  return request.queryString.name + ' is ' + superb();
});
```

You can send the new version of your API to AWS simply by running the following command: 

```bash 
claudia update
``` 

When the deployment completes, try out the new endpoint by adding `/greet?name=' followed by your name. You'll get a nice confidence boost. 

```bash
$ curl https://8x7uh8ho5k.execute-api.us-east-1.amazonaws.com/latest/greet?name=Mike
"Mike is fantastic"
```

## More information

Check out the [API docs](api.md)
