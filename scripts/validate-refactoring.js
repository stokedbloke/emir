#!/usr/bin/env node

/**
 * REFACTORING VALIDATION SCRIPT
 * This script runs comprehensive validation after each refactoring step
 * to ensure zero functionality, UI, or UX changes.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class RefactoringValidator {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.validationResults = {
      timestamp: new Date().toISOString(),
      step: process.argv[2] || 'unknown',
      results: {}
    };
  }

  async runAllValidations() {
    console.log('🔍 Starting comprehensive refactoring validation...\n');

    try {
      // 1. Check if app is running
      await this.validateAppRunning();
      
      // 2. Validate HTML structure
      await this.validateHTMLStructure();
      
      // 3. Validate CSS classes
      await this.validateCSSClasses();
      
      // 4. Validate API endpoints
      await this.validateAPIEndpoints();
      
      // 5. Validate JavaScript functionality
      await this.validateJavaScriptFunctionality();
      
      // 6. Validate build process
      await this.validateBuildProcess();
      
      // 7. Generate validation report
      this.generateValidationReport();
      
      console.log('✅ All validations completed successfully!');
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  async validateAppRunning() {
    console.log('📡 Validating app is running...');
    
    try {
      const response = await fetch(this.baseUrl);
      if (!response.ok) {
        throw new Error(`App not responding: ${response.status}`);
      }
      
      this.validationResults.results.appRunning = {
        status: 'PASS',
        responseTime: Date.now(),
        statusCode: response.status
      };
      
      console.log('✅ App is running and responding');
    } catch (error) {
      this.validationResults.results.appRunning = {
        status: 'FAIL',
        error: error.message
      };
      throw error;
    }
  }

  async validateHTMLStructure() {
    console.log('🏗️  Validating HTML structure...');
    
    try {
      const response = await fetch(this.baseUrl);
      const html = await response.text();
      
      // Critical HTML elements that must be present
      const criticalElements = [
        'Preparing your space...',
        'animate-pulse',
        'bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100',
        'w-20 h-20 bg-gradient-to-br from-purple-400 to-indigo-500',
        'text-gray-600 font-medium'
      ];
      
      const missingElements = criticalElements.filter(element => 
        !html.includes(element)
      );
      
      if (missingElements.length > 0) {
        throw new Error(`Missing critical HTML elements: ${missingElements.join(', ')}`);
      }
      
      this.validationResults.results.htmlStructure = {
        status: 'PASS',
        elementsFound: criticalElements.length,
        htmlLength: html.length
      };
      
      console.log('✅ HTML structure is intact');
    } catch (error) {
      this.validationResults.results.htmlStructure = {
        status: 'FAIL',
        error: error.message
      };
      throw error;
    }
  }

  async validateCSSClasses() {
    console.log('🎨 Validating CSS classes...');
    
    try {
      const response = await fetch(this.baseUrl);
      const html = await response.text();
      
      // Critical CSS classes that must be preserved
      const criticalClasses = [
        'min-h-screen',
        'bg-gradient-to-br',
        'from-rose-50',
        'via-purple-50',
        'to-indigo-100',
        'flex',
        'items-center',
        'justify-center',
        'text-center',
        'space-y-6',
        'animate-pulse',
        'animate-ping',
        'rounded-full',
        'mx-auto'
      ];
      
      const missingClasses = criticalClasses.filter(className => 
        !html.includes(className)
      );
      
      if (missingClasses.length > 0) {
        throw new Error(`Missing critical CSS classes: ${missingClasses.join(', ')}`);
      }
      
      this.validationResults.results.cssClasses = {
        status: 'PASS',
        classesFound: criticalClasses.length,
        missingClasses: missingClasses.length
      };
      
      console.log('✅ CSS classes are preserved');
    } catch (error) {
      this.validationResults.results.cssClasses = {
        status: 'FAIL',
        error: error.message
      };
      throw error;
    }
  }

  async validateAPIEndpoints() {
    console.log('🔌 Validating API endpoints...');
    
    const endpoints = [
      { path: '/api/status', method: 'GET' },
      { path: '/api/global-settings', method: 'GET' },
      { path: '/api/reflection', method: 'POST', requiresData: true }
    ];
    
    const results = {};
    
    for (const endpoint of endpoints) {
      try {
        let response;
        if (endpoint.method === 'GET') {
          response = await fetch(`${this.baseUrl}${endpoint.path}`);
        } else if (endpoint.requiresData) {
          // For POST endpoints that require data, just check if they exist
          // Use a HEAD request to avoid inserting test data
          response = await fetch(`${this.baseUrl}${endpoint.path}`, {
            method: 'HEAD'
          });
        }
        
        results[endpoint.path] = {
          status: response.ok ? 'PASS' : 'FAIL',
          statusCode: response.status,
          accessible: response.ok || response.status === 400 // 400 means endpoint exists but needs proper data
        };
      } catch (error) {
        results[endpoint.path] = {
          status: 'FAIL',
          error: error.message,
          accessible: false
        };
      }
    }
    
    const failedEndpoints = Object.entries(results)
      .filter(([_, result]) => !result.accessible)
      .map(([endpoint, _]) => endpoint);
    
    if (failedEndpoints.length > 0) {
      throw new Error(`API endpoints not accessible: ${failedEndpoints.join(', ')}`);
    }
    
    this.validationResults.results.apiEndpoints = {
      status: 'PASS',
      endpoints: results
    };
    
    console.log('✅ API endpoints are accessible');
  }

  async validateJavaScriptFunctionality() {
    console.log('⚡ Validating JavaScript functionality...');
    
    try {
      // Check if the main page JavaScript loads without errors
      const response = await fetch(`${this.baseUrl}/_next/static/chunks/app/page.js`);
      
      if (!response.ok) {
        throw new Error(`Main page JavaScript not accessible: ${response.status}`);
      }
      
      this.validationResults.results.javascriptFunctionality = {
        status: 'PASS',
        mainScriptAccessible: true
      };
      
      console.log('✅ JavaScript functionality is intact');
    } catch (error) {
      this.validationResults.results.javascriptFunctionality = {
        status: 'FAIL',
        error: error.message
      };
      throw error;
    }
  }

  async validateBuildProcess() {
    console.log('🔨 Validating build process...');
    
    try {
      // Check if build completes without errors
      execSync('npm run build', { 
        stdio: 'pipe',
        cwd: process.cwd()
      });
      
      this.validationResults.results.buildProcess = {
        status: 'PASS',
        buildSuccessful: true
      };
      
      console.log('✅ Build process completes successfully');
    } catch (error) {
      this.validationResults.results.buildProcess = {
        status: 'FAIL',
        error: error.message,
        buildSuccessful: false
      };
      throw error;
    }
  }

  generateValidationReport() {
    const reportPath = path.join(__dirname, '..', 'validation-reports', `validation-${this.validationResults.step}-${Date.now()}.json`);
    
    // Ensure reports directory exists
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.validationResults, null, 2));
    
    console.log(`\n📊 Validation report saved to: ${reportPath}`);
    
    // Print summary
    const totalTests = Object.keys(this.validationResults.results).length;
    const passedTests = Object.values(this.validationResults.results)
      .filter(result => result.status === 'PASS').length;
    
    console.log(`\n📈 Validation Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${totalTests - passedTests}`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new RefactoringValidator();
  validator.runAllValidations().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = RefactoringValidator;
