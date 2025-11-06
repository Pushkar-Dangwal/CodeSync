/**
 * TestCaseParser - Parse test cases from code comments
 * Supports multiple test case formats and validates syntax
 */

export interface TestCase {
  name: string;
  input: any[];
  expected: any;
  functionName: string;
  line?: number;
}

export interface ParseResult {
  testCases: TestCase[];
  errors: ParseError[];
}

export interface ParseError {
  line: number;
  message: string;
  originalText: string;
}

export class TestCaseParser {
  /**
   * Parse test cases from code comments
   * Supports multiple formats:
   * 1. functionName([arg1, arg2], expected)
   * 2. functionName(arg1, arg2) => expected
   * 3. assert(functionName(arg1, arg2) === expected)
   */
  parseTestCases(code: string): ParseResult {
    const testCases: TestCase[] = [];
    const errors: ParseError[] = [];
    const lines = code.split('\n');
    
    let testIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const lineNumber = i + 1;
      
      // Parse any comment line that might contain a test case
      if (this.isCommentLine(trimmedLine)) {
        const testLine = this.extractCommentContent(trimmedLine);
        
        if (testLine.trim()) {
          const result = this.parseTestCaseLine(testLine, testIndex, lineNumber);
          
          if (result.testCase) {
            testCases.push(result.testCase);
            testIndex++;
          }
          
          if (result.error) {
            errors.push(result.error);
          }
        }
      }
    }

    return { testCases, errors };
  }

  /**
   * Validate test case syntax and structure
   */
  validateTestCase(testCase: TestCase): string[] {
    const errors: string[] = [];

    // Validate function name
    if (!testCase.functionName || !this.isValidIdentifier(testCase.functionName)) {
      errors.push('Invalid function name');
    }

    // Validate test name
    if (!testCase.name || testCase.name.trim().length === 0) {
      errors.push('Test case must have a name');
    }

    // Validate input array
    if (!Array.isArray(testCase.input)) {
      errors.push('Test case input must be an array');
    }

    // Validate expected value exists
    if (testCase.expected === undefined) {
      errors.push('Test case must have an expected value');
    }

    return errors;
  }

  /**
   * Check if a line starts a test section
   */
  private isTestSectionStart(line: string): boolean {
    const testSectionPatterns = [
      /test\s*cases?\s*:/i,
      /tests?\s*:/i,
      /examples?\s*:/i,
      /@test/i
    ];

    return testSectionPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if a line is a comment
   */
  private isCommentLine(line: string): boolean {
    return line.startsWith('//') || line.startsWith('*') || line.startsWith('/*');
  }

  /**
   * Extract content from comment line
   */
  private extractCommentContent(line: string): string {
    if (line.startsWith('//')) {
      return line.substring(2).trim();
    }
    if (line.startsWith('*')) {
      return line.substring(1).trim();
    }
    if (line.startsWith('/*')) {
      return line.substring(2).replace(/\*\/$/, '').trim();
    }
    return line.trim();
  }

  /**
   * Parse a single test case line with multiple format support
   */
  private parseTestCaseLine(line: string, index: number, lineNumber: number): {
    testCase?: TestCase;
    error?: ParseError;
  } {
    // Try different parsing formats
    const parsers = [
      this.parseArrayFormat.bind(this),
      this.parseArrowFormat.bind(this),
      this.parseAssertFormat.bind(this)
    ];

    for (const parser of parsers) {
      try {
        const testCase = parser(line, index, lineNumber);
        if (testCase) {
          return { testCase };
        }
      } catch (error) {
        // Continue to next parser
      }
    }

    // If no parser succeeded, return an error
    return {
      error: {
        line: lineNumber,
        message: 'Unable to parse test case format',
        originalText: line
      }
    };
  }

  /**
   * Parse format: functionName([arg1, arg2], expected)
   */
  private parseArrayFormat(line: string, index: number, lineNumber: number): TestCase | null {
    const match = line.match(/(\w+)\s*\(\s*\[(.*?)\]\s*,\s*(.*?)\s*\)/);
    
    if (match) {
      const [, functionName, argsStr, expectedStr] = match;
      
      try {
        // Parse arguments
        const input = argsStr.trim() ? JSON.parse(`[${argsStr}]`) : [];
        
        // Parse expected result
        const expected = this.parseValue(expectedStr);
        
        return {
          name: `Test ${index + 1}`,
          input,
          expected,
          functionName,
          line: lineNumber
        };
      } catch (error) {
        throw new Error(`Failed to parse array format: ${error}`);
      }
    }

    return null;
  }

  /**
   * Parse format: functionName(arg1, arg2) => expected
   */
  private parseArrowFormat(line: string, index: number, lineNumber: number): TestCase | null {
    // More flexible regex to handle various arrow formats
    const match = line.match(/(\w+)\s*\(\s*(.*?)\s*\)\s*=>\s*(.+)/);
    
    if (match) {
      const [, functionName, argsStr, expectedStr] = match;
      
      try {
        // Parse arguments - handle both comma-separated and space-separated
        let input: any[] = [];
        if (argsStr.trim()) {
          // Split by comma first, then clean up each argument
          const args = argsStr.split(',').map(arg => arg.trim());
          input = args.map(arg => {
            // Try to parse as number first
            const num = Number(arg);
            if (!isNaN(num)) {
              return num;
            }
            // Try JSON parse for strings, objects, etc.
            try {
              return JSON.parse(arg);
            } catch {
              // Return as string if all else fails
              return arg;
            }
          });
        }
        
        // Parse expected result
        const expected = this.parseValue(expectedStr.trim());
        
        return {
          name: `Test ${index + 1}`,
          input,
          expected,
          functionName,
          line: lineNumber
        };
      } catch (error) {
        throw new Error(`Failed to parse arrow format: ${error}`);
      }
    }

    return null;
  }

  /**
   * Parse format: assert(functionName(arg1, arg2) === expected)
   */
  private parseAssertFormat(line: string, index: number, lineNumber: number): TestCase | null {
    const match = line.match(/assert\s*\(\s*(\w+)\s*\(\s*(.*?)\s*\)\s*===?\s*(.*?)\s*\)/);
    
    if (match) {
      const [, functionName, argsStr, expectedStr] = match;
      
      try {
        // Parse arguments
        const input = argsStr.trim() ? this.parseArgumentList(argsStr) : [];
        
        // Parse expected result
        const expected = this.parseValue(expectedStr);
        
        return {
          name: `Test ${index + 1}`,
          input,
          expected,
          functionName,
          line: lineNumber
        };
      } catch (error) {
        throw new Error(`Failed to parse assert format: ${error}`);
      }
    }

    return null;
  }

  /**
   * Parse a comma-separated argument list
   */
  private parseArgumentList(argsStr: string): any[] {
    if (!argsStr.trim()) {
      return [];
    }

    try {
      // Use JSON.parse with array wrapper to handle the arguments
      return JSON.parse(`[${argsStr}]`);
    } catch (error) {
      // Fallback: split by comma and parse each argument
      return argsStr.split(',').map(arg => this.parseValue(arg.trim()));
    }
  }

  /**
   * Parse a single value (string, number, boolean, object, array)
   */
  private parseValue(valueStr: string): any {
    const trimmed = valueStr.trim();
    
    // Handle null and undefined
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;
    
    // Handle booleans
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    
    // Try JSON parsing first (handles strings, numbers, objects, arrays)
    try {
      return JSON.parse(trimmed);
    } catch {
      // If JSON parsing fails, treat as string (remove quotes if present)
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      
      // Try parsing as number
      const num = Number(trimmed);
      if (!isNaN(num)) {
        return num;
      }
      
      // Return as string
      return trimmed;
    }
  }

  /**
   * Check if a string is a valid JavaScript identifier
   */
  private isValidIdentifier(name: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
  }

  /**
   * Get supported test case formats for documentation
   */
  getSupportedFormats(): string[] {
    return [
      'functionName([arg1, arg2], expected)',
      'functionName(arg1, arg2) => expected',
      'assert(functionName(arg1, arg2) === expected)'
    ];
  }
}