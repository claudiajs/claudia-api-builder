# Setting up Authorization for the API 

API Gateway supports several methods of authorization. 

* [API Keys](#require-api-keys), useful for authorising 3rd party client developers
* [IAM Authorization](#iam-authorization), useful for a small number of managed client apps
* [Cognito Authorization](#cognito-authorization), useful for a large number of self-service Internet users
* [Custom Authorizers](#custom-authorizers), when you want to be fully in control

## Require API Keys

You can force a method to require an API key by using an optional third argument to handler definition methods, and setting the `apiKeyRequired` property on it. For example:

```javascript
api.get('/echo', function (request) { ... }, {apiKeyRequired: true});
```

See [How to Use an API Key in API Gateway](http://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-api-keys.html) for more information on creating and using API keys.

## IAM Authorization

APIs by default do not require user level authorization, to enable browsers to call them. API Gateway also allows you to set fine-grained permissions based on IAM policies. To do that, configure the request processor by adding an `authorizationType` field, with the value of `AWS_IAM` &ndash; here's an example:

```javascript
api.get('/hello', function (request) {...}, {authorizationType: 'AWS_IAM'} );
```

See the [Permissions Documentation Page](http://docs.aws.amazon.com/apigateway/latest/developerguide/permissions.html) of the API Gateway developer guide for information on how to set up user policies for authorization.

### Overriding executing credentials

By default, API Gateway requests will execute under the credentials of the user who created them. You can make the API execute under the credentials of a particular user/IAM role, or pass the caller credentials to the underlying Lambda function by setting the `invokeWithCredentials` flag. Set it to a IAM ARN to use a particular set of credentials, or to `true` to pass caller credentials. If you use this flag, the `authorizationType` is automatically set to `AWS_IAM`, so you don't need to specify it separately. 

```javascript
// use caller credentials
api.get('/hello', function (request) {...}, {invokeWithCredentials: true} );
// use specific credentials
api.get('/hello', function (request) {...}, {invokeWithCredentials: 'arn:aws:iam::123456789012:role/apigAwsProxyRole'} );
```

## Cognito authorization

_since claudia 2.9.0_

You can also set up an API end-point to use a [Cognito Authorizer](http://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html). Register the authorizer similar to custom authorizers, but specify `providerARNs` instead of a lambda name or lambda ARN, then provide `cognitoAuthorizer` in the endpoint options. You can use all the other options for custom authorizers (such as `validationExpression` and `headerName`).

```javascript
api.registerAuthorizer('MyCognitoAuth', {
    providerARNs: ['<COGNITO POOL ARN>']
});

api.post('/lockedMessages', request => {
  return doSomethingUseful(request);
}, { cognitoAuthorizer: 'MyCognitoAuth' })
```


## Custom authorizers

You can set up a [custom authorizer](http://docs.aws.amazon.com/apigateway/latest/developerguide/use-custom-authorizer.html) with your API by registering the authorizer using `api.registerAuthorizer`, and then referencing the authorizer by name in the `customAuthorizer` flag of the request handler options. 

Request Based authorizers are supported since `Claudia 3.1.0`.

You can register the authorizer in several ways:

```javascript
api.registerAuthorizer(name, options);
```

* `name`: `string` &ndash; the name for this authorizer
* `options`: `object` &ndash; a key-value map containing the following properties
  * `lambdaName` &ndash; the name of a Lambda function for the authorizer. Mandatory unless `lambdaArn` is provided.
  * `lambdaArn` &ndash; full ARN of a Lambda function for the authorizer. Useful to wire up authorizers in third-party AWS accounts. If used, don't specify `lambdaName` or `lambdaVersion`.
  * `lambdaVersion` &ndash; _optional_. Additional qualifier for the Lambda authorizer execution. Can be a string version alias, a numerical version or `true`. if `true`, the API will pass the current stage name as the qualifier. This allows you to use different versions of the authorizer for different versions of the API, for example for testing and production. If not defined, the latest version of the Lambda authorizer will be used for all stages of the API.
  * `headerName`: `string` &ndash; _optional_ the header name that contains the authentication token. If not specified, Claudia will use the `Authorization` header
  * `identitySource`: `string` &ndash; _optional_ a list of identity sources for the authorizer. Useful if you want to specify the full identity source expression from the [Create Authorizer](https://docs.aws.amazon.com/cli/latest/reference/apigateway/create-authorizer.html) API. If not specified, the `headerName` argument is applied.
  * `validationExpression`: `string` &ndash; _optional_ a regular expression to validate authentication tokens
  * `credentials`: `string` &ndash; _optional_ an IAM role ARN for the credentials used to invoke the authorizer
  * `resultTtl`: `int` &ndash; _optional_ period (in seconds) API gateway is allowed to cache policies returned by the custom authorizer
  * `type`: `string` &ndash; _optional_ the API Gateway custom authorizer type. It can be `REQUEST`, `TOKEN` or `COGNITO_USER_POOLS`. By default, if `providerARNs` are specified, it sets the authorizer as Cognito user pools. Otherwise, the Token authorization is used. You have to specify this argument to use `REQUEST` authorizers.


Here are a few examples:

```javascript
// use always the latest version of a Lambda in the same AWS account, 
// authenticate with the Authorization header
api.registerAuthorizer('companyAuth', { lambdaName: 'companyAuthLambda' })

// use always the latest version of a Lambda in the same AWS account, 
// authenticate with the UserToken header
api.registerAuthorizer('companyAuth', { lambdaName: 'companyAuthLambda', headerName: 'UserToken' })

// use the authorizer version corresponding to the API stage 
api.registerAuthorizer('companyAuth', { lambdaName: 'companyAuthLambda', lambdaVersion: true })

// use a hard-coded lambda version for all stages
api.registerAuthorizer('companyAuth', { lambdaName: 'companyAuthLambda', lambdaVersion: '12' })

// use a third-party authorizer with an ARN and a specific header
api.registerAuthorizer('companyAuth', { lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:MagicAuth', headerName: 'MagicAuth' })

// use a custom request-based authorizer
api.registerAuthorizer('companyAuth', { 
  lambdaName: 'companyAuthLambda', 
  type: 'REQUEST', 
  identitySource: 'method.request.header.Auth, method.request.querystring.Name' 
})
``` 

After you register the authorizer, turn in on by providing a `customAuthorizer` field in the endpoint configuration.

```javascript
api.get('/unlocked', function (request) {
	return 'OK for ' + request.context.authorizerPrincipalId;
}, { customAuthorizer: 'companyAuth' });
```

When the authorizer is specified using `lambdaName`, Claudia will automatically assign the correct access privileges so that your API can call the authorizer. When the authorizer is specified using `lambdaArn`, you need to ensure the right privileges exist between the API and the third-party authorizer Lambda function.

Note that `request.context.authorizerPrincipalId` will contain the principal ID passed by the custom authorizer automatically.

Check out the [Custom Authorizers Example](https://github.com/claudiajs/example-projects/tree/master/custom-authorizers) to see this in action.


