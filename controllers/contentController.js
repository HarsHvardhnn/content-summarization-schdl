const Content = require('../models/Content');
const { detectInputType } = require('../utils/typeDetector');
const { summaryQueue } = require('../config/queue');
const { getCachedSummary, findExistingJobByInput, setCachedSummary } = require('../services/cacheService');

const createSummary = async (req, res) => {
  let savedContent = null;
  
  try {
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({
        success: false,
        message: 'Input is required'
      });
    }

    const type = detectInputType(input);

    const cachedResult = await getCachedSummary(input);
    
    if (cachedResult) {
      const existingContent = await Content.findById(cachedResult.jobId);
      
      return res.status(200).json({
        success: true,
        data: {
          id: cachedResult.jobId,
          type: existingContent?.type || type,
          status: 'completed',
          summary: cachedResult.summary,
          cached: true,
          processing_time_ms: cachedResult.processingTime || existingContent?.processingTimeMs,
          createdAt: existingContent?.createdAt || cachedResult.createdAt,
          message: 'Result retrieved from cache'
        }
      });
    }

    const existingJob = await findExistingJobByInput(input);
    
    if (existingJob) {
      await setCachedSummary(input, existingJob._id.toString(), existingJob.summary, existingJob.processingTimeMs || 0);
      
      return res.status(200).json({
        success: true,
        data: {
          id: existingJob._id,
          type: existingJob.type,
          status: 'completed',
          summary: existingJob.summary,
          cached: true,
          processing_time_ms: existingJob.processingTimeMs,
          createdAt: existingJob.createdAt,
          message: 'Result found from previous job'
        }
      });
    }

    const contentData = {
      type,
      input,
      status: 'pending'
    };

    savedContent = await Content.create(contentData);

    await summaryQueue.add('process-summary', {
      jobId: savedContent._id.toString(),
      type,
      input
    }, {
      jobId: savedContent._id.toString()
    });

    res.status(201).json({
      success: true,
      data: {
        id: savedContent._id,
        type: savedContent.type,
        status: savedContent.status,
        cached: false,
        message: 'Job created successfully. Use job ID to check status.',
        createdAt: savedContent.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating job:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create job',
      ...(savedContent && { jobId: savedContent._id, status: savedContent.status })
    });
  }
};

const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    const content = await Content.findById(jobId);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const responseData = {
      job_id: content._id,
      input_content_type: content.type,
      status: content.status,
      created_at: content.createdAt,
      updated_at: content.updatedAt
    };

    if (content.status === 'failed') {
      responseData.error = {
        message: content.errorMessage,
        stack: content.errorStack,
        failure_count: content.failureCount || 0,
        last_failure_at: content.lastFailureAt
      };
      if (content.processingTimeMs) {
        responseData.processing_time_ms = content.processingTimeMs;
      }
    }

    if (content.status === 'completed') {
      responseData.summary = content.summary;
      responseData.cached = false;
      responseData.processing_time_ms = content.processingTimeMs || 0;
    }

    if (content.status === 'pending' || content.status === 'processing') {
      const timeSinceCreation = Date.now() - new Date(content.createdAt).getTime();
      responseData.queue_wait_time_ms = timeSinceCreation;
      
      if (content.status === 'processing') {
        const processingTime = Date.now() - new Date(content.updatedAt).getTime();
        responseData.processing_duration_ms = processingTime;
      }
    }

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch job status'
    });
  }
};

module.exports = { createSummary, getJobStatus };

