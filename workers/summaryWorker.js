const { Worker } = require('bullmq');
const Content = require('../models/Content');
const { processContent } = require('../services/contentService');
const { connection } = require('../config/queue');
const logger = require('../utils/logger');
const { setCachedSummary } = require('../services/cacheService');

const startSummaryWorker = () => {
  const worker = new Worker(
    'summary-queue',
    async (job) => {
      const { jobId, type, input } = job.data;
      const attemptNumber = job.attemptsMade + 1;
      const jobStartTime = Date.now();
      const queueWaitTime = jobStartTime - job.timestamp;

      logger.info(`Processing job ${jobId}`, {
        jobId,
        type,
        attemptNumber,
        totalAttempts: job.opts.attempts,
        queueWaitTimeMs: queueWaitTime
      });

      try {
        const content = await Content.findById(jobId);

        if (!content) {
          const error = new Error(`Job ${jobId} not found in database`);
          logger.error(`Job not found in database`, { jobId });
          throw error;
        }

        if (content.status === 'completed') {
          logger.warn(`Job already completed`, {
            jobId,
            currentStatus: content.status,
            attemptNumber
          });
          return { jobId, status: content.status, skipped: true };
        }

        if (content.status === 'processing' && attemptNumber === 1) {
          logger.warn(`Job already being processed, will retry due to stall`, {
            jobId,
            attemptNumber
          });
        }

        content.status = 'processing';
        await content.save();

        logger.debug(`Starting content processing`, { jobId, type });

        const processingStartTime = Date.now();
        const { extractedContent, summary } = await processContent(type, input);
        const contentProcessingTime = Date.now() - processingStartTime;
        const totalProcessingTimeMs = Date.now() - jobStartTime;

        content.summary = summary;
        content.extractedContent = extractedContent || null;
        content.status = 'completed';
        content.processingTimeMs = totalProcessingTimeMs;
        content.errorMessage = null;
        content.errorStack = null;
        await content.save();

        await setCachedSummary(input, jobId, summary, totalProcessingTimeMs);

        logger.info(`Job completed successfully`, { 
          jobId, 
          queueWaitTimeMs: queueWaitTime,
          contentProcessingTimeMs: contentProcessingTime,
          totalProcessingTimeMs
        });
        
        return { 
          jobId, 
          status: 'completed', 
          processingTimeMs: totalProcessingTimeMs,
          queueWaitTimeMs: queueWaitTime,
          contentProcessingTimeMs: contentProcessingTime
        };
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
            const failedProcessingTimeMs = Date.now() - jobStartTime;
            content.failureCount = (content.failureCount || 0) + 1;
            content.lastFailureAt = new Date();
            content.errorMessage = error.message;
            content.errorStack = error.stack;

            if (attemptNumber >= job.opts.attempts) {
              content.status = 'failed';
              content.processingTimeMs = failedProcessingTimeMs;
              logger.error(`Job failed after all retries`, {
                jobId,
                totalAttempts: attemptNumber,
                finalError: error.message,
                processingTimeMs: failedProcessingTimeMs
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
      },
      lockDuration: 60000,
      maxStalledCount: 3,
      stalledInterval: 30000
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

  worker.on('stalled', async (jobId) => {
    logger.warn(`Job stalled - worker may have crashed`, { 
      jobId,
      message: 'Job will be retried automatically'
    });

    try {
      const job = await worker.getJob(jobId);
      if (job && job.data?.jobId) {
        const content = await Content.findById(job.data.jobId);
        if (content && content.status === 'processing') {
          content.status = 'pending';
          content.failureCount = (content.failureCount || 0) + 1;
          content.errorMessage = 'Job stalled - worker may have crashed, retrying...';
          await content.save();
          logger.info(`Reset job status to pending for retry`, { jobId: job.data.jobId });
        }
      }
    } catch (error) {
      logger.error(`Error handling stalled job`, {
        jobId,
        error: error.message
      });
    }
  });

  logger.info('Summary worker started and listening for jobs');
  
  return worker;
};

module.exports = { startSummaryWorker };

