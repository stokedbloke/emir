#!/usr/bin/env node

/**
 * 🎯 CORE FUNCTIONALITY TEST FOR REFACTORED APP
 * Tests essential functionality without complex API dependencies
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

async function testAppLoads() {
  log('🧪 Testing app loads...', 'blue');
  const response = await makeRequest('https://localhost:3000/');
  if (response.status !== 200) {
    throw new Error(`App returned ${response.status} instead of 200`);
  }
  log('✅ App loads successfully', 'green');
}

async function testMainUIElements() {
  log('🧪 Testing main UI elements...', 'blue');
  const response = await makeRequest('https://localhost:3000/');
  const content = response.data;
  
  const requiredElements = [
    'Begin Your Journey',
    'Emotional Mirror',
    'Listen',
    'Settings'
  ];
  
  for (const element of requiredElements) {
    if (!content.includes(element)) {
      throw new Error(`Missing required UI element: ${element}`);
    }
  }
  
  log('✅ All main UI elements present', 'green');
}

async function testAPIEndpoints() {
  log('🧪 Testing API endpoints...', 'blue');
  
  const endpoints = [
    { url: 'https://localhost:3000/api/status', name: 'Status API' },
    { url: 'https://localhost:3000/api/global-settings', name: 'Global Settings API' }
  ];

  for (const endpoint of endpoints) {
    const response = await makeRequest(endpoint.url);
    if (response.status !== 200) {
      throw new Error(`${endpoint.name} returned ${response.status}`);
    }
  }
  
  log('✅ Core API endpoints working', 'green');
}

async function testErrorHandling() {
  log('🧪 Testing error handling...', 'blue');
  
  // Test 404 handling
  const response = await makeRequest('https://localhost:3000/nonexistent-page');
  if (response.status !== 404) {
    throw new Error(`Expected 404 for nonexistent page, got ${response.status}`);
  }
  
  log('✅ Error handling working correctly', 'green');
}

async function testHTTPS() {
  log('🧪 Testing HTTPS configuration...', 'blue');
  
  const response = await makeRequest('https://localhost:3000/');
  if (response.status !== 200) {
    throw new Error(`HTTPS not working, got ${response.status}`);
  }
  
  log('✅ HTTPS configuration working', 'green');
}

async function testBuildSuccess() {
  log('🧪 Testing build success...', 'blue');
  
  // Check if the app compiles without errors
  const { exec } = require('child_process');
  
  return new Promise((resolve, reject) => {
    exec('npx next build --dry-run 2>&1', (error, stdout, stderr) => {
      if (error) {
        // Check if it's just the --dry-run flag error
        if (stderr.includes('unknown option') || stderr.includes('--dry-run')) {
          // Try without --dry-run
          exec('npx next build 2>&1', (error2, stdout2, stderr2) => {
            if (error2) {
              reject(new Error(`Build failed: ${error2.message}`));
            } else {
              log('✅ Build successful', 'green');
              resolve();
            }
          });
        } else {
          reject(new Error(`Build failed: ${error.message}`));
        }
      } else {
        log('✅ Build successful', 'green');
        resolve();
      }
    });
  });
}

async function runCoreTests() {
  log('🚀 CORE FUNCTIONALITY TEST FOR REFACTORED APP', 'bold');
  log('=' .repeat(55), 'blue');
  log('Testing essential functionality...', 'yellow');
  
  let passed = 0;
  let failed = 0;

  const tests = [
    { name: 'App Loads', fn: testAppLoads },
    { name: 'Main UI Elements', fn: testMainUIElements },
    { name: 'API Endpoints', fn: testAPIEndpoints },
    { name: 'Error Handling', fn: testErrorHandling },
    { name: 'HTTPS Configuration', fn: testHTTPS },
    { name: 'Build Success', fn: testBuildSuccess }
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
  log('📊 CORE FUNCTIONALITY TEST RESULTS', 'bold');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, 'red');
  log(`📈 Total: ${passed + failed}`, 'blue');

  if (failed === 0) {
    log('\n🎉 ALL CORE TESTS PASSED!', 'green');
    log('✅ App is ready for GitHub commit!', 'green');
    log('✅ Refactoring successful - core functionality preserved!', 'green');
    log('✅ HTTPS working for mobile testing!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some core tests failed.', 'yellow');
    log('Please review before committing to GitHub.', 'yellow');
    process.exit(1);
  }
}

runCoreTests().catch(error => {
  log(`\n💥 Core test crashed: ${error.message}`, 'red');
  process.exit(1);
});
