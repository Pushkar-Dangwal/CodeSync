/**
 * MultiLanguageEngine - Execute code in multiple programming languages
 * Supports JavaScript (local) and Python (via RapidAPI OneCompiler)
 * 
 * Setup: Add VITE_RAPIDAPI_KEY to your .env file
 * Get your key from: https://rapidapi.com/onecompiler-onecompiler-default/api/onecompiler-apis
 */

export interface LanguageExecutionResult {
  output: string;
  error?: string;
  executionTime: number;
  timedOut: boolean;
  language: string;
}

export interface PythonTestCase {
  name: string;
  input: any[];
  expected: any;
  functionName: string;
  line?: number;
}

export class MultiLanguageEngine {

  /**
   * Execute code based on the detected/specified language
   */
  async executeCode(code: string, language: string, stdin?: string): Promise<LanguageExecutionResult> {
    const startTime = performance.now();
    
    try {
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'js':
          return await this.executeJavaScript(code);
        
        case 'python':
        case 'py':
          return await this.executePython(code, stdin);
        
        case 'java':
          return await this.executeJava(code, stdin);
        
        default:
          return {
            output: '',
            error: `Language "${language}" is not supported yet. Supported languages: JavaScript, Python`,
            executionTime: performance.now() - startTime,
            timedOut: false,
            language
          };
      }
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: performance.now() - startTime,
        timedOut: false,
        language
      };
    }
  }

  /**
   * Execute JavaScript code locally using existing SandboxEngine
   */
  private async executeJavaScript(code: string): Promise<LanguageExecutionResult> {
    const startTime = performance.now();
    
    try {
      // Use the existing sandbox execution logic
      const result = await this.runJavaScriptInSandbox(code);
      
      return {
        output: result.output,
        error: result.error,
        executionTime: performance.now() - startTime,
        timedOut: result.timedOut || false,
        language: 'javascript'
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : 'JavaScript execution failed',
        executionTime: performance.now() - startTime,
        timedOut: false,
        language: 'javascript'
      };
    }
  }

  /**
   * Execute Java code using online API
   */
  private async executeJava(code: string, stdin?: string): Promise<LanguageExecutionResult> {
    const startTime = performance.now();
    
    try {
      // Use RapidAPI OneCompiler for Java execution
      const response = await this.callJavaAPI(code, stdin);
      
      return {
        output: response.output || '',
        error: response.error,
        executionTime: performance.now() - startTime,
        timedOut: false,
        language: 'java'
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : 'Java execution failed',
        executionTime: performance.now() - startTime,
        timedOut: false,
        language: 'java'
      };
    }
  }

  /**
   * Execute Python code using online API
   */
  private async executePython(code: string, stdin?: string): Promise<LanguageExecutionResult> {
    const startTime = performance.now();
    
    try {
      // Use RapidAPI OneCompiler for Python execution
      const response = await this.callPythonAPI(code, stdin);
      
      return {
        output: response.output || '',
        error: response.error,
        executionTime: performance.now() - startTime,
        timedOut: false,
        language: 'python'
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : 'Python execution failed',
        executionTime: performance.now() - startTime,
        timedOut: false,
        language: 'python'
      };
    }
  }

  /**
   * Call Java execution API using RapidAPI OneCompiler
   */
  private async callJavaAPI(code: string, stdin?: string): Promise<{ output?: string; error?: string }> {
    try {
      // Using RapidAPI OneCompiler API for Java
      const response = await fetch('https://onecompiler-apis.p.rapidapi.com/api/v1/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': import.meta.env.VITE_RAPIDAPI_KEY || 'demo-key-limited-usage',
          'X-RapidAPI-Host': 'onecompiler-apis.p.rapidapi.com'
        },
        body: JSON.stringify({
          language: 'java',
          stdin: stdin || '',
          files: [
            {
              name: 'Main.java',
              content: code
            }
          ]
        })
      });

      if (!response.ok) {
        console.warn('RapidAPI request failed for Java');
        return {
          output: '',
          error: 'Java execution requires a valid RapidAPI key. Please set VITE_RAPIDAPI_KEY in your .env file.'
        };
      }

      const result = await response.json();
      
      // Handle OneCompiler API response format
      if (result.status === 'success') {
        return {
          output: result.stdout || '',
          error: result.stderr || undefined
        };
      } else {
        return {
          output: '',
          error: result.stderr || result.exception || 'Java execution failed'
        };
      }
    } catch (error) {
      console.warn('Java API call failed:', error);
      return {
        output: '',
        error: 'Java execution failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  /**
   * Call Python execution API
   */
  private async callPythonAPI(code: string, stdin?: string): Promise<{ output?: string; error?: string }> {
    try {
      // Using RapidAPI OneCompiler API
      const response = await fetch('https://onecompiler-apis.p.rapidapi.com/api/v1/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': import.meta.env.VITE_RAPIDAPI_KEY || 'demo-key-limited-usage',
          'X-RapidAPI-Host': 'onecompiler-apis.p.rapidapi.com'
        },
        body: JSON.stringify({
          language: 'python',
          stdin: stdin || '',
          files: [
            {
              name: 'main.py',
              content: code
            }
          ]
        })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.warn('RapidAPI authentication failed. Please check your API key.');
          return {
            output: '',
            error: 'Python execution requires a valid RapidAPI key. Please set REACT_APP_RAPIDAPI_KEY in your .env file.'
          };
        }
        console.warn('RapidAPI request failed, falling back to simulation');
        return this.simulatePythonExecution(code, stdin);
      }

      const result = await response.json();
      
      // Handle OneCompiler API response format
      if (result.status === 'success') {
        return {
          output: result.stdout || '',
          error: result.stderr || undefined
        };
      } else {
        return {
          output: '',
          error: result.stderr || result.exception || 'Execution failed'
        };
      }
    } catch (error) {
      console.warn('API call failed:', error);
      // Fallback to simulation if API fails
      return this.simulatePythonExecution(code, stdin);
    }
  }

  /**
   * Simulate Python execution for basic cases (fallback)
   */
  private simulatePythonExecution(code: string, stdin?: string): { output?: string; error?: string } {
    try {
      let output = '';
      const variables: { [key: string]: any } = {};
      
      // Parse stdin inputs if provided
      const stdinInputs = stdin ? stdin.split('\n').map(inp => inp.trim()).filter(inp => inp) : [];
      let inputIndex = 0;
      
      // Split code into lines and execute sequentially
      const lines = code.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
      
      for (const line of lines) {
        // Handle variable assignments
        const assignMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
        if (assignMatch) {
          const [, varName, expression] = assignMatch;
          try {
            // Handle special Python expressions
            const value = this.evaluatePythonExpression(expression.trim(), variables);
            variables[varName] = value;
          } catch (error) {
            // For complex expressions, try basic simulation
            if (expression.includes('input(')) {
              // Simulate input() calls using provided stdin
              if (inputIndex < stdinInputs.length) {
                variables[varName] = stdinInputs[inputIndex];
                inputIndex++;
              } else {
                variables[varName] = '1,2,3'; // Default fallback
              }
            } else if (expression.includes('.split(')) {
              // Handle string.split() operations
              const baseVar = expression.match(/(\w+)\.split\(/)?.[1];
              if (baseVar && variables[baseVar]) {
                const splitChar = expression.match(/split\s*\(\s*["']([^"']+)["']\s*\)/)?.[1] || ',';
                variables[varName] = String(variables[baseVar]).split(splitChar);
              }
            } else if (expression.includes('[') && expression.includes('for')) {
              // Handle list comprehensions - basic simulation
              const listVar = expression.match(/\[.*?for\s+\w+\s+in\s+(\w+)\]/)?.[1];
              if (listVar && variables[listVar] && Array.isArray(variables[listVar])) {
                // Simulate int conversion for list comprehension
                if (expression.includes('int(')) {
                  variables[varName] = variables[listVar].map((x: any) => parseInt(String(x).trim()) || 0);
                } else {
                  variables[varName] = variables[listVar];
                }
              }
            }
          }
          continue;
        }
        
        // Handle print statements
        const printMatch = line.match(/^print\s*\(\s*([^)]+)\s*\)$/);
        if (printMatch) {
          const content = printMatch[1].trim();
          try {
            const value = this.evaluatePythonExpression(content, variables);
            output += String(value) + '\n';
          } catch (error) {
            // If evaluation fails, try to handle as string literal
            if ((content.startsWith('"') && content.endsWith('"')) || 
                (content.startsWith("'") && content.endsWith("'"))) {
              output += content.slice(1, -1) + '\n';
            } else {
              output += content + '\n';
            }
          }
        }
      }
      
      // Handle simple function definitions and calls
      const functionMatch = code.match(/def\s+(\w+)\s*\([^)]*\):\s*\n?\s*return\s+([^#\n]+)/);
      if (functionMatch) {
        const [, funcName, returnExpr] = functionMatch;
        
        // Look for function calls
        const callMatch = code.match(new RegExp(`${funcName}\\s*\\(([^)]*)\\)`));
        if (callMatch) {
          const args = callMatch[1].split(',').map(arg => arg.trim());
          
          // Very basic expression evaluation
          let result = returnExpr.trim();
          
          // Replace parameter names with actual values (very basic)
          if (result.includes('+')) {
            const parts = result.split('+').map(part => part.trim());
            if (parts.length === 2) {
              const val1 = isNaN(Number(args[0])) ? args[0] : Number(args[0]);
              const val2 = isNaN(Number(args[1])) ? args[1] : Number(args[1]);
              if (typeof val1 === 'number' && typeof val2 === 'number') {
                output += (val1 + val2).toString();
              }
            }
          }
        }
      }
      
      return { output: output || 'Code executed (no output)' };
    } catch (error) {
      return { error: 'Python simulation failed: ' + (error instanceof Error ? error.message : 'Unknown error') };
    }
  }

  /**
   * Evaluate simple Python expressions
   */
  private evaluatePythonExpression(expression: string, variables: { [key: string]: any }): any {
    // Handle string literals
    if ((expression.startsWith('"') && expression.endsWith('"')) || 
        (expression.startsWith("'") && expression.endsWith("'"))) {
      return expression.slice(1, -1);
    }
    
    // Handle numbers
    const num = Number(expression);
    if (!isNaN(num)) {
      return num;
    }
    
    // Handle variables
    if (variables.hasOwnProperty(expression)) {
      return variables[expression];
    }
    
    // Handle Python built-in functions
    if (expression.startsWith('sum(') && expression.endsWith(')')) {
      const varName = expression.match(/sum\s*\(\s*(\w+)\s*\)/)?.[1];
      if (varName && variables[varName] && Array.isArray(variables[varName])) {
        return variables[varName].reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
      }
    }
    
    if (expression.startsWith('len(') && expression.endsWith(')')) {
      const varName = expression.match(/len\s*\(\s*(\w+)\s*\)/)?.[1];
      if (varName && variables[varName]) {
        return Array.isArray(variables[varName]) ? variables[varName].length : String(variables[varName]).length;
      }
    }
    
    // Handle simple arithmetic expressions
    if (expression.includes('+')) {
      const parts = expression.split('+').map(part => part.trim());
      if (parts.length === 2) {
        const left = this.evaluatePythonExpression(parts[0], variables);
        const right = this.evaluatePythonExpression(parts[1], variables);
        return left + right;
      }
    }
    
    if (expression.includes('-')) {
      const parts = expression.split('-').map(part => part.trim());
      if (parts.length === 2) {
        const left = this.evaluatePythonExpression(parts[0], variables);
        const right = this.evaluatePythonExpression(parts[1], variables);
        return left - right;
      }
    }
    
    if (expression.includes('*')) {
      const parts = expression.split('*').map(part => part.trim());
      if (parts.length === 2) {
        const left = this.evaluatePythonExpression(parts[0], variables);
        const right = this.evaluatePythonExpression(parts[1], variables);
        return left * right;
      }
    }
    
    if (expression.includes('/')) {
      const parts = expression.split('/').map(part => part.trim());
      if (parts.length === 2) {
        const left = this.evaluatePythonExpression(parts[0], variables);
        const right = this.evaluatePythonExpression(parts[1], variables);
        return left / right;
      }
    }
    
    // Return as-is if can't evaluate
    return expression;
  }

  /**
   * JavaScript sandbox execution (replicating SandboxEngine logic)
   */
  private async runJavaScriptInSandbox(code: string): Promise<{ output: string; error?: string; timedOut?: boolean }> {
    return new Promise((resolve) => {
      const consoleOutputs: string[] = [];
      
      // Create a safe console object
      const safeConsole = {
        log: (...args: any[]) => {
          consoleOutputs.push(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        }
      };

      try {
        // Create execution function
        const executionFunction = new Function(
          'console',
          `
          try {
            ${code}
          } catch (error) {
            throw error;
          }
          `
        );

        // Execute with safe console
        const result = executionFunction(safeConsole);
        
        let output = '';
        if (consoleOutputs.length > 0) {
          output = consoleOutputs.join('\n');
        } else if (result !== undefined) {
          output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        } else {
          output = 'Code executed successfully (no output)';
        }

        resolve({ output });
      } catch (error) {
        resolve({ 
          output: consoleOutputs.join('\n'),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  /**
   * Parse test cases for different languages
   */
  parseTestCases(code: string, language: string): PythonTestCase[] {
    const testCases: PythonTestCase[] = [];
    const lines = code.split('\n');
    
    let testIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;
      
      // Parse comment lines for test cases
      if (this.isCommentLine(line, language)) {
        const testLine = this.extractCommentContent(line, language);
        const testCase = this.parseTestCaseLine(testLine, testIndex, lineNumber, language);
        
        if (testCase) {
          testCases.push(testCase);
          testIndex++;
        }
      }
    }

    return testCases;
  }

  /**
   * Check if line is a comment based on language
   */
  private isCommentLine(line: string, language: string): boolean {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
        return line.startsWith('//') || line.startsWith('/*');
      case 'python':
      case 'py':
        return line.startsWith('#');
      default:
        return line.startsWith('//') || line.startsWith('#');
    }
  }

  /**
   * Extract comment content based on language
   */
  private extractCommentContent(line: string, language: string): string {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
        if (line.startsWith('//')) {
          return line.substring(2).trim();
        }
        if (line.startsWith('/*')) {
          return line.substring(2).replace(/\*\/$/, '').trim();
        }
        break;
      case 'python':
      case 'py':
        if (line.startsWith('#')) {
          return line.substring(1).trim();
        }
        break;
    }
    return line.trim();
  }

  /**
   * Parse test case line for different languages
   */
  private parseTestCaseLine(line: string, index: number, lineNumber: number, _language: string): PythonTestCase | null {
    // Universal arrow format: functionName(args) => expected
    const match = line.match(/(\w+)\s*\(\s*(.*?)\s*\)\s*=>\s*(.+)/);
    
    if (match) {
      const [, functionName, argsStr, expectedStr] = match;
      
      try {
        // Parse arguments
        let input: any[] = [];
        if (argsStr.trim()) {
          const args = argsStr.split(',').map(arg => arg.trim());
          input = args.map(arg => {
            const num = Number(arg);
            if (!isNaN(num)) {
              return num;
            }
            try {
              return JSON.parse(arg);
            } catch {
              return arg;
            }
          });
        }
        
        // Parse expected result
        let expected: any;
        try {
          expected = JSON.parse(expectedStr.trim());
        } catch {
          const num = Number(expectedStr.trim());
          expected = !isNaN(num) ? num : expectedStr.trim();
        }
        
        return {
          name: `Test ${index + 1}`,
          input,
          expected,
          functionName,
          line: lineNumber
        };
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return ['javascript', 'python', 'java'];
  }

  /**
   * Check if RapidAPI is properly configured
   */
  isApiConfigured(): boolean {
    const apiKey = import.meta.env.VITE_RAPIDAPI_KEY;
    return !!(apiKey && apiKey !== 'demo-key-limited-usage' && apiKey !== 'your_rapidapi_key_here');
  }

  /**
   * Get API configuration status
   */
  getApiStatus(): { configured: boolean; message: string } {
    if (this.isApiConfigured()) {
      return {
        configured: true,
        message: 'RapidAPI OneCompiler is configured and ready'
      };
    } else {
      return {
        configured: false,
        message: 'RapidAPI key not configured. Python execution will use basic simulation. Add REACT_APP_RAPIDAPI_KEY to .env for full Python support.'
      };
    }
  }
}