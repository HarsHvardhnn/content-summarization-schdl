const Content = require('../models/Content');
const { summaryQueue } = require('../config/queue');
const logger = require('../utils/logger');

const STUCK_JOB_TIMEOUT_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

const cleanupStuckJobs = async () => {
  try {
    const cutoffTime = new Date(Date.now() - STUCK_JOB_TIMEOUT_MS);

    const stuckPendingJobs = await Content.find({
      status: 'pending',
      createdAt: { $lt: cutoffTime }
    });

    const stuckProcessingJobs = await Content.find({
      status: 'processing',
      updatedAt: { $lt: cutoffTime }
    });

    let resetCount = 0;

    for (const job of [...stuckPendingJobs, ...stuckProcessingJobs]) {
      try {
        const queueJob = await summaryQueue.getJob(job._id.toString());
        
        if (!queueJob || queueJob.finishedOn || queueJob.failedReason) {
          logger.warn(`Found stuck job in database but not in queue, resetting`, {
            jobId: job._id,
            status: job.status
          });
          
          job.status = 'pending';
          job.errorMessage = 'Job was stuck, reset for retry';
          await job.save();
          resetCount++;

          if (queueJob) {
            await queueJob.remove();
          }

          await summaryQueue.add('process-summary', {
            jobId: job._id.toString(),
            type: job.type,
            input: job.input
          }, {
            jobId: job._id.toString()
          });
        } else {
          logger.debug(`Job exists in queue, skipping cleanup`, {
            jobId: job._id,
            queueStatus: queueJob.getState()
          });
        }
      } catch (error) {
        logger.error(`Error processing stuck job in cleanup`, {
          jobId: job._id,
          error: error.message
        });
      }
    }

    if (resetCount > 0) {
      logger.info(`Cleaned up ${resetCount} stuck jobs`, {
        resetCount,
        stuckPending: stuckPendingJobs.length,
        stuckProcessing: stuckProcessingJobs.length
      });
    }
  } catch (error) {
    logger.error(`Error in cleanup stuck jobs`, {
      error: error.message,
      stack: error.stack
    });
  }
};

const startJobCleanupService = () => {
  logger.info('Starting job cleanup service', {
    intervalMs: CLEANUP_INTERVAL_MS,
    timeoutMs: STUCK_JOB_TIMEOUT_MS
  });

  setInterval(cleanupStuckJobs, CLEANUP_INTERVAL_MS);

  cleanupStuckJobs();
};

module.exports = { startJobCleanupService, cleanupStuckJobs };

