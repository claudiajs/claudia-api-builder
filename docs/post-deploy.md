# Adding generic post-deploy steps

If you need to configure the API automatically (for example execute calls to third parties to set up webhooks and so on), add a post-deploy step to your API. The syntax is:

```javascript
api.addPostDeployStep(stepName, function (commandLineOptions, lambdaProperties, utils) {} )
```

* `stepName`: `string` &ndash; a unique post-deploy step name, that will be used to report results. 
* `commandLineOptions`: `object` &ndash; key-value pairs of options passed to Claudia from the command line. Use this to detect, for example, if the user required re-configuring the API, or to pass parameters to the configuration function from the command line
* `lambdaProperties`: `object` &ndash; contains the following keys
  * `name`: `string` &ndash; the lambda function name
  * `alias`: `string` &ndash; the active lambda version alias. Use this as the stage name if you want to configure stage variables
  * `apiId`: `string` &ndash; the API Gateway API ID
  * `apiUrl`: `string` &ndash; the root URL of the API, accessible from the web
  * `region`: `string` &ndash; the AWS Region where the Lambda and API are deployed
* `utils`: `object` &ndash; key-value hash containing utility objects that you can use to simplify common tasks without introducing additional dependencies to your API project
  * `Promise`: the A+ Promise implementation used by Claudia 
  * `aws`: the AWS SDK object, initialised with the login details of the current user (note that the JavaScript API does not initialise the Region property by default, so you may need to pass that to an individual service when you use it).
  * `apiGatewayPromise`: a promisified version of the ApiGateway SDK (so instead of `createDeployment` that requires a callback, you can use `createDeploymentPromise` that returns a `Promise`). This object also takes care of AWS rate limits and automatically retries in case of `TooManyRequests` exceptions, so if you want to execute API gateway configuration calls from the post-deploy step, it's generally better to use this object instead of creating your own service instance. 

The post-deploy step method can return a string or an object, or a Promise returning a string or an object. If it returns a Promise, the deployment will pause until the Promise resolves. In case of multiple post-deployment steps, they get executed in sequence, not concurrently. Any values returned from the method, or resolved by the Promise, will be included in the final installation report presented to the users. So you can take advantage of this, for example, to provide configuration information for third-party components that users need to set up manually.

Note that the sequence of post-deployment steps is not guaranteed. Create isolated steps, don't assume any particular order between them.

To see this in action, see the [Post-deploy](https://github.com/claudiajs/example-projects/tree/master/web-api-postdeploy) example project.

