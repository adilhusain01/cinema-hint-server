const axios = require('axios');

const axiosInstance = axios.create({
  timeout: 15000, // increased to 15 seconds
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  // Enable keep-alive
  httpAgent: new (require('http').Agent)({ keepAlive: true }),
  httpsAgent: new (require('https').Agent)({ keepAlive: true })
});

// Add retry logic
axiosInstance.interceptors.response.use(undefined, async (err) => {
  const { config, message } = err;
  if (!config || !config.retry) {
    return Promise.reject(err);
  }

  // Only retry on network errors and 5xx responses
  const shouldRetry = (
    !err.response || // Network errors have no response
    (err.code && ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(err.code)) ||
    (err.response && err.response.status >= 500)
  );

  if (!shouldRetry) {
    return Promise.reject(err);
  }

  config.currentRetryAttempt = config.currentRetryAttempt || 0;

  if (config.currentRetryAttempt >= config.retry) {
    return Promise.reject(err);
  }

  config.currentRetryAttempt += 1;

  // Exponential backoff with jitter
  const backoffDelay = Math.min(
    ((config.retryDelay || 1000) * Math.pow(2, config.currentRetryAttempt)) + 
    Math.random() * 1000,
    8000 // Max delay of 8 seconds
  );

  await new Promise(resolve => setTimeout(resolve, backoffDelay));
  return axiosInstance(config);
});

module.exports = axiosInstance;
