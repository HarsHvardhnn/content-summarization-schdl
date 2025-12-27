const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const getLogFileName = () => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, `worker-${date}.log`);
};

const formatLogMessage = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };
  return JSON.stringify(logEntry);
};

const writeLog = (level, message, data = {}) => {
  const logMessage = formatLogMessage(level, message, data);
  const logFile = getLogFileName();
  
  fs.appendFileSync(logFile, logMessage + '\n', 'utf8');
  
  const consoleMethod = level === 'error' ? console.error : 
                       level === 'warn' ? console.warn : 
                       console.log;
  
  consoleMethod(`[${level.toUpperCase()}] ${message}`, data && Object.keys(data).length > 0 ? data : '');
};

const logger = {
  info: (message, data) => writeLog('info', message, data),
  error: (message, data) => writeLog('error', message, data),
  warn: (message, data) => writeLog('warn', message, data),
  debug: (message, data) => writeLog('debug', message, data)
};

module.exports = logger;


