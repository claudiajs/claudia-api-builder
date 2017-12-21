# Intercepting requests

API builder allows you to intercept requests and filter or modify them before proceeding with the normal routing process. To do that, call the `intercept` method

```javascript
api.intercept(function (event) { ... });
```

The following rules apply for intercepting requests:

* stop without executing the request, override response: return an `ApiResponse` object (with full CORS headers if needed)
* stop without executing the request, but don't cause an error: return a falsy value, or a promise resolving to a falsy value
* stop without executing the request, but with an error: throw an exception, or return a promise that rejects
* execute the original request: return the original event, or a promise resolving with the original event
* execute a modified request: return the modified event, or a promise resolving with the modified event

Check out the [Intercepting Requests Example](https://github.com/claudiajs/example-projects/tree/master/intercepting-requests) to see this in action.



