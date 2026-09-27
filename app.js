const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const jobsRouter = require('./routes/jobs');
const applicationsRouter = require('./routes/applications');
const { attachRealtime } = require('./realtime');

const CONTRACT_PATH = path.join(__dirname, '..', 'openapi.yaml');

function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false); // always send a real 200, never a cached 304

  // Allows Swagger Editor (editor.swagger.io) to call this local server as well.
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    next();
  });

  // Swagger UI, built straight from the contract file.
  const contract = YAML.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(contract));
  app.get('/openapi.yaml', (req, res) => res.sendFile(CONTRACT_PATH));
  app.get('/', (req, res) => res.redirect('/docs'));

  app.use('/api/jobs', jobsRouter);
  app.use('/api/applications', applicationsRouter);

  // Anything else: 404 with no body.
  app.use((req, res) => res.status(404).end());

  const server = http.createServer(app);
  attachRealtime(server);
  return server;
}

module.exports = { createServer };
