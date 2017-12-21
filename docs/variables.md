## Configuring the API

AWS Lambda and API Gateway have two methods of storing typical environment configuration:

* Stage variables exist in the API gateway, separate for each stage (such as `dev` or `test`), and are added to each request as it passes through from a client to Lambda
* Lambda environment variables exist in the Lambda process container, and they are configured for a numerical deployment (so if two labels such as `dev` and `prod` point to the same numerical deployment, they share the same environment variables).

See the [Managing Lambda Versions](https://claudiajs.com/tutorials/versions.html) tutorial for an in-depth comparison of the two types of variables.

When using Claudia API Builder, the `request.env` object contains by default only the stage variables, which are specific to the request. You can read the Lambda environment variables from `process.env`. To make it easier to use Lambda environment variables as well, you can use the `mergeVars` option (since `claudia-api-builder` 2.5.1) of the API Builder and get everything in `request.env`.

```javascript
api = new ApiBuilder({mergeVars: true});
api.post('/upload', function (request) {
  // request.env now contains both stage and process.env vars
}
```

The following rules apply when merging:

* If the same key exists both in Lambda environment variables and Stage variables, stage variable wins (so you can override global config with stage-specific values)
* Any process.env variables that start with a prefix of the stage name with an underscore are copied into the key without that prefix, so you can easily keep different environment variables for testing and production and Api Builder will load the correct ones.

For example, if you've set the following variables on Lambda: 

```bash
dev_DB_NAME=dev-db
dev_LOG_LEVEL=INFO
prod_DB_NAME=prod-db
APP_NAME=Lovely App
MESSAGE_PREFIX=LA_1
```

and the following variables in the `dev` stage:

```bash
LOG_LEVEL=debug
APP_NAME=Lovely Debug
```

Without `{mergeVars:true}`, the handlers will get just LOG_LEVEL and APP_NAME in `request.env`, directly from stage variables. With `{mergeVars:true}`, the `request.env` object for the `dev` stage will look like this:

```bash
DB_NAME=dev-db # from process.env, because it had a dev_ prefix
APP_NAME=Lovely Debug # stage var win over non-prefixed lambda vars
LOG_LEVEL=debug # stage vars win over prefixed lambda env vars
MESSAGE_PREFIX=LA_1 # env var, no prefixed version to override it
```

## Configuring stage variables using post-deployment steps 

If your API depends on configuration in stage variables, you can automate the configuration process during deployment. Claudia will then enable users to configure the variable value either from the command line, or by prompting interactively during deployment. The syntax is:

```javascript
api.addPostDeployConfig(stageVarName, prompt, configOption);
```

* `stageVarName`: `string` &ndash; the name of the stage variable you want to configure. To stay safe, use alphanumeric characters only, API Gateway does not allow special characters in variable names
* `prompt`: `string` &ndash; the text to display when prompting the users to interactively enter the variable
* `configOption`: `string` &ndash; the name of the command-line option that will be used as a flag for the configuration process. 


If the configuration option is provided as a string, the value is automatically sent to AWS for the current stage without prompting. If the configuration option is provided without value, API Builder will ask the users to interactively enter it. Here's an example:

```javascript
api.addPostDeployConfig('message', 'Enter a message:', 'custom-message');
```

In this case, `message` is the name of the stage variable (it will be available as `request.env.message` later). `Enter a message:` is the prompt that the users will see during deployment, and `custom-message` is the configuration option required to trigger the step. When an API contains that line, you can make Claudia ask you to define the stage variable by running

```bash
claudia update --custom-message
```

Likewise, you can provide the value directly in the command line for unattended operation

```bash
claudia update --custom-message Ping
```

To see this in action, see the [Post-deploy configuration](https://github.com/claudiajs/example-projects/tree/master/web-api-postdeploy-configuration) example project.

Note that the sequence of post-deployment steps is not guaranteed. Create isolated steps, don't assume any particular order between them.




