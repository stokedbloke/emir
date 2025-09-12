#!/usr/bin/env node

/**
 * CHANGE COMPARISON SCRIPT
 * This script compares the application state before and after each refactoring step
 * to detect any unintended changes.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ChangeComparator {
  constructor() {
    this.comparisonResults = {
      timestamp: new Date().toISOString(),
      step: process.argv[2] || 'unknown',
      changes: {}
    };
  }

  async captureCurrentState() {
    console.log('📸 Capturing current application state...');
    
    const state = {
      timestamp: new Date().toISOString(),
      html: await this.captureHTML(),
      apiResponses: await this.captureAPIResponses(),
      fileStructure: this.captureFileStructure(),
      buildOutput: this.captureBuildOutput()
    };
    
    return state;
  }

  async captureHTML() {
    try {
      const response = await fetch('http://localhost:3000');
      const html = await response.text();
      
      return {
        length: html.length,
        hasLoadingScreen: html.includes('Preparing your space...'),
        hasGradientBackground: html.includes('bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100'),
        hasAnimations: html.includes('animate-pulse') && html.includes('animate-ping'),
        criticalElements: this.extractCriticalElements(html)
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async captureAPIResponses() {
    const endpoints = [
      '/api/status',
      '/api/global-settings',
      '/api/reflection'
    ];
    
    const responses = {};
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://localhost:3000${endpoint}`);
        const data = await response.json();
        
        responses[endpoint] = {
          status: response.status,
          ok: response.ok,
          dataKeys: Object.keys(data),
          dataType: typeof data
        };
      } catch (error) {
        responses[endpoint] = { error: error.message };
      }
    }
    
    return responses;
  }

  captureFileStructure() {
    const importantFiles = [
      'app/page.tsx',
      'package.json',
      'next.config.js',
      'tailwind.config.js'
    ];
    
    const structure = {};
    
    for (const file of importantFiles) {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        structure[file] = {
          exists: true,
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      } else {
        structure[file] = { exists: false };
      }
    }
    
    return structure;
  }

  captureBuildOutput() {
    try {
      const output = execSync('npm run build', { 
        stdio: 'pipe',
        cwd: process.cwd()
      }).toString();
      
      return {
        success: true,
        outputLength: output.length,
        hasErrors: output.includes('error'),
        hasWarnings: output.includes('warning')
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout?.toString() || ''
      };
    }
  }

  extractCriticalElements(html) {
    const elements = [
      'Preparing your space...',
      'animate-pulse',
      'animate-ping',
      'bg-gradient-to-br',
      'from-rose-50',
      'via-purple-50',
      'to-indigo-100',
      'w-20 h-20',
      'rounded-full',
      'text-gray-600',
      'font-medium'
    ];
    
    return elements.map(element => ({
      element,
      present: html.includes(element)
    }));
  }

  compareStates(before, after) {
    console.log('🔍 Comparing application states...');
    
    const changes = {
      html: this.compareHTML(before.html, after.html),
      apiResponses: this.compareAPIResponses(before.apiResponses, after.apiResponses),
      fileStructure: this.compareFileStructure(before.fileStructure, after.fileStructure),
      buildOutput: this.compareBuildOutput(before.buildOutput, after.buildOutput)
    };
    
    return changes;
  }

  compareHTML(before, after) {
    const changes = [];
    
    if (before.length !== after.length) {
      changes.push({
        type: 'html_length_change',
        before: before.length,
        after: after.length,
        difference: after.length - before.length
      });
    }
    
    if (before.hasLoadingScreen !== after.hasLoadingScreen) {
      changes.push({
        type: 'loading_screen_change',
        before: before.hasLoadingScreen,
        after: after.hasLoadingScreen
      });
    }
    
    if (before.hasGradientBackground !== after.hasGradientBackground) {
      changes.push({
        type: 'gradient_background_change',
        before: before.hasGradientBackground,
        after: after.hasGradientBackground
      });
    }
    
    if (before.hasAnimations !== after.hasAnimations) {
      changes.push({
        type: 'animations_change',
        before: before.hasAnimations,
        after: after.hasAnimations
      });
    }
    
    // Compare critical elements
    const elementChanges = this.compareCriticalElements(before.criticalElements, after.criticalElements);
    changes.push(...elementChanges);
    
    return changes;
  }

  compareCriticalElements(before, after) {
    const changes = [];
    
    for (let i = 0; i < before.length; i++) {
      const beforeElement = before[i];
      const afterElement = after[i];
      
      if (beforeElement.present !== afterElement.present) {
        changes.push({
          type: 'critical_element_change',
          element: beforeElement.element,
          before: beforeElement.present,
          after: afterElement.present
        });
      }
    }
    
    return changes;
  }

  compareAPIResponses(before, after) {
    const changes = [];
    
    const endpoints = Object.keys(before);
    
    for (const endpoint of endpoints) {
      const beforeResponse = before[endpoint];
      const afterResponse = after[endpoint];
      
      if (beforeResponse.status !== afterResponse.status) {
        changes.push({
          type: 'api_status_change',
          endpoint,
          before: beforeResponse.status,
          after: afterResponse.status
        });
      }
      
      if (beforeResponse.ok !== afterResponse.ok) {
        changes.push({
          type: 'api_availability_change',
          endpoint,
          before: beforeResponse.ok,
          after: afterResponse.ok
        });
      }
    }
    
    return changes;
  }

  compareFileStructure(before, after) {
    const changes = [];
    
    const files = Object.keys(before);
    
    for (const file of files) {
      const beforeFile = before[file];
      const afterFile = after[file];
      
      if (beforeFile.exists !== afterFile.exists) {
        changes.push({
          type: 'file_existence_change',
          file,
          before: beforeFile.exists,
          after: afterFile.exists
        });
      }
      
      if (beforeFile.exists && afterFile.exists && beforeFile.size !== afterFile.size) {
        changes.push({
          type: 'file_size_change',
          file,
          before: beforeFile.size,
          after: afterFile.size,
          difference: afterFile.size - beforeFile.size
        });
      }
    }
    
    return changes;
  }

  compareBuildOutput(before, after) {
    const changes = [];
    
    if (before.success !== after.success) {
      changes.push({
        type: 'build_success_change',
        before: before.success,
        after: after.success
      });
    }
    
    if (before.hasErrors !== after.hasErrors) {
      changes.push({
        type: 'build_errors_change',
        before: before.hasErrors,
        after: after.hasErrors
      });
    }
    
    if (before.hasWarnings !== after.hasWarnings) {
      changes.push({
        type: 'build_warnings_change',
        before: before.hasWarnings,
        after: after.hasWarnings
      });
    }
    
    return changes;
  }

  generateComparisonReport(changes) {
    const reportPath = path.join(__dirname, '..', 'comparison-reports', `comparison-${this.comparisonResults.step}-${Date.now()}.json`);
    
    // Ensure reports directory exists
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const report = {
      ...this.comparisonResults,
      changes,
      summary: this.generateSummary(changes)
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📊 Comparison report saved to: ${reportPath}`);
    
    // Print summary
    console.log(`\n📈 Change Summary:`);
    console.log(`   Total Changes: ${report.summary.totalChanges}`);
    console.log(`   Critical Changes: ${report.summary.criticalChanges}`);
    console.log(`   Warnings: ${report.summary.warnings}`);
    
    if (report.summary.criticalChanges > 0) {
      console.log('\n⚠️  CRITICAL CHANGES DETECTED:');
      report.summary.criticalChangeTypes.forEach(changeType => {
        console.log(`   - ${changeType}`);
      });
    }
    
    return report;
  }

  generateSummary(changes) {
    const allChanges = Object.values(changes).flat();
    
    const criticalChangeTypes = [
      'loading_screen_change',
      'gradient_background_change',
      'animations_change',
      'critical_element_change',
      'api_availability_change',
      'build_success_change'
    ];
    
    const criticalChanges = allChanges.filter(change => 
      criticalChangeTypes.includes(change.type)
    );
    
    const warnings = allChanges.filter(change => 
      !criticalChangeTypes.includes(change.type)
    );
    
    return {
      totalChanges: allChanges.length,
      criticalChanges: criticalChanges.length,
      warnings: warnings.length,
      criticalChangeTypes: [...new Set(criticalChanges.map(c => c.type))]
    };
  }
}

// Run comparison if this script is executed directly
if (require.main === module) {
  const comparator = new ChangeComparator();
  
  // This would typically be used in a workflow:
  // 1. Capture state before change
  // 2. Make refactoring change
  // 3. Capture state after change
  // 4. Compare states
  
  console.log('Usage: node compare-changes.js [step-name]');
  console.log('This script should be integrated into the refactoring workflow');
}

module.exports = ChangeComparator;
