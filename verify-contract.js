// Verifies every GET endpoint against openapi.yaml, field by field, and writes
// the results to VERIFICATION.md.
//
// For each request it checks, straight from the contract file:
//   the status code is the one the contract declares for that case
//   every field in the response has the exact name the contract promised
//   every field has the right type (string, number, object, array)
//   there are no extra fields the contract does not mention
//   there are no missing fields
//   responses the contract gives no body (400, 404, 426) really have no body
//
// Run with: npm run verify

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const WebSocket = require('ws');
const { createServer } = require('../src/app');
const db = require('../src/db');

const ROOT = path.join(__dirname, '..');
const contract = YAML.parse(fs.readFileSync(path.join(ROOT, 'openapi.yaml'), 'utf8'));

// Contract helpers

function resolve(schema) {
  while (schema && schema.$ref) {
    schema = schema.$ref.replace('#/', '').split('/').reduce((node, key) => node[key], contract);
  }
  return schema;
}

function declaredResponse(pathTemplate, status) {
  const op = contract.paths[pathTemplate] && contract.paths[pathTemplate].get;
  return op && op.responses ? op.responses[String(status)] || null : null;
}

function schemaCheck(value, schema, where, problems) {
  schema = resolve(schema);
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return problems.push(`${where} should be an array`);
    value.forEach((item, i) => schemaCheck(item, schema.items, `${where}[${i}]`, problems));
  } else if (schema.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return problems.push(`${where} should be an object`);
    }
    const props = schema.properties || {};
    for (const key of Object.keys(props)) {
      if (!(key in value)) problems.push(`${where}.${key} is missing`);
      else schemaCheck(value[key], props[key], `${where}.${key}`, problems);
    }
    for (const key of Object.keys(value)) {
      if (!(key in props)) problems.push(`${where}.${key} is not in the contract`);
    }
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') problems.push(`${where} should be a string, got ${typeof value}`);
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) problems.push(`${where} should be a number, got ${typeof value}`);
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value)) problems.push(`${where} should be an integer`);
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') problems.push(`${where} should be a boolean, got ${typeof value}`);
  }
}

// HTTP checks

async function checkHttp(base, c) {
  const res = await fetch(base + c.url, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  const problems = [];
  const declared = declaredResponse(c.path, res.status);
  let body = null;

  if (res.status !== c.expect) problems.push(`status ${res.status}, expected ${c.expect}`);
  if (!declared) problems.push(`status ${res.status} is not declared in the contract for this endpoint`);

  const schema = declared && declared.content && declared.content['application/json']
    ? declared.content['application/json'].schema : null;
  if (schema) {
    if (!(res.headers.get('content-type') || '').includes('application/json')) {
      problems.push('Content-Type is not application/json');
    }
    try {
      body = JSON.parse(text);
      schemaCheck(body, schema, 'response', problems);
      if (c.also) c.also(body, problems);
    } catch (err) {
      problems.push('response body is not valid JSON');
    }
  } else if (declared && text.length > 0) {
    problems.push('the contract gives this response no body, but a body was sent');
  }
  return { ...c, status: res.status, body, problems };
}

// WebSocket checks

function nextMessage(ws, ms = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no message within 3 seconds')), ms);
    ws.once('message', (data) => { clearTimeout(timer); resolve(JSON.parse(data.toString())); });
  });
}

async function checkWsSubscribe(wsBase, c) {
  const problems = [];
  const schema = contract.components.schemas.ApplicationStatus;
  const messages = [];
  let status = null;
  const ws = new WebSocket(wsBase + c.url);
  ws.on('upgrade', (res) => { status = res.statusCode; });
  const first = nextMessage(ws);
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });

  if (status !== 101) problems.push(`handshake status ${status}, expected 101`);
  if (!declaredResponse(c.path, 101)) problems.push('101 is not declared in the contract');

  const onConnect = await first;
  messages.push(onConnect);
  schemaCheck(onConnect, schema, 'message on connect', problems);
  const current = db.findApplicationById('app_1001').application_status;
  if (onConnect.status !== current) problems.push(`first message status "${onConnect.status}", expected "${current}"`);

  // Change the status inside the server and confirm the push arrives.
  const pushed = nextMessage(ws);
  db.setApplicationStatus('app_1001', 'approved');
  const update = await pushed;
  messages.push(update);
  schemaCheck(update, schema, 'pushed message', problems);
  if (update.status !== 'approved') problems.push(`pushed status "${update.status}", expected "approved"`);
  db.setApplicationStatus('app_1001', current); // put the sample data back
  ws.close();
  return { ...c, status, body: messages, problems };
}

async function checkWsRefused(wsBase, c) {
  const problems = [];
  const status = await new Promise((resolve) => {
    const ws = new WebSocket(wsBase + c.url);
    ws.on('unexpected-response', (req, res) => { resolve(res.statusCode); req.destroy(); });
    ws.on('open', () => { resolve(101); ws.close(); });
    ws.on('error', () => resolve(null));
  });
  if (status !== c.expect) problems.push(`handshake status ${status}, expected ${c.expect}`);
  if (!declaredResponse(c.path, status)) problems.push(`status ${status} is not declared in the contract`);
  return { ...c, status, body: null, problems };
}

// The cases

const allMatch = (field, value) => (list, problems) => {
  list.filter((job) => String(job[field]).toLowerCase() !== value)
      .forEach((job) => problems.push(`${job.id} has ${field} "${job[field]}", filter asked for "${value}"`));
};

const cases = [
  { ep: 1, kind: 'http', path: '/api/jobs', url: '/api/jobs?status=active', expect: 200, what: 'active jobs', also: allMatch('status', 'active') },
  { ep: 1, kind: 'http', path: '/api/jobs', url: '/api/jobs', expect: 400, what: 'status missing' },
  { ep: 2, kind: 'http', path: '/api/jobs/search', url: '/api/jobs/search?county=Nairobi&category=accommodation&status=active', expect: 200, what: 'matching jobs',
    also: (list, p) => { allMatch('county', 'nairobi')(list, p); allMatch('category', 'accommodation')(list, p); allMatch('status', 'active')(list, p); } },
  { ep: 2, kind: 'http', path: '/api/jobs/search', url: '/api/jobs/search?county=Turkana&category=accommodation&status=active', expect: 200, what: 'no matches, empty list',
    also: (list, p) => { if (list.length !== 0) p.push('expected an empty list'); } },
  { ep: 2, kind: 'http', path: '/api/jobs/search', url: '/api/jobs/search?county=Nairobi&category=accommodation&statuts=active', expect: 400, what: 'old misspelt parameter' },
  { ep: 3, kind: 'http', path: '/api/jobs/{jobId}', url: '/api/jobs/job_12345', expect: 200, what: 'job exists',
    also: (job, p) => { if (job.id !== 'job_12345') p.push('returned the wrong job'); } },
  { ep: 3, kind: 'http', path: '/api/jobs/{jobId}', url: '/api/jobs/job_99999', expect: 404, what: 'job not found' },
  { ep: 4, kind: 'http', path: '/api/applications/{applicationId}/status', url: '/api/applications/app_1001/status', expect: 200, what: 'application exists',
    also: (a, p) => { if (a.applicationId !== 'app_1001') p.push('returned the wrong application'); } },
  { ep: 4, kind: 'http', path: '/api/applications/{applicationId}/status', url: '/api/applications/app_9999/status', expect: 404, what: 'application not found' },
  { ep: 5, kind: 'ws', path: '/api/applications/{applicationId}/subscribe', url: '/api/applications/app_1001/subscribe', expect: 101, what: 'subscribe, get status, receive a push' },
  { ep: 5, kind: 'wsRefused', path: '/api/applications/{applicationId}/subscribe', url: '/api/applications/app_9999/subscribe', expect: 404, what: 'application not found' },
  { ep: 5, kind: 'http', path: '/api/applications/{applicationId}/subscribe', url: '/api/applications/app_1001/subscribe', expect: 426, what: 'plain HTTP instead of WebSocket' },
];

// Report

function sample(body) {
  if (body === null || body === undefined) return '(no body)';
  if (Array.isArray(body) && body.length > 1 && body[0] && body[0].id) {
    return `${body.length} items. First item:\n${JSON.stringify(body[0], null, 2)}`;
  }
  return JSON.stringify(body, null, 2);
}

function writeReport(results) {
  const ok = (r) => r.problems.length === 0;
  const passed = results.filter(ok).length;
  const lines = [];
  lines.push('# Contract Verification, Week 5', '');
  lines.push(`Generated by \`npm run verify\` on ${new Date().toISOString()}.`);
  lines.push('Every request below was sent to the running server and its real response was checked against `openapi.yaml` field by field.', '');
  lines.push(`**Result: ${passed} of ${results.length} checks passed.**`, '');
  lines.push('| Endpoint | Request | Case | Contract expects | Got | Result |', '|---|---|---|---|---|---|');
  for (const r of results) {
    const method = r.kind === 'http' ? 'GET' : 'WS';
    lines.push(`| ${r.ep} | \`${method} ${r.url}\` | ${r.what} | ${r.expect} | ${r.status} | ${ok(r) ? 'Pass' : 'FAIL'} |`);
  }
  lines.push('', '## Checklist per endpoint', '');
  lines.push('| Endpoint | Exact field names | Correct types | No extra fields | No missing fields | Correct status codes |', '|---|---|---|---|---|---|');
  for (const ep of [1, 2, 3, 4, 5]) {
    const probs = results.filter((r) => r.ep === ep).flatMap((r) => r.problems);
    const mark = (re) => (probs.some((p) => re.test(p)) ? 'No' : 'Yes');
    lines.push(`| ${ep} | ${mark(/not in the contract|is missing/)} | ${mark(/should be/)} | ${mark(/not in the contract/)} | ${mark(/is missing/)} | ${mark(/status/)} |`);
  }
  lines.push('', '## Details', '');
  for (const r of results) {
    lines.push(`### Endpoint ${r.ep}: ${r.what}`, '', `Request: \`${r.kind === 'http' ? 'GET' : 'WebSocket'} ${r.url}\``, `Status: expected ${r.expect}, got ${r.status}`);
    lines.push(ok(r) ? 'Problems: none' : `Problems:\n${r.problems.map((p) => `* ${p}`).join('\n')}`);
    lines.push('', '```json', sample(r.body), '```', '');
  }
  lines.push('Endpoint 5 is a WebSocket, which Swagger UI cannot open, so it is verified here with a WebSocket client. Endpoints 1 to 4 can also be checked by hand in Swagger UI at http://localhost:3000/docs with Try it out; screenshots of those runs are in the evidence folder.');
  fs.writeFileSync(path.join(ROOT, 'VERIFICATION.md'), lines.join('\n') + '\n');
  return passed;
}

async function main() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = `http://localhost:${port}`;
  const wsBase = `ws://localhost:${port}`;

  const results = [];
  for (const c of cases) {
    let r;
    try {
      if (c.kind === 'http') r = await checkHttp(base, c);
      else if (c.kind === 'ws') r = await checkWsSubscribe(wsBase, c);
      else r = await checkWsRefused(wsBase, c);
    } catch (err) {
      r = { ...c, status: null, body: null, problems: [`request failed: ${err.message}`] };
    }
    results.push(r);
    console.log(`${r.problems.length ? 'FAIL' : 'pass'}  Endpoint ${r.ep}  ${r.what.padEnd(38)} expected ${r.expect}, got ${r.status}`);
    r.problems.forEach((p) => console.log(`        ${p}`));
  }

  const passed = writeReport(results);
  console.log(`\n${passed} of ${results.length} checks passed. Full report written to VERIFICATION.md`);
  server.close();
  process.exit(passed === results.length ? 0 : 1);
}

main();
