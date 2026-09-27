# Contract Deviations, Week 5

Changes made to `openapi.yaml` this week (version 1.0.0 to 1.0.1), what changed, and why the original did not hold up. Every change that affects a client has been flagged to my downstream ring partner.

## GET endpoints

**Endpoint 1, `GET /api/jobs`**
Added a 400 response for when the required `status` query parameter is missing. The original marked it as required but did not say what happens when it is left out.

**Endpoint 2, `GET /api/jobs/search`**
1. Query parameter `statuts` renamed to `status`. It was a typo, and Endpoint 1 already uses `status` for the same filter. Clients still sending `statuts` get a 400.
2. Added a 400 response for when `county`, `category` or `status` is missing, for the same reason as Endpoint 1.
3. Example category spelled `accommodation` instead of `accomodation`, to match the stored data.

**Endpoint 3, `GET /api/jobs/{jobId}`**
No change in behaviour. The 404 response was indented wrongly, so it was not attached to the endpoint. It now is.

**Endpoint 4, `GET /api/applications/{applicationId}/status`**
1. Defined the 200 response body as `ApplicationStatus`: `{ "applicationId": string, "status": string }`. The original promised a response containing the status but gave no shape, so there was nothing to verify against.
2. Added a 404 response for an unknown `applicationId`.
3. Path placeholder `{applicatrionId}` corrected to `{applicationId}` to match the declared parameter. The URL clients call is unchanged.

**Endpoint 5, `GET /api/applications/{applicationId}/subscribe` (WebSocket)**
1. Success changed from 200 to 101 Switching Protocols, because a successful WebSocket handshake always answers 101, never 200.
2. Added 404 for an unknown `applicationId`, and 426 Upgrade Required for a plain HTTP request such as Swagger UI's Try it out.
3. Defined the message format: every message is an `ApplicationStatus` object, sent once on connect and again every time the status changes.
4. Same placeholder fix as Endpoint 4.

Swagger UI cannot open WebSockets, so Endpoint 5 is verified with a WebSocket client (`npm run verify`) instead of Try it out.

## Other changes to the file

1. Endpoint 6, `/api/applications`, changed from GET to POST. It creates an application, and a GET must never change data. It is no longer part of this week's GET scope and will be built in Week 6.
2. Endpoint 8 merged into Endpoint 7's path as a `delete` operation, with the same placeholder fix. The original path text `/api/applications/{applicatrionId} (DELETE)` is not a valid path. The URLs and methods clients use are unchanged, and Endpoints 7 and 8 are otherwise untouched until Week 6.
3. Made the file valid so Swagger UI can load it. The original failed to parse. Added `openapi`, `info`, `paths` and a `servers` entry for `http://localhost:3000`; renamed `response` to `responses` on every endpoint (OpenAPI only reads the plural); moved `components` to the end, because it had cut Endpoints 4 to 8 out of `paths`; fixed indentation and spelling in summaries.
