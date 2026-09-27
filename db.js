// Sample data standing in for the database.
//
// The rows are deliberately shaped the way a real database usually hands data
// back, NOT the way openapi.yaml promises it: snake_case column names, an _id
// key, decimal columns that arrive as strings, and internal columns that must
// never leave the server. src/mappers.js is the step that turns these rows into
// the exact shapes in the contract.

const { EventEmitter } = require('events');

const jobs = [
  { _id: 'job_12345', job_title: 'Campus Housing Assistant', job_category: 'accommodation', county_name: 'Nairobi', listing_status: 'active', pay_min: '15000.00', pay_max: '22000.00', created_by: 'admin_3', internal_notes: 'Verified landlord partner' },
  { _id: 'job_12346', job_title: 'Hostel Front Desk Attendant', job_category: 'accommodation', county_name: 'Nairobi', listing_status: 'active', pay_min: '12000.00', pay_max: '18000.00', created_by: 'admin_1', internal_notes: '' },
  { _id: 'job_12347', job_title: 'Student Residence Cleaner', job_category: 'accommodation', county_name: 'Kiambu', listing_status: 'active', pay_min: '9000.00', pay_max: '12000.00', created_by: 'admin_2', internal_notes: 'Weekend shifts only' },
  { _id: 'job_12348', job_title: 'Cafeteria Server', job_category: 'catering', county_name: 'Nairobi', listing_status: 'active', pay_min: '10000.00', pay_max: '14000.00', created_by: 'admin_1', internal_notes: '' },
  { _id: 'job_12349', job_title: 'Maths Tutor, First Years', job_category: 'tutoring', county_name: 'Nairobi', listing_status: 'active', pay_min: '20000.00', pay_max: '30000.00', created_by: 'admin_3', internal_notes: 'Needs transcript check' },
  { _id: 'job_12350', job_title: 'Bedsitter Caretaker', job_category: 'accommodation', county_name: 'Nairobi', listing_status: 'closed', pay_min: '8000.00', pay_max: '10000.00', created_by: 'admin_2', internal_notes: 'Filled in August' },
  { _id: 'job_12351', job_title: 'Library Shelving Assistant', job_category: 'campus', county_name: 'Mombasa', listing_status: 'active', pay_min: '9500.50', pay_max: '11000.00', created_by: 'admin_4', internal_notes: '' },
  { _id: 'job_12352', job_title: 'Delivery Rider, Student Meals', job_category: 'catering', county_name: 'Kiambu', listing_status: 'closed', pay_min: '11000.00', pay_max: '16000.00', created_by: 'admin_4', internal_notes: 'Paused by partner' },
];

const applications = [
  { _id: 'app_1001', student_id: 'stu_0042', job_ref: 'job_12345', application_status: 'pending', updated_at: new Date('2026-09-20T09:15:00Z'), reviewer_notes: '' },
  { _id: 'app_1002', student_id: 'stu_0107', job_ref: 'job_12348', application_status: 'approved', updated_at: new Date('2026-09-18T14:02:00Z'), reviewer_notes: 'Start Monday' },
  { _id: 'app_1003', student_id: 'stu_0042', job_ref: 'job_12349', application_status: 'rejected', updated_at: new Date('2026-09-15T11:40:00Z'), reviewer_notes: 'No transcript' },
  { _id: 'app_1004', student_id: 'stu_0231', job_ref: 'job_12347', application_status: 'cancelled', updated_at: new Date('2026-09-12T08:30:00Z'), reviewer_notes: '' },
];

// Anything that changes an application's status announces it here, and the
// WebSocket in src/realtime.js pushes it to subscribers. Next week's PUT and
// DELETE handlers will call setApplicationStatus, so pushes work automatically.
const events = new EventEmitter();

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function findJobs({ status, county, category }) {
  return jobs.filter((row) =>
    (status === undefined || same(row.listing_status, status)) &&
    (county === undefined || same(row.county_name, county)) &&
    (category === undefined || same(row.job_category, category)));
}

function findJobById(id) {
  return jobs.find((row) => row._id === id) || null;
}

function findApplicationById(id) {
  return applications.find((row) => row._id === id) || null;
}

function setApplicationStatus(id, status) {
  const row = findApplicationById(id);
  if (!row) return null;
  row.application_status = status;
  row.updated_at = new Date();
  events.emit('statusChanged', id, row);
  return row;
}

module.exports = { findJobs, findJobById, findApplicationById, setApplicationStatus, events };
