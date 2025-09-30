// Mobile responsiveness test suite
// Run with: node tests/mobile-responsiveness.test.js

const BASE_URL = process.env.TEST_BASE_URL || 'https://localhost:3000';

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${msg}`);
  }
}

// Mobile user agents for testing
const MOBILE_USER_AGENTS = {
  iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  Android: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36',
  iPad: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
};

async function testMobilePageLoad() {
  console.log('📱 Testing mobile page load...');
  
  for (const [device, userAgent] of Object.entries(MOBILE_USER_AGENTS)) {
    const res = await fetch(`${BASE_URL}/`, {
      method: 'GET',
      headers: { 'User-Agent': userAgent }
    });
    assert(res.ok, `${device} page should load successfully`);
    
    const html = await res.text();
    assert(html.includes('viewport'), `${device} should have viewport meta tag`);
    assert(html.includes('width=device-width'), `${device} should have responsive viewport`);
  }
}

async function testMobileTabNavigation() {
  console.log('📱 Testing mobile tab navigation...');
  
  const res = await fetch(`${BASE_URL}/`, {
    method: 'GET',
    headers: { 'User-Agent': MOBILE_USER_AGENTS.iPhone }
  });
  
  const html = await res.text();
  
  // Check for mobile-friendly tab navigation
  assert(html.includes('TabsList'), 'Should have tab navigation component');
  assert(html.includes('Listen'), 'Should have Listen tab');
  assert(html.includes('About'), 'Should have About tab');
  
  // Check for responsive classes
  assert(html.includes('flex'), 'Should use flexbox for responsive layout');
  assert(html.includes('space-x-'), 'Should have proper spacing classes');
}

async function testAboutPageMobile() {
  console.log('📱 Testing About page mobile layout...');
  
  const res = await fetch(`${BASE_URL}/`, {
    method: 'GET',
    headers: { 'User-Agent': MOBILE_USER_AGENTS.iPhone }
  });
  
  const html = await res.text();
  
  // Check for About page content
  assert(html.includes('I\'m obsessed with voice'), 'Should contain About page content');
  assert(html.includes('What it is'), 'Should contain section headers');
  assert(html.includes('hit.neil.up@gmail.com'), 'Should contain contact email');
  
  // Check for mobile-friendly styling
  assert(html.includes('rounded-2xl'), 'Should have rounded corners for mobile');
  assert(html.includes('p-6'), 'Should have proper padding for mobile');
  assert(html.includes('space-y-'), 'Should have proper vertical spacing');
}

async function testMobileTouchTargets() {
  console.log('📱 Testing mobile touch targets...');
  
  const res = await fetch(`${BASE_URL}/`, {
    method: 'GET',
    headers: { 'User-Agent': MOBILE_USER_AGENTS.iPhone }
  });
  
  const html = await res.text();
  
  // Check for touch-friendly button sizes
  assert(html.includes('px-6'), 'Should have adequate horizontal padding for touch');
  assert(html.includes('py-3'), 'Should have adequate vertical padding for touch');
  assert(html.includes('Button'), 'Should use Button components for touch targets');
}

async function testMobilePerformance() {
  console.log('📱 Testing mobile performance considerations...');
  
  const res = await fetch(`${BASE_URL}/`, {
    method: 'GET',
    headers: { 'User-Agent': MOBILE_USER_AGENTS.iPhone }
  });
  
  const html = await res.text();
  
  // Check for performance optimizations
  assert(html.includes('backdrop-blur'), 'Should use backdrop-blur for performance');
  assert(html.includes('bg-white/80'), 'Should use semi-transparent backgrounds');
  assert(!html.includes('heavy-animation'), 'Should avoid heavy animations');
}

async function testMobileAccessibility() {
  console.log('📱 Testing mobile accessibility...');
  
  const res = await fetch(`${BASE_URL}/`, {
    method: 'GET',
    headers: { 'User-Agent': MOBILE_USER_AGENTS.iPhone }
  });
  
  const html = await res.text();
  
  // Check for accessibility features
  assert(html.includes('aria-'), 'Should have ARIA attributes');
  assert(html.includes('role='), 'Should have role attributes');
  assert(html.includes('alt='), 'Should have alt attributes for images');
}

async function run() {
  console.log('🧪 Running mobile responsiveness test suite...\n');
  
  await testMobilePageLoad();
  await testMobileTabNavigation();
  await testAboutPageMobile();
  await testMobileTouchTargets();
  await testMobilePerformance();
  await testMobileAccessibility();
  
  console.log('\n✅ Mobile responsiveness tests completed!');
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
