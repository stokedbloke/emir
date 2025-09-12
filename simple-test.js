#!/usr/bin/env node

const https = require('https');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

async function test() {
  try {
    console.log('Testing main page...');
    const mainPage = await makeRequest('https://localhost:3000/');
    console.log(`Main page status: ${mainPage.status}`);
    
    console.log('Testing status API...');
    const status = await makeRequest('https://localhost:3000/api/status');
    console.log(`Status API: ${status.status} - ${status.data}`);
    
    console.log('Testing global settings...');
    const settings = await makeRequest('https://localhost:3000/api/global-settings');
    console.log(`Settings API: ${settings.status}`);
    
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

test();
