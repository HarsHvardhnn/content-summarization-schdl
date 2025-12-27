const { Worker } = require('bullmq');
const Content = require('../models/Content');
const { processContent } = require('../services/contentService');
const { connection } = require('../config/queue');
const logger = require('../utils/logger');

const startSummaryWorker = () => {
  const worker = new Worker(
    'summary-queue',
    async (job) => {
      const { jobId, type, input } = job.data;
      const attemptNumber = job.attemptsMade + 1;

      logger.info(`Processing job ${jobId}`, {
        jobId,
        type,
        attemptNumber,
        totalAttempts: job.opts.attempts
      });

      try {
        const content = await Content.findById(jobId);

        if (!content) {
          const error = new Error(`Job ${jobId} not found in database`);
          logger.error(`Job not found in database`, { jobId });
          throw error;
        }

        if (content.status !== 'pending') {
          logger.warn(`Job status is not pending`, {
            jobId,
            currentStatus: content.status,
            attemptNumber
          });
          return { jobId, status: content.status, skipped: true };
        }

        logger.debug(`Starting content processing`, { jobId, type });

        const { extractedContent, summary } = await processContent(type, input);

        content.summary = summary;
        content.extractedContent = extractedContent || null;
        content.status = 'completed';
        content.errorMessage = null;
        content.errorStack = null;
        await content.save();

        logger.info(`Job completed successfully`, { jobId });
        
        return { jobId, status: 'completed' };
      } catch (error) {
        logger.error(`Error processing job`, {
          jobId,
          errorMessage: error.message,
          errorStack: error.stack,
          attemptNumber,
          type,
          inputPreview: typeof input === 'string' ? input.substring(0, 100) : 'N/A'
        });

        try {
          const content = await Content.findById(jobId);
          if (content) {
            content.failureCount = (content.failureCount || 0) + 1;
            content.lastFailureAt = new Date();
            content.errorMessage = error.message;
            content.errorStack = error.stack;

            if (attemptNumber >= job.opts.attempts) {
              content.status = 'failed';
              logger.error(`Job failed after all retries`, {
                jobId,
                totalAttempts: attemptNumber,
                finalError: error.message
              });
            }
            
            await content.save();
          }
        } catch (updateError) {
          logger.error(`Failed to update job error details`, {
            jobId,
            updateError: updateError.message,
            originalError: error.message
          });
        }

        throw error;
      }
    },
    {
      connection,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 1000
      }
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Job completed in queue`, {
      jobId: job.id,
      contentJobId: job.data?.jobId,
      processingTime: job.processedOn - job.timestamp
    });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job failed in queue`, {
      jobId: job?.id,
      contentJobId: job?.data?.jobId,
      errorMessage: err?.message,
      errorStack: err?.stack,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts
    });
    
    if (job?.data?.jobId) {
      Content.findById(job.data.jobId)
        .then(content => {
          if (content && job.attemptsMade >= job.opts.attempts) {
            content.status = 'failed';
            content.failureCount = (content.failureCount || 0) + 1;
            content.lastFailureAt = new Date();
            content.errorMessage = err?.message || 'Job failed after all retries';
            content.errorStack = err?.stack;
            return content.save();
          }
        })
        .catch(error => {
          logger.error(`Failed to update job status after queue failure`, {
            jobId: job.data.jobId,
            updateError: error.message
          });
        });
    }
  });

  worker.on('error', (err) => {
    logger.error(`Worker encountered an error`, {
      errorMessage: err.message,
      errorStack: err.stack
    });
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`Job stalled`, { jobId });
  });

  logger.info('Summary worker started and listening for jobs');
  
  return worker;
};

module.exports = { startSummaryWorker };

