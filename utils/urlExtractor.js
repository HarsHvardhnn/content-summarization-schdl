const axios = require('axios');
const cheerio = require('cheerio');

const extractContentFromURL = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    $('script, style, nav, footer, header').remove();
    
    const title = $('title').text().trim() || '';
    const bodyText = $('body').text().trim().replace(/\s+/g, ' ').substring(0, 50000);
    
    const content = title ? `${title}\n\n${bodyText}` : bodyText;
    
    return content || 'No content found';
  } catch (error) {
    throw new Error(`Failed to extract content from URL: ${error.message}`);
  }
};

module.exports = { extractContentFromURL };


