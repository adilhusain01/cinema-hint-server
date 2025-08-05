const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 5000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

const healthCheck = () => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log('Health check passed');
        resolve(true);
      } else {
        console.error(`Health check failed with status: ${res.statusCode}`);
        reject(new Error(`Health check failed: ${res.statusCode}`));
      }
    });

    req.on('error', (err) => {
      console.error('Health check request failed:', err.message);
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('Health check timeout');
      reject(new Error('Health check timeout'));
    });

    req.end();
  });
};

// Run health check
healthCheck()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Health check failed:', error.message);
    process.exit(1);
  });