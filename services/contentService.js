const { extractContentFromURL } = require('../utils/urlExtractor');
const { generateSummary } = require('./geminiService');

const processContent = async (type, input) => {
  let contentToSummarize = '';
  
  if (type === 'url') {
    contentToSummarize = await extractContentFromURL(input);
  } else if (type === 'text') {
    contentToSummarize = input;
  } else {
    throw new Error('Invalid content type. Must be "text" or "url"');
  }

  if (!contentToSummarize || contentToSummarize.trim().length === 0) {
    throw new Error('No content available to summarize');
  }

  const summary = await generateSummary(contentToSummarize);

  return {
    extractedContent: type === 'url' ? contentToSummarize : null,
    summary
  };
};

module.exports = { processContent };

