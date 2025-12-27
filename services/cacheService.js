const crypto = require('crypto');
const { connection } = require('../config/queue');
const Content = require('../models/Content');

const CACHE_PREFIX = 'summary:cache:';
const CACHE_TTL = 7 * 24 * 60 * 60;

const generateCacheKey = (input) => {
  const hash = crypto.createHash('sha256').update(input.trim().toLowerCase()).digest('hex');
  return `${CACHE_PREFIX}${hash}`;
};

const getCachedSummary = async (input) => {
  try {
    const cacheKey = generateCacheKey(input);
    const cachedData = await connection.get(cacheKey);

    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      
      const content = await Content.findById(parsed.jobId);
      if (content && content.status === 'completed' && content.summary) {
        return {
          cached: true,
          jobId: parsed.jobId,
          summary: content.summary,
          createdAt: parsed.createdAt,
          processingTime: parsed.processingTime
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting cached summary:', error);
    return null;
  }
};

const setCachedSummary = async (input, jobId, summary, processingTime) => {
  try {
    const cacheKey = generateCacheKey(input);
    const cacheData = {
      jobId: jobId.toString(),
      summary,
      createdAt: new Date().toISOString(),
      processingTime
    };

    await connection.setex(cacheKey, CACHE_TTL, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error setting cached summary:', error);
  }
};

const findExistingJobByInput = async (input) => {
  try {
    const trimmedInput = input.trim();
    
    const existingContent = await Content.findOne({
      input: { $regex: new RegExp(`^${trimmedInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      status: 'completed',
      summary: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });

    return existingContent;
  } catch (error) {
    console.error('Error finding existing job:', error);
    return null;
  }
};

const findPendingOrProcessingJobByInput = async (input) => {
  try {
    const trimmedInput = input.trim();
    
    const existingJob = await Content.findOne({
      input: { $regex: new RegExp(`^${trimmedInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      status: { $in: ['pending', 'processing'] }
    }).sort({ createdAt: -1 });

    return existingJob;
  } catch (error) {
    console.error('Error finding pending/processing job:', error);
    return null;
  }
};

module.exports = {
  getCachedSummary,
  setCachedSummary,
  findExistingJobByInput,
  findPendingOrProcessingJobByInput,
  generateCacheKey
};

