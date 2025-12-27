const express = require('express');
const router = express.Router();
const { createSummary } = require('../controllers/contentController');

router.post('/summary', createSummary);

module.exports = router;


