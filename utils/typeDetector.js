const isValidURL = (string) => {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

const detectInputType = (input) => {
  if (!input || typeof input !== 'string') {
    throw new Error('Input must be a non-empty string');
  }

  const trimmedInput = input.trim();
  
  if (isValidURL(trimmedInput)) {
    return 'url';
  }
  
  return 'text';
};

module.exports = { detectInputType };



