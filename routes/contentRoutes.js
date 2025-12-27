const express = require('express');
const router = express.Router();
const { createSummary, getJobStatus } = require('../controllers/contentController');

router.post('/submit', createSummary);
router.get('/status/:jobId', getJobStatus);

module.exports = router;


