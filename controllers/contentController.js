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

    if (type === 'text' && input.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Text input must be at least 10 characters long. Short text does not require summarization.'
      });
    }

    const cachedResult = await getCachedSummary(input);
    
    if (cachedResult) {
      const existingContent = await Content.findById(cachedResult.jobId);
      const contentType = existingContent?.type || type;
      const responseData = {
        id: cachedResult.jobId,
        type: contentType,
        status: 'completed',
        summary: cachedResult.summary,
        cached: true,
        processing_time_ms: cachedResult.processingTime || existingContent?.processingTimeMs,
        createdAt: existingContent?.createdAt || cachedResult.createdAt,
        message: 'Result retrieved from cache'
      };

      if (contentType === 'url') {
        responseData.original_url = existingContent?.input || input;
      } else {
        responseData.original_text = existingContent?.input || input;
      }

      return res.status(200).json({
        success: true,
        data: responseData
      });
    }

    const existingJob = await findExistingJobByInput(input);
    
    if (existingJob) {
      await setCachedSummary(input, existingJob._id.toString(), existingJob.summary, existingJob.processingTimeMs || 0);
      
      const responseData = {
        id: existingJob._id,
        type: existingJob.type,
        status: 'completed',
        summary: existingJob.summary,
        cached: true,
        processing_time_ms: existingJob.processingTimeMs,
        createdAt: existingJob.createdAt,
        message: 'Result found from previous job'
      };

      if (existingJob.type === 'url') {
        responseData.original_url = existingJob.input;
      } else {
        responseData.original_text = existingJob.input;
      }

      return res.status(200).json({
        success: true,
        data: responseData
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
      
      if (content.type === 'url') {
        responseData.original_url = content.input;
      } else {
        responseData.original_text = content.input;
      }
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

const getJobResult = async (req, res) => {
  try {
    const { jobId } = req.params;

    const content = await Content.findById(jobId);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (content.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Job is not completed yet. Current status: ${content.status}`,
        status: content.status
      });
    }

    if (!content.summary) {
      return res.status(400).json({
        success: false,
        message: 'Summary not available for this job'
      });
    }

    const cachedResult = await getCachedSummary(content.input);
    const isCached = !!cachedResult && cachedResult.jobId === content._id.toString();

    const responseData = {
      job_id: content._id,
      summary: content.summary,
      cached: isCached,
      processing_time_ms: content.processingTimeMs || 0
    };

    if (content.type === 'url') {
      responseData.original_url = content.input;
    } else {
      responseData.original_text = content.input;
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching job result:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch job result'
    });
  }
};

module.exports = { createSummary, getJobStatus, getJobResult };

