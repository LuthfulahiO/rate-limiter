## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

PS: `.env` file was commited into this repo on purpose for evaluation only. 

To run with a local DB simply create a postgres DB with your database manager of choice or run `createdb rate_limiter` and update the env variables as required, run `yarn start` to spin up the application and synchronize table needed, then hit the post endpoint to create a sample client as specified below, also make sure you have a local redis server running.

PS: It is best to use a local DB and redis instance for running e2e test to avoid timeout.

## Test

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e
```

## Testing the Rate Limiter

A sample client has be created with this structure 

```
{
  clientId: 1
  limitPerSecond: 2
  limitPerMonth: 5
}
```

You can make a POST request `curl --request POST -H "x-client-id: 1" http://localhost:3000/notifications` to see the limit in action, after 5 request this client should get the too many request response.

Also all other scenarios for rate limiting has been covered in the e2e test running that should give a full insight to how the limiting works.

To test with more client (to cover more scenerios) I have created a simple POST endpoint for create a client having this as the body of the request

```
curl --location --request POST 'http://localhost:3000/client' \
--header 'Content-Type: application/json' \
--data-raw '{
    "clientId": 4,
    "limitPerSecond": 10,
    "limitPerMonth": 20
}'
```
