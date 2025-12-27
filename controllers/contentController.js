const Content = require('../models/Content');
const { processContent } = require('../services/contentService');
const { detectInputType } = require('../utils/typeDetector');

const createSummary = async (req, res) => {
  try {
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({
        success: false,
        message: 'Input is required'
      });
    }

    const type = detectInputType(input);

    const { extractedContent, summary } = await processContent(type, input);

    const contentData = {
      type,
      input,
      summary,
      extractedContent: extractedContent || null
    };

    const savedContent = await Content.create(contentData);

    res.status(201).json({
      success: true,
      data: {
        id: savedContent._id,
        type: savedContent.type,
        summary: savedContent.summary,
        createdAt: savedContent.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating summary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create summary'
    });
  }
};

module.exports = { createSummary };

