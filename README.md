# medusa-plugin-culqi-card

Medusa plugin for processing credit card payments using Culqi.

## Options

| Option             | Description                                                                                                                             | Required | Example    |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------------|----------|------------|
| secret_key         | Culqi Secret Key                                                                                                                        | Yes      |            |
| capture            | Whether or not to capture the payment immediately                                                                                       |          | `true`     |
| dev_email          | Email to use for test environment when processing payment                                                                               |          |            |
| app_env            | App Environment. It will be appended to customer's email address to avoid conflicts in LLE environments using the same Culqi Secret Key |          | `staging`  |
| log_culqi_requests | Whether or not to log requests to Culqi                                                                                                 |          | `true`     |

## Usage

```js
const plugins = [
  // ...
  {
    resolve: `medusa-plugin-culqi-card`,
    options: {
      secret_key: process.env.CULQI_SECRET_KEY,
      dev_email: 'my_email@email.com',
      log_culqi_requests: true,
    },
  },
]
```

## Culqi Request Logging

When `log_culqi_requests` is set to `true`, the plugin will log all requests to Culqi to the `culqi_log` table. This is useful for debugging purposes.

>Note: A `culqi_log` table will be created in the database irrespective of the value of `log_culqi_requests`. However, this table will only be used if `log_culqi_requests` is set to `true`.
