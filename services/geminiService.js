const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateSummary = async (content) => {
  try {
    if (!content || content.trim().length === 0) {
      throw new Error('Content is empty or invalid');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `Please provide a concise and comprehensive summary of the following content. Focus on the key points, main ideas, and important details:\n\n${content}`;
    
    const result = await model.generateContent(prompt);
    const response =  result.response;
    const summary = response.text();
    
    return summary.trim();
  } catch (error) {
    throw new Error(`Failed to generate summary: ${error.message}`);
  }
};

module.exports = { generateSummary };

