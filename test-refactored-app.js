#!/usr/bin/env node

/**
 * 🧪 COMPREHENSIVE TEST SUITE FOR REFACTORED APP
 * Tests all functionality after refactoring to ensure nothing broke
 */

const https = require('https');
const http = require('http');

// Test configuration
const BASE_URL = 'https://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Test results tracking
let testsPassed = 0;
let testsFailed = 0;
let totalTests = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const requestOptions = {
      rejectUnauthorized: false, // For self-signed certificates
      ...options
    };

    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
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

async function runTest(testName, testFn) {
  totalTests++;
  try {
    log(`\n🧪 Testing: ${testName}`, 'blue');
    await testFn();
    log(`✅ PASSED: ${testName}`, 'green');
    testsPassed++;
  } catch (error) {
    log(`❌ FAILED: ${testName}`, 'red');
    log(`   Error: ${error.message}`, 'red');
    testsFailed++;
  }
}

// Test functions
async function testMainPage() {
  const response = await makeRequest(BASE_URL);
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  if (!response.data.includes('Begin Your Journey')) {
    throw new Error('Main page missing expected content');
  }
}

async function testAPIEndpoints() {
  const endpoints = [
    '/api/status',
    '/api/global-settings',
    '/api/credits/gemini',
    '/api/credits/elevenlabs',
    '/api/credits/claude',
    '/api/credits/openai'
  ];

  for (const endpoint of endpoints) {
    const response = await makeRequest(`${API_BASE}${endpoint}`);
    if (response.status !== 200) {
      throw new Error(`Endpoint ${endpoint} returned status ${response.status}`);
    }
  }
}

async function testSummarizeAPI() {
  const testData = {
    transcript: "I'm feeling frustrated about my work situation",
    userId: "test-user-123"
  };

  const response = await makeRequest(`${API_BASE}/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
  });

  if (response.status !== 200) {
    throw new Error(`Summarize API returned status ${response.status}`);
  }

  const result = JSON.parse(response.data);
  if (!result.summary || typeof result.summary !== 'string') {
    throw new Error('Summarize API did not return valid summary');
  }
}

async function testEmotionsAPI() {
  const testData = {
    transcript: "I'm feeling frustrated about my work situation",
    userId: "test-user-123"
  };

  const response = await makeRequest(`${API_BASE}/emotions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
  });

  if (response.status !== 200) {
    throw new Error(`Emotions API returned status ${response.status}`);
  }

  const result = JSON.parse(response.data);
  if (!Array.isArray(result.emotions)) {
    throw new Error('Emotions API did not return emotions array');
  }
}

async function testVocalAnalysisAPI() {
  const testData = {
    transcript: "I'm feeling frustrated about my work situation",
    userId: "test-user-123"
  };

  const response = await makeRequest(`${API_BASE}/vocal-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
  });

  if (response.status !== 200) {
    throw new Error(`Vocal analysis API returned status ${response.status}`);
  }

  const result = JSON.parse(response.data);
  if (!result.vocal || typeof result.vocal !== 'object') {
    throw new Error('Vocal analysis API did not return vocal characteristics');
  }
}

async function testReflectionAPI() {
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

  const response = await makeRequest(`${API_BASE}/reflection`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
  });

  if (response.status !== 200) {
    throw new Error(`Reflection API returned status ${response.status}`);
  }

  const result = JSON.parse(response.data);
  if (!result.success) {
    throw new Error('Reflection API did not return success');
  }
}

async function testVoiceCloneAPI() {
  // Test voice clone endpoint (without actual audio data)
  const testData = {
    userId: "test-user-123",
    audioBlob: "test-audio-data"
  };

  const response = await makeRequest(`${API_BASE}/voice-clone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
  });

  // This might fail due to invalid audio data, but should not crash
  if (response.status !== 200 && response.status !== 400) {
    throw new Error(`Voice clone API returned unexpected status ${response.status}`);
  }
}

async function testTTSAPI() {
  const testData = {
    text: "This is a test message",
    voiceId: "SAz9YHcvj6GT2YYXdXww"
  };

  const response = await makeRequest(`${API_BASE}/voice/elevenlabs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
  });

  if (response.status !== 200) {
    throw new Error(`TTS API returned status ${response.status}`);
  }
}

// Main test execution
async function runAllTests() {
  log('🚀 Starting Comprehensive Test Suite for Refactored App', 'bold');
  log('=' .repeat(60), 'blue');

  await runTest('Main Page Loads', testMainPage);
  await runTest('API Endpoints Respond', testAPIEndpoints);
  await runTest('Summarize API Works', testSummarizeAPI);
  await runTest('Emotions API Works', testEmotionsAPI);
  await runTest('Vocal Analysis API Works', testVocalAnalysisAPI);
  await runTest('Reflection API Works', testReflectionAPI);
  await runTest('Voice Clone API Responds', testVoiceCloneAPI);
  await runTest('TTS API Works', testTTSAPI);

  // Results summary
  log('\n' + '=' .repeat(60), 'blue');
  log('📊 TEST RESULTS SUMMARY', 'bold');
  log(`✅ Tests Passed: ${testsPassed}`, 'green');
  log(`❌ Tests Failed: ${testsFailed}`, 'red');
  log(`📈 Total Tests: ${totalTests}`, 'blue');

  if (testsFailed === 0) {
    log('\n🎉 ALL TESTS PASSED! App is ready for GitHub commit!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Please review before committing.', 'yellow');
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(error => {
  log(`\n💥 Test suite crashed: ${error.message}`, 'red');
  process.exit(1);
});
