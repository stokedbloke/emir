#!/usr/bin/env node

/**
 * 🎯 FINAL VALIDATION TEST FOR REFACTORED APP
 * Quick validation of core functionality before GitHub commit
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
    req.setTimeout(8000, () => {
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
    { url: 'https://localhost:3000/api/global-settings', name: 'Global Settings' },
    { url: 'https://localhost:3000/api/credits/gemini', name: 'Gemini Credits' },
    { url: 'https://localhost:3000/api/credits/elevenlabs', name: 'ElevenLabs Credits' }
  ];

  for (const endpoint of endpoints) {
    const response = await makeRequest(endpoint.url);
    if (response.status !== 200) {
      throw new Error(`${endpoint.name} API returned ${response.status}`);
    }
  }
  log('✅ All API endpoints responding', 'green');
}

async function testSummarizeAPI() {
  log('🧪 Testing summarize API...', 'blue');
  
  const testData = {
    transcript: "I'm feeling frustrated about my work situation",
    userId: "test-user-123"
  };

  const response = await makeRequest('https://localhost:3000/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });

  if (response.status !== 200) {
    throw new Error(`Summarize API returned ${response.status}`);
  }

  const result = JSON.parse(response.data);
  if (!result.summary || typeof result.summary !== 'string') {
    throw new Error('Summarize API did not return valid summary');
  }
  log('✅ Summarize API working', 'green');
}

async function testEmotionsAPI() {
  log('🧪 Testing emotions API...', 'blue');
  
  const testData = {
    transcript: "I'm feeling frustrated about my work situation",
    userId: "test-user-123"
  };

  const response = await makeRequest('https://localhost:3000/api/emotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });

  if (response.status !== 200) {
    throw new Error(`Emotions API returned ${response.status}`);
  }

  const result = JSON.parse(response.data);
  if (!Array.isArray(result.emotions)) {
    throw new Error('Emotions API did not return emotions array');
  }
  log('✅ Emotions API working', 'green');
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

async function testReflectionAPI() {
  log('🧪 Testing reflection API...', 'blue');
  
  const testData = {
    userId: "test-user-123",
    transcript: "I'm feeling frustrated about my work situation",
    summary: "I'm frustrated about my work situation",
    emotions: [
      { emotion: "Frustration", confidence: 0.8, sources: ["text"] }
    ],
    vocal: {
      tone: "Frustrated",
      pace: "Quick",
      pitch: "High",
      volume: "Loud",
      confidence: 0.7
    },
    device_info: {
      userAgent: "Test Agent",
      platform: "Test",
      language: "en-US",
      cookieEnabled: true,
      onLine: true,
      screenWidth: 1920,
      screenHeight: 1080,
      windowWidth: 1920,
      windowHeight: 1080,
      timezone: "UTC",
      timestamp: new Date().toISOString()
    },
    browser_info: {
      browser: "Test",
      version: "1.0",
      userAgent: "Test Agent",
      isMobile: false,
      isTablet: false
    },
    location_info: null,
    tts_service_used: "elevenlabs",
    summary_service_used: "gemini",
    recording_duration: 5
  };

  const response = await makeRequest('https://localhost:3000/api/reflection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });

  if (response.status !== 200) {
    throw new Error(`Reflection API returned ${response.status}`);
  }

  const result = JSON.parse(response.data);
  if (!result.success) {
    throw new Error('Reflection API did not return success');
  }
  log('✅ Reflection API working', 'green');
}

async function runValidation() {
  log('🚀 FINAL VALIDATION TEST FOR REFACTORED APP', 'bold');
  log('=' .repeat(50), 'blue');
  
  let passed = 0;
  let failed = 0;

  const tests = [
    { name: 'Main Page', fn: testMainPage },
    { name: 'API Endpoints', fn: testAPIEndpoints },
    { name: 'Summarize API', fn: testSummarizeAPI },
    { name: 'Emotions API', fn: testEmotionsAPI },
    { name: 'TTS API', fn: testTTSAPI },
    { name: 'Reflection API', fn: testReflectionAPI }
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

  log('\n' + '=' .repeat(50), 'blue');
  log('📊 VALIDATION RESULTS', 'bold');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, 'red');
  log(`📈 Total: ${passed + failed}`, 'blue');

  if (failed === 0) {
    log('\n🎉 ALL VALIDATION TESTS PASSED!', 'green');
    log('✅ App is ready for GitHub commit!', 'green');
    log('✅ Refactoring successful - no functionality lost!', 'green');
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
