const express = require('express');
const router = express.Router();
const { createSummary, getJobStatus, getJobResult } = require('../controllers/contentController');

router.post('/submit', createSummary);
router.get('/status/:jobId', getJobStatus);
router.get('/result/:jobId', getJobResult);

module.exports = router;


