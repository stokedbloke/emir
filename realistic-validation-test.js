#!/usr/bin/env node

/**
 * 🎯 REALISTIC VALIDATION TEST FOR REFACTORED APP
 * Tests core functionality with proper data formats and API limits
 */

const https = require('https');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { 
      rejectUnauthorized: false,
      ...options 
    }, (res) => {
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
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testMainPage() {
  log('🧪 Testing main page...', 'blue');
  const response = await makeRequest('https://localhost:3000/');
  if (response.status !== 200) {
    throw new Error(`Main page returned ${response.status}`);
  }
  if (!response.data.includes('Begin Your Journey')) {
    throw new Error('Main page missing expected content');
  }
  log('✅ Main page loads correctly', 'green');
}

async function testAPIEndpoints() {
  log('🧪 Testing API endpoints...', 'blue');
  
  const endpoints = [
    { url: 'https://localhost:3000/api/status', name: 'Status' },
    { url: 'https://localhost:3000/api/global-settings', name: 'Global Settings' }
  ];

  for (const endpoint of endpoints) {
    const response = await makeRequest(endpoint.url);
    if (response.status !== 200) {
      throw new Error(`${endpoint.name} API returned ${response.status}`);
    }
  }
  log('✅ Core API endpoints responding', 'green');
}

async function testAPIValidation() {
  log('🧪 Testing API validation...', 'blue');
  
  // Test that APIs properly validate input
  const emotionsResponse = await makeRequest('https://localhost:3000/api/emotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: "test", userId: "test" })
  });
  
  if (emotionsResponse.status !== 400) {
    throw new Error(`Emotions API should return 400 for invalid input, got ${emotionsResponse.status}`);
  }
  
  const reflectionResponse = await makeRequest('https://localhost:3000/api/reflection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: "test" })
  });
  
  if (reflectionResponse.status !== 400) {
    throw new Error(`Reflection API should return 400 for invalid input, got ${reflectionResponse.status}`);
  }
  
  log('✅ API validation working correctly', 'green');
}

async function testTTSAPI() {
  log('🧪 Testing TTS API...', 'blue');
  
  const testData = {
    text: "This is a test message",
    voiceId: "SAz9YHcvj6GT2YYXdXww"
  };

  const response = await makeRequest('https://localhost:3000/api/voice/elevenlabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });

  if (response.status !== 200) {
    throw new Error(`TTS API returned ${response.status}`);
  }
  log('✅ TTS API working', 'green');
}

async function testAppStructure() {
  log('🧪 Testing app structure...', 'blue');
  
  // Test that the app has the expected structure
  const response = await makeRequest('https://localhost:3000/');
  const content = response.data;
  
  const expectedElements = [
    'Begin Your Journey',
    'Listen',
    'Reflections',
    'Settings'
  ];
  
  for (const element of expectedElements) {
    if (!content.includes(element)) {
      throw new Error(`Missing expected UI element: ${element}`);
    }
  }
  
  log('✅ App structure is correct', 'green');
}

async function testErrorHandling() {
  log('🧪 Testing error handling...', 'blue');
  
  // Test that the app handles errors gracefully
  const response = await makeRequest('https://localhost:3000/nonexistent-page');
  if (response.status !== 404) {
    throw new Error(`Expected 404 for nonexistent page, got ${response.status}`);
  }
  
  log('✅ Error handling working correctly', 'green');
}

async function runValidation() {
  log('🚀 REALISTIC VALIDATION TEST FOR REFACTORED APP', 'bold');
  log('=' .repeat(55), 'blue');
  log('Testing core functionality with realistic expectations...', 'yellow');
  
  let passed = 0;
  let failed = 0;

  const tests = [
    { name: 'Main Page', fn: testMainPage },
    { name: 'API Endpoints', fn: testAPIEndpoints },
    { name: 'API Validation', fn: testAPIValidation },
    { name: 'TTS API', fn: testTTSAPI },
    { name: 'App Structure', fn: testAppStructure },
    { name: 'Error Handling', fn: testErrorHandling }
  ];

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      log(`❌ ${test.name} failed: ${error.message}`, 'red');
      failed++;
    }
  }

  log('\n' + '=' .repeat(55), 'blue');
  log('📊 VALIDATION RESULTS', 'bold');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, 'red');
  log(`📈 Total: ${passed + failed}`, 'blue');

  if (failed === 0) {
    log('\n🎉 ALL VALIDATION TESTS PASSED!', 'green');
    log('✅ App is ready for GitHub commit!', 'green');
    log('✅ Refactoring successful - core functionality preserved!', 'green');
    log('✅ Error handling and validation working correctly!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some validation tests failed.', 'yellow');
    log('Please review before committing to GitHub.', 'yellow');
    process.exit(1);
  }
}

runValidation().catch(error => {
  log(`\n💥 Validation crashed: ${error.message}`, 'red');
  process.exit(1);
});
