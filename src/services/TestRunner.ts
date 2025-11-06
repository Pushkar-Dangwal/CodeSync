/**
 * TestRunner - Execute test cases against user functions
 * Handles test isolation, result comparison, and error handling
 */

import { SandboxEngine } from './SandboxEngine';
import type { ExecutionResult } from './SandboxEngine';
import type { TestCase } from './TestCaseParser';

export interface TestExecutionResult {
  testCase: TestCase;
  passed: boolean;
  actual?: any;
  error?: string;
  executionTime: number;
  output?: string;
}

export interface TestSuiteResult {
  results: TestExecutionResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalExecutionTime: number;
  hasParseErrors: boolean;
  parseErrors: Array<{
    line: number;
    message: string;
    originalText: string;
  }>;
}

export class TestRunner {
  private sandboxEngine: SandboxEngine;

  constructor() {
    this.sandboxEngine = new SandboxEngine();
  }

  /**
   * Execute a single test case against user code
   */
  async executeTestCase(userCode: string, testCase: TestCase): Promise<TestExecutionResult> {
    const startTime = performance.now();

    try {
      // Create isolated test execution code
      const testCode = this.createIsolatedTestCode(userCode, testCase);
      
      // Execute the test in sandbox
      const executionResult = await this.sandboxEngine.executeCode(testCode);
      const executionTime = performance.now() - startTime;

      if (executionResult.error) {
        return {
          testCase,
          passed: false,
          error: this.formatTestError(executionResult.error, testCase),
          executionTime,
          output: executionResult.output
        };
      }

      // Parse and compare results
      const actual = this.extractTestResult(executionResult.output);
      const passed = this.compareValues(actual, testCase.expected);

      return {
        testCase,
        passed,
        actual,
        executionTime,
        output: executionResult.output
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;
      return {
        testCase,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      };
    }
  }

  /**
   * Execute multiple test cases as a test suite
   */
  async executeTestSuite(
    userCode: string, 
    testCases: TestCase[],
    parseErrors: Array<{ line: number; message: string; originalText: string; }> = []
  ): Promise<TestSuiteResult> {
    const suiteStartTime = performance.now();
    const results: TestExecutionResult[] = [];

    // Execute each test case in isolation
    for (const testCase of testCases) {
      const result = await this.executeTestCase(userCode, testCase);
      results.push(result);
    }

    const totalExecutionTime = performance.now() - suiteStartTime;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;

    return {
      results,
      totalTests: results.length,
      passedTests,
      failedTests,
      totalExecutionTime,
      hasParseErrors: parseErrors.length > 0,
      parseErrors
    };
  }

  /**
   * Create isolated test execution code
   * Each test runs in its own scope to prevent interference
   */
  private createIsolatedTestCode(userCode: string, testCase: TestCase): string {
    // Wrap user code and test execution in an isolated function
    return `
      (function() {
        // User code
        ${userCode}
        
        // Test execution
        try {
          if (typeof ${testCase.functionName} !== 'function') {
            throw new Error('Function "${testCase.functionName}" is not defined or is not a function');
          }
          
          // Execute the function with test inputs
          const result = ${testCase.functionName}(${testCase.input.map(arg => JSON.stringify(arg)).join(', ')});
          
          // Output the result for comparison
          console.log('__TEST_RESULT__:', JSON.stringify(result));
          
          return result;
        } catch (error) {
          console.log('__TEST_ERROR__:', error.message);
          throw error;
        }
      })();
    `;
  }

  /**
   * Extract test result from execution output
   */
  private extractTestResult(output: string): any {
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('__TEST_RESULT__:')) {
        try {
          const resultStr = line.split('__TEST_RESULT__:')[1].trim();
          return JSON.parse(resultStr);
        } catch (error) {
          // If JSON parsing fails, return the raw string
          return line.split('__TEST_RESULT__:')[1].trim();
        }
      }
    }
    
    // If no explicit result marker found, try to parse the last line
    const lastLine = lines[lines.length - 1]?.trim();
    if (lastLine && lastLine !== '') {
      try {
        return JSON.parse(lastLine);
      } catch {
        return lastLine;
      }
    }
    
    return undefined;
  }

  /**
   * Compare two values for equality with deep comparison support
   */
  private compareValues(actual: any, expected: any): boolean {
    // Handle strict equality first
    if (actual === expected) {
      return true;
    }
    
    // Handle null/undefined cases
    if (actual === null || expected === null || actual === undefined || expected === undefined) {
      return actual === expected;
    }
    
    // Handle type mismatches
    if (typeof actual !== typeof expected) {
      // Special case: number vs string comparison for numeric values
      if ((typeof actual === 'number' && typeof expected === 'string') ||
          (typeof actual === 'string' && typeof expected === 'number')) {
        return String(actual) === String(expected);
      }
      return false;
    }
    
    // Handle arrays
    if (Array.isArray(actual) && Array.isArray(expected)) {
      if (actual.length !== expected.length) {
        return false;
      }
      
      for (let i = 0; i < actual.length; i++) {
        if (!this.compareValues(actual[i], expected[i])) {
          return false;
        }
      }
      
      return true;
    }
    
    // Handle objects
    if (typeof actual === 'object' && typeof expected === 'object') {
      const actualKeys = Object.keys(actual).sort();
      const expectedKeys = Object.keys(expected).sort();
      
      if (actualKeys.length !== expectedKeys.length) {
        return false;
      }
      
      for (let i = 0; i < actualKeys.length; i++) {
        if (actualKeys[i] !== expectedKeys[i]) {
          return false;
        }
        
        if (!this.compareValues(actual[actualKeys[i]], expected[expectedKeys[i]])) {
          return false;
        }
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Format test-specific error messages
   */
  private formatTestError(error: string, testCase: TestCase): string {
    // Check for common error patterns and provide helpful messages
    if (error.includes('is not defined')) {
      return `Function "${testCase.functionName}" is not defined. Make sure you've implemented the function.`;
    }
    
    if (error.includes('is not a function')) {
      return `"${testCase.functionName}" exists but is not a function. Check your implementation.`;
    }
    
    if (error.includes('timeout')) {
      return `Test case timed out. The function "${testCase.functionName}" may have an infinite loop or be too slow.`;
    }
    
    if (error.includes('Maximum call stack')) {
      return `Stack overflow detected in "${testCase.functionName}". Check for infinite recursion.`;
    }
    
    // Return the original error for other cases
    return error;
  }

  /**
   * Get test execution statistics
   */
  getTestStatistics(results: TestExecutionResult[]): {
    passRate: number;
    averageExecutionTime: number;
    slowestTest: TestExecutionResult | null;
    fastestTest: TestExecutionResult | null;
  } {
    if (results.length === 0) {
      return {
        passRate: 0,
        averageExecutionTime: 0,
        slowestTest: null,
        fastestTest: null
      };
    }

    const passedCount = results.filter(r => r.passed).length;
    const passRate = (passedCount / results.length) * 100;
    
    const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0);
    const averageExecutionTime = totalTime / results.length;
    
    const slowestTest = results.reduce((slowest, current) => 
      current.executionTime > slowest.executionTime ? current : slowest
    );
    
    const fastestTest = results.reduce((fastest, current) => 
      current.executionTime < fastest.executionTime ? current : fastest
    );

    return {
      passRate,
      averageExecutionTime,
      slowestTest,
      fastestTest
    };
  }

  /**
   * Validate that user code contains the required function
   */
  validateUserCode(code: string, functionName: string): string[] {
    const errors: string[] = [];
    
    // Check if function is declared
    const functionPatterns = [
      new RegExp(`function\\s+${functionName}\\s*\\(`),
      new RegExp(`const\\s+${functionName}\\s*=`),
      new RegExp(`let\\s+${functionName}\\s*=`),
      new RegExp(`var\\s+${functionName}\\s*=`),
      new RegExp(`${functionName}\\s*:`), // Object method
      new RegExp(`${functionName}\\s*=\\s*function`), // Function expression
      new RegExp(`${functionName}\\s*=\\s*\\(`), // Arrow function
    ];
    
    const hasFunction = functionPatterns.some(pattern => pattern.test(code));
    
    if (!hasFunction) {
      errors.push(`Function "${functionName}" not found in code`);
    }
    
    return errors;
  }
}