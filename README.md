# medusa-plugin-culqi-card

Medusa plugin for processing credit card payments using Culqi.

## Environment Variables

>NOTE: Options are provided as environment variables.

| Environment Variable     | Description                                                                                                                             | Required | Example    |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|----------|------------|
| CULQI_SECRET_KEY         | Culqi Secret Key                                                                                                                        | Yes      |            |
| CULQI_CAPTURE            | Whether or not to capture the payment immediately                                                                                       |          | `true`     |
| CULQI_DEV_EMAIL          | Email to use for test environment when processing payment                                                                               |          |            |
| CULQI_APP_ENV            | App Environment. It will be appended to customer's email address to avoid conflicts in LLE environments using the same Culqi Secret Key |          | `staging`  |
| CULQI_LOG_CULQI_REQUESTS | Whether or not to log requests to Culqi                                                                                                 |          | `true`     |

## Usage

```js
const plugins = [
  // ...
  'medusa-plugin-culqi-card',
]
```

## Culqi Request Logging

When `process.env.CULQI_LOG_CULQI_REQUESTS` is set to `true`, the plugin will log all requests to Culqi to the `culqi_log` table. This is useful for debugging purposes.

If Culqi requests logging is enabled, run migrations to create the `culqi_log` table:

```bash
yarn build
```

```bash
medusa migrations run
```
