const Content = require('../models/Content');
const { processContent } = require('./contentService');

const processJob = async (jobId, type, input) => {
  try {
    const content = await Content.findById(jobId);
    
    if (!content) {
      console.error(`Job ${jobId} not found`);
      return;
    }

    if (content.status !== 'pending') {
      console.log(`Job ${jobId} is not in pending status, current status: ${content.status}`);
      return;
    }

    console.log(`Processing job ${jobId} of type ${type} and input ${input}`);

    const { extractedContent, summary } = await processContent(type, input);

    content.summary = summary;
    content.extractedContent = extractedContent || null;
    content.status = 'completed';
    await content.save();

    console.log(`Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    
    try {
      const content = await Content.findById(jobId);
      if (content) {
        content.status = 'failed';
        await content.save();
      }
    } catch (updateError) {
      console.error(`Failed to update job ${jobId} status to failed:`, updateError);
    }
  }
};

module.exports = { processJob };

