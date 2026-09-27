# SettleIn API, Week 5: GET endpoints

Every GET endpoint in `openapi.yaml` is implemented in Node.js with Express and verified against the contract field by field.

## Run it

On Windows, the shortcut is to double click **start_lab.bat**. It installs the packages, runs the contract check, starts the server and opens Swagger UI for you.

Or by hand. You need Node.js 18 or newer.

```
npm install
npm start
```

Then open **http://localhost:3000/docs** for Swagger UI. Pick an endpoint, click **Try it out**, then **Execute**.

## Verify it against the contract

```
npm run verify
```

This starts the server, calls every GET endpoint (success, not found and missing parameter cases), and checks each real response against `openapi.yaml`: exact field names, types, no extra fields, no missing fields, and the status code. The results are written to `VERIFICATION.md`. Screenshots of Try it out in Swagger UI are in the `evidence` folder.

## Endpoints built this week

| # | Request | Success | Other cases |
|---|---|---|---|
| 1 | `GET /api/jobs?status=active` | 200, list of Job | 400 if status is missing |
| 2 | `GET /api/jobs/search?county=Nairobi&category=accommodation&status=active` | 200, list of Job | 400 if any parameter is missing |
| 3 | `GET /api/jobs/{jobId}` | 200, one Job | 404 if the job does not exist |
| 4 | `GET /api/applications/{applicationId}/status` | 200, ApplicationStatus | 404 if the application does not exist |
| 5 | WebSocket `/api/applications/{applicationId}/subscribe` | 101, then status messages | 404 if unknown, 426 for plain HTTP |

Endpoints 6, 7 and 8 (POST, PUT, DELETE) are writes and are built in Week 6.

Sample IDs to try: jobs `job_12345` to `job_12352`, applications `app_1001` to `app_1004`.

## Testing the WebSocket (Endpoint 5)

Swagger UI cannot open WebSockets. With the server running, open http://localhost:3000/docs, press F12, go to the Console tab and paste:

```js
const ws = new WebSocket('ws://localhost:3000/api/applications/app_1001/subscribe');
ws.onmessage = (e) => console.log(e.data);
```

You will see the current status straight away, for example `{"applicationId":"app_1001","status":"pending"}`. A new message arrives whenever the status changes; `npm run verify` tests that push automatically.

## Where the contract is enforced

`src/db.js` holds sample rows shaped like real database rows: `_id`, snake_case names, decimals as strings, and internal columns. `src/mappers.js` is the mapping step that turns each row into the exact shape in `openapi.yaml`. Every response goes through it, so database names, string numbers and internal columns never leak into the API.

```
openapi.yaml               the contract
CONTRACT_DEVIATIONS.md     every change made to the contract this week, and why
VERIFICATION.md            results of npm run verify
evidence/                  Swagger UI Try it out screenshots
src/server.js              starts the server on port 3000
src/app.js                 Express app, Swagger UI at /docs, routes
src/routes/jobs.js         Endpoints 1, 2 and 3
src/routes/applications.js Endpoint 4, and Endpoint 5 over plain HTTP
src/realtime.js            Endpoint 5 WebSocket
src/mappers.js             database row to contract shape
src/db.js                  sample data
scripts/verify-contract.js the contract checker
```
