const express = require('express');
const db = require('../db');
const { toApplicationStatus } = require('../mappers');

const router = express.Router();

// ENDPOINT 4: GET /api/applications/{applicationId}/status
router.get('/:applicationId/status', (req, res) => {
  const row = db.findApplicationById(req.params.applicationId);
  if (!row) return res.status(404).end();
  res.status(200).json(toApplicationStatus(row));
});

// ENDPOINT 5 over plain HTTP (for example from Swagger UI's Try it out).
// Real WebSocket connections never reach this handler: they are taken over
// by the upgrade handler in src/realtime.js.
router.get('/:applicationId/subscribe', (req, res) => {
  const row = db.findApplicationById(req.params.applicationId);
  if (!row) return res.status(404).end();
  res.status(426).set('Upgrade', 'websocket').end();
});

// Endpoints 6, 7 and 8 (POST, PUT, DELETE) are writes and are built in Week 6.

module.exports = router;
