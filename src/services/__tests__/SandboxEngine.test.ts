/**
 * Tests for SandboxEngine
 */

import { SandboxEngine } from '../SandboxEngine';

describe('SandboxEngine', () => {
  let sandboxEngine: SandboxEngine;

  beforeEach(() => {
    sandboxEngine = new SandboxEngine();
  });

  test('should execute simple JavaScript code', async () => {
    const code = 'console.log("Hello, World!");';
    const result = await sandboxEngine.executeCode(code);
    
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('Hello, World!');
    expect(result.timedOut).toBe(false);
    expect(result.executionTime).toBeGreaterThan(0);
  });

  test('should capture console output', async () => {
    const code = `
      console.log("First message");
      console.error("Error message");
      console.warn("Warning message");
    `;
    const result = await sandboxEngine.executeCode(code);
    
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('First message');
    expect(result.output).toContain('[ERROR] Error message');
    expect(result.output).toContain('[WARN] Warning message');
  });

  test('should return function results', async () => {
    const code = `
      function add(a, b) {
        return a + b;
      }
      add(2, 3);
    `;
    const result = await sandboxEngine.executeCode(code);
    
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('→ 5');
  });

  test('should handle syntax errors', async () => {
    const code = 'function invalid( {';
    const result = await sandboxEngine.executeCode(code);
    
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Syntax Error');
  });

  test('should handle runtime errors', async () => {
    const code = 'throw new Error("Test error");';
    const result = await sandboxEngine.executeCode(code);
    
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Test error');
  });

  test('should prevent access to dangerous globals', async () => {
    const code = 'console.log(typeof window, typeof document, typeof process);';
    const result = await sandboxEngine.executeCode(code);
    
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('undefined undefined undefined');
  });
});