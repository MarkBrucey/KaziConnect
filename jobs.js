const express = require('express');
const db = require('../db');
const { toJob } = require('../mappers');

const router = express.Router();

// Returns the required query parameters, or null if any is missing or blank.
function requiredQuery(req, names) {
  const values = {};
  for (const name of names) {
    const value = req.query[name];
    if (typeof value !== 'string' || value.trim() === '') return null;
    values[name] = value.trim();
  }
  return values;
}

// ENDPOINT 1: GET /api/jobs?status=active
router.get('/', (req, res) => {
  const q = requiredQuery(req, ['status']);
  if (!q) return res.status(400).end();
  res.status(200).json(db.findJobs({ status: q.status }).map(toJob));
});

// ENDPOINT 2: GET /api/jobs/search?county=Nairobi&category=accommodation&status=active
// Declared before /:jobId so that "search" is never mistaken for a job ID.
router.get('/search', (req, res) => {
  const q = requiredQuery(req, ['county', 'category', 'status']);
  if (!q) return res.status(400).end();
  res.status(200).json(db.findJobs(q).map(toJob));
});

// ENDPOINT 3: GET /api/jobs/{jobId}
router.get('/:jobId', (req, res) => {
  const row = db.findJobById(req.params.jobId);
  if (!row) return res.status(404).end();
  res.status(200).json(toJob(row));
});

module.exports = router;
