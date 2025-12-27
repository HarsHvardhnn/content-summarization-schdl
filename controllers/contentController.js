const Content = require('../models/Content');
const { detectInputType } = require('../utils/typeDetector');
const { processJob } = require('../services/workerService');

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

    const contentData = {
      type,
      input,
      status: 'pending'
    };

    savedContent = await Content.create(contentData);

    processJob(savedContent._id.toString(), type, input).catch(error => {
      console.error(`Worker error for job ${savedContent._id}:`, error);
    });

    res.status(201).json({
      success: true,
      data: {
        id: savedContent._id,
        type: savedContent.type,
        status: savedContent.status,
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

    res.status(200).json({
      success: true,
      data: {
        job_id: content._id,
        input_content_type: content.type,
        status: content.status,
        created_at: content.createdAt,
        updated_at: content.updatedAt
      }
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

