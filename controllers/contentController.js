const Content = require('../models/Content');
const { processContent } = require('../services/contentService');
const { detectInputType } = require('../utils/typeDetector');

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

    try {
      const { extractedContent, summary } = await processContent(type, input);

      savedContent.summary = summary;
      savedContent.extractedContent = extractedContent || null;
      savedContent.status = 'completed';
      await savedContent.save();
    } catch (error) {
      savedContent.status = 'failed';
      await savedContent.save();
      throw error;
    }

    res.status(201).json({
      success: true,
      data: {
        id: savedContent._id,
        type: savedContent.type,
        status: savedContent.status,
        summary: savedContent.summary,
        createdAt: savedContent.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating summary:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create summary',
      ...(savedContent && { jobId: savedContent._id, status: savedContent.status })
    });
  }
};

module.exports = { createSummary };

