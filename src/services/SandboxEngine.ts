/**
 * SandboxEngine - Secure JavaScript execution environment
 * Provides safe code execution with timeout, error handling, and console capture
 */

export interface ExecutionResult {
  output: string;
  error?: string;
  executionTime: number;
  timedOut: boolean;
}

export interface ConsoleOutput {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: number;
}

export class SandboxEngine {
  private readonly EXECUTION_TIMEOUT = 5000; // 5 seconds
  private readonly MEMORY_LIMIT = 50 * 1024 * 1024; // 50MB

  /**
   * Execute JavaScript code in a secure sandbox environment
   */
  async executeCode(code: string): Promise<ExecutionResult> {
    const startTime = performance.now();
    const consoleOutputs: ConsoleOutput[] = [];
    let timedOut = false;

    try {
      // Create a secure execution context
      const result = await this.runInSandbox(code, consoleOutputs);
      const executionTime = performance.now() - startTime;

      return {
        output: this.formatConsoleOutput(consoleOutputs, result),
        executionTime,
        timedOut
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      if (error instanceof Error && error.message.includes('timeout')) {
        timedOut = true;
        return {
          output: this.formatConsoleOutput(consoleOutputs),
          error: 'Code execution timed out after 5 seconds',
          executionTime,
          timedOut
        };
      }

      return {
        output: this.formatConsoleOutput(consoleOutputs),
        error: this.formatError(error),
        executionTime,
        timedOut
      };
    }
  }

  /**
   * Run code in a sandboxed environment with security restrictions
   */
  private async runInSandbox(code: string, consoleOutputs: ConsoleOutput[]): Promise<any> {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(new Error('Execution timeout'));
      }, this.EXECUTION_TIMEOUT);

      try {
        // Create a restricted global context
        const sandboxGlobals = this.createSandboxGlobals(consoleOutputs);
        
        // Create the execution function with restricted scope
        const executionFunction = new Function(
          ...Object.keys(sandboxGlobals),
          `
          try {
            ${code}
          } catch (error) {
            throw error;
          }
          `
        );

        // Execute the code with the sandbox globals
        const result = executionFunction(...Object.values(sandboxGlobals));
        
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Create a restricted global context for code execution
   */
  private createSandboxGlobals(consoleOutputs: ConsoleOutput[]) {
    // Create a safe console object that captures output
    const safeConsole = {
      log: (...args: any[]) => {
        consoleOutputs.push({
          type: 'log',
          message: args.map(arg => this.stringifyValue(arg)).join(' '),
          timestamp: Date.now()
        });
      },
      error: (...args: any[]) => {
        consoleOutputs.push({
          type: 'error',
          message: args.map(arg => this.stringifyValue(arg)).join(' '),
          timestamp: Date.now()
        });
      },
      warn: (...args: any[]) => {
        consoleOutputs.push({
          type: 'warn',
          message: args.map(arg => this.stringifyValue(arg)).join(' '),
          timestamp: Date.now()
        });
      },
      info: (...args: any[]) => {
        consoleOutputs.push({
          type: 'info',
          message: args.map(arg => this.stringifyValue(arg)).join(' '),
          timestamp: Date.now()
        });
      }
    };

    // Return only safe globals
    return {
      console: safeConsole,
      Math: Math,
      Date: Date,
      JSON: JSON,
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Array: Array,
      Object: Object,
      RegExp: RegExp,
      Error: Error,
      TypeError: TypeError,
      ReferenceError: ReferenceError,
      SyntaxError: SyntaxError,
      // Prevent access to dangerous globals
      window: undefined,
      document: undefined,
      global: undefined,
      process: undefined,
      require: undefined,
      module: undefined,
      exports: undefined,
      fetch: undefined,
      XMLHttpRequest: undefined,
      WebSocket: undefined,
      localStorage: undefined,
      sessionStorage: undefined,
      indexedDB: undefined,
      FileReader: undefined,
      File: undefined,
      Blob: undefined,
      URL: undefined,
      Worker: undefined,
      SharedWorker: undefined,
      ServiceWorker: undefined,
      eval: undefined,
      Function: undefined,
      setTimeout: undefined,
      setInterval: undefined,
      clearTimeout: undefined,
      clearInterval: undefined
    };
  }

  /**
   * Convert values to string representation for console output
   */
  private stringifyValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  /**
   * Format console outputs and result for display
   */
  private formatConsoleOutput(consoleOutputs: ConsoleOutput[], result?: any): string {
    let output = '';

    // Add console outputs
    for (const log of consoleOutputs) {
      const prefix = log.type === 'log' ? '' : `[${log.type.toUpperCase()}] `;
      output += `${prefix}${log.message}\n`;
    }

    // Add final result if it exists and is not undefined
    if (result !== undefined) {
      output += `\n→ ${this.stringifyValue(result)}`;
    }

    return output.trim();
  }

  /**
   * Format error messages for user-friendly display
   */
  private formatError(error: any): string {
    if (error instanceof SyntaxError) {
      return `Syntax Error: ${error.message}`;
    }
    
    if (error instanceof ReferenceError) {
      return `Reference Error: ${error.message}`;
    }
    
    if (error instanceof TypeError) {
      return `Type Error: ${error.message}`;
    }
    
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    
    return `Unknown Error: ${String(error)}`;
  }

  /**
   * Check if code contains potentially dangerous patterns
   */
  private validateCode(code: string): void {
    const dangerousPatterns = [
      /while\s*\(\s*true\s*\)/gi, // Infinite loops
      /for\s*\(\s*;\s*;\s*\)/gi,  // Infinite for loops
      /eval\s*\(/gi,              // eval usage
      /Function\s*\(/gi,          // Function constructor
      /setTimeout|setInterval/gi,  // Timers
      /fetch|XMLHttpRequest/gi,   // Network requests
      /document\.|window\./gi,    // DOM access
      /process\.|require\(/gi,    // Node.js globals
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Potentially dangerous code pattern detected: ${pattern.source}`);
      }
    }
  }
}