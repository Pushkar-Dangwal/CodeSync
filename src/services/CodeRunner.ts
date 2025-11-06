/**
 * CodeRunner - High-level service for code execution and test running
 * Uses SandboxEngine for secure execution, TestCaseParser for parsing, TestRunner for execution, and MultiLanguageEngine for multi-language support
 */

import { SandboxEngine } from './SandboxEngine';
import type { ExecutionResult } from './SandboxEngine';
import { TestCaseParser } from './TestCaseParser';
import type { TestCase, ParseResult } from './TestCaseParser';
import { TestRunner } from './TestRunner';
import type { TestSuiteResult } from './TestRunner';
import { MultiLanguageEngine } from './MultiLanguageEngine';
import type { LanguageExecutionResult } from './MultiLanguageEngine';

// Re-export TestRunner types for convenience
export type { TestExecutionResult, TestSuiteResult } from './TestRunner';

export class CodeRunner {
  private sandboxEngine: SandboxEngine;
  private testCaseParser: TestCaseParser;
  private testRunner: TestRunner;
  private multiLanguageEngine: MultiLanguageEngine;

  constructor() {
    this.sandboxEngine = new SandboxEngine();
    this.testCaseParser = new TestCaseParser();
    this.testRunner = new TestRunner();
    this.multiLanguageEngine = new MultiLanguageEngine();
  }

  /**
   * Execute JavaScript code and return results (legacy method)
   */
  async executeCode(code: string): Promise<ExecutionResult> {
    try {
      return await this.sandboxEngine.executeCode(code);
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
        timedOut: false
      };
    }
  }

  /**
   * Execute code in specified language
   */
  async executeCodeWithLanguage(code: string, language: string, stdin?: string): Promise<LanguageExecutionResult> {
    try {
      return await this.multiLanguageEngine.executeCode(code, language, stdin);
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
        timedOut: false,
        language
      };
    }
  }

  /**
   * Run test cases against the provided code using TestRunner (JavaScript only)
   */
  async runTests(code: string, testCases?: TestCase[]): Promise<TestSuiteResult> {
    let finalTestCases: TestCase[];
    let parseErrors: Array<{ line: number; message: string; originalText: string; }> = [];

    if (testCases) {
      // Use provided test cases
      finalTestCases = testCases;
    } else {
      // Parse test cases from code
      const parseResult = this.testCaseParser.parseTestCases(code);
      finalTestCases = parseResult.testCases;
      parseErrors = parseResult.errors;
    }

    // Use TestRunner to execute the test suite
    return await this.testRunner.executeTestSuite(code, finalTestCases, parseErrors);
  }

  /**
   * Run test cases for any supported language
   */
  async runTestsWithLanguage(code: string, language: string, testCases?: TestCase[]): Promise<TestSuiteResult> {
    if (language.toLowerCase() === 'javascript' || language.toLowerCase() === 'js') {
      return this.runTests(code, testCases);
    }

    // For other languages, use MultiLanguageEngine
    let finalTestCases: TestCase[];
    let parseErrors: Array<{ line: number; message: string; originalText: string; }> = [];

    if (testCases) {
      finalTestCases = testCases;
    } else {
      // Parse test cases using MultiLanguageEngine
      const parsedTests = this.multiLanguageEngine.parseTestCases(code, language);
      finalTestCases = parsedTests;
      parseErrors = [];
    }

    // Execute tests for the specific language
    const results = [];
    const suiteStartTime = performance.now();

    for (const testCase of finalTestCases) {
      const startTime = performance.now();
      
      try {
        // Create test code for the specific language
        const testCode = this.createLanguageTestCode(code, testCase, language);
        
        // Extract stdin from userInputs if available (for Python input() support)
        const stdin = (testCase as any).userInputs || '';
        const stdinFormatted = stdin ? stdin.split(',').map((inp: string) => inp.trim()).join('\n') : '';
        
        const executionResult = await this.multiLanguageEngine.executeCode(testCode, language, stdinFormatted);
        const executionTime = performance.now() - startTime;

        if (executionResult.error) {
          results.push({
            testCase,
            passed: false,
            error: executionResult.error,
            executionTime,
            output: executionResult.output
          });
        } else {
          // Parse result and compare
          const actual = this.extractLanguageTestResult(executionResult.output, language);
          const passed = this.compareValues(actual, testCase.expected);
          
          results.push({
            testCase,
            passed,
            actual,
            executionTime,
            output: executionResult.output
          });
        }
      } catch (error) {
        const executionTime = performance.now() - startTime;
        results.push({
          testCase,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          executionTime
        });
      }
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
   * Parse test cases from code comments using TestCaseParser
   */
  parseTestCases(code: string): ParseResult {
    return this.testCaseParser.parseTestCases(code);
  }

  /**
   * Get supported test case formats
   */
  getSupportedTestFormats(): string[] {
    return this.testCaseParser.getSupportedFormats();
  }

  /**
   * Validate user code for test execution
   */
  validateCodeForTesting(code: string, functionName: string): string[] {
    return this.testRunner.validateUserCode(code, functionName);
  }

  /**
   * Get test execution statistics
   */
  getTestStatistics(results: any[]) {
    return this.testRunner.getTestStatistics(results);
  }

  /**
   * Create test code for different languages
   */
  private createLanguageTestCode(userCode: string, testCase: TestCase, language: string): string {
    switch (language.toLowerCase()) {
      case 'python':
      case 'py':
        return this.createPythonTestCode(userCode, testCase);
      default:
        // Fallback to JavaScript
        return `
          ${userCode}
          
          try {
            if (typeof ${testCase.functionName} === 'function') {
              const result = ${testCase.functionName}(${testCase.input.map(arg => JSON.stringify(arg)).join(', ')});
              console.log('__TEST_RESULT__:', JSON.stringify(result));
            } else {
              throw new Error('Function ${testCase.functionName} is not defined');
            }
          } catch (error) {
            console.log('__TEST_ERROR__:', error.message);
            throw error;
          }
        `;
    }
  }

  /**
   * Create Python test code
   */
  private createPythonTestCode(userCode: string, testCase: TestCase): string {
    const args = testCase.input.map(arg => 
      typeof arg === 'string' ? `"${arg}"` : String(arg)
    ).join(', ');

    // For API execution, we don't need input simulation since stdin is handled by the API
    // For local simulation, we still need the input simulation as fallback
    const hasUserInputs = (testCase as any).userInputs;
    let inputSimulation = '';
    
    // Only add input simulation for fallback cases (when API is not available)
    if (hasUserInputs && !this.isApiAvailable()) {
      const inputs = (testCase as any).userInputs.split(',').map((inp: string) => inp.trim());
      inputSimulation = `
# Simulate user inputs (fallback mode)
input_values = ${JSON.stringify(inputs)}
input_index = 0

def input(prompt=""):
    global input_index, input_values
    if input_index < len(input_values):
        value = input_values[input_index]
        input_index += 1
        print(f"{prompt}{value}")  # Show the prompt and input
        return value
    return ""
`;
    }

    return `
${inputSimulation}
${userCode}

# Test execution
try:
    if '${testCase.functionName}' in globals():
        result = ${testCase.functionName}(${args})
        print('__TEST_RESULT__:', result)
    else:
        raise NameError('Function ${testCase.functionName} is not defined')
except Exception as error:
    print('__TEST_ERROR__:', str(error))
    raise error
    `;
  }

  /**
   * Check if API is available for Python execution
   */
  private isApiAvailable(): boolean {
    return this.multiLanguageEngine.isApiConfigured();
  }

  /**
   * Extract test result from language-specific output
   */
  private extractLanguageTestResult(output: string, language: string): any {
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('__TEST_RESULT__:')) {
        try {
          const resultStr = line.split('__TEST_RESULT__:')[1].trim();
          // Try to parse as JSON first
          try {
            return JSON.parse(resultStr);
          } catch {
            // If not JSON, try to parse as number or return as string
            const num = Number(resultStr);
            return !isNaN(num) ? num : resultStr;
          }
        } catch (error) {
          return line.split('__TEST_RESULT__:')[1].trim();
        }
      }
    }
    
    return undefined;
  }

  /**
   * Compare values for equality (same as TestRunner)
   */
  private compareValues(actual: any, expected: any): boolean {
    if (actual === expected) {
      return true;
    }
    
    if (actual === null || expected === null || actual === undefined || expected === undefined) {
      return actual === expected;
    }
    
    if (typeof actual !== typeof expected) {
      if ((typeof actual === 'number' && typeof expected === 'string') ||
          (typeof actual === 'string' && typeof expected === 'number')) {
        return String(actual) === String(expected);
      }
      return false;
    }
    
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
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return this.multiLanguageEngine.getSupportedLanguages();
  }
}