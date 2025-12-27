require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const contentRoutes = require('./routes/contentRoutes');
const { startSummaryWorker } = require('./workers/summaryWorker');
const { startJobCleanupService } = require('./services/jobCleanupService');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

startSummaryWorker();
startJobCleanupService();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ message: 'Express server is running' });
});

app.use('/api/content', contentRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

