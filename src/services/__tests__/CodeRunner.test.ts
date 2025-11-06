/**
 * Tests for CodeRunner
 */

import { CodeRunner } from '../CodeRunner';

describe('CodeRunner', () => {
  let codeRunner: CodeRunner;

  beforeEach(() => {
    codeRunner = new CodeRunner();
  });

  test('should execute code successfully', async () => {
    const code = 'console.log("Hello from CodeRunner");';
    const result = await codeRunner.executeCode(code);
    
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('Hello from CodeRunner');
  });

  test('should parse test cases from comments', () => {
    const code = `
      // Test Cases:
      // add([1, 2], 3)
      // add([5, -3], 2)
      // add([0, 0], 0)
      
      function add(a, b) {
        return a + b;
      }
    `;
    
    const testCases = codeRunner.parseTestCases(code);
    
    expect(testCases).toHaveLength(3);
    expect(testCases[0]).toEqual({
      name: 'Test 1',
      input: [1, 2],
      expected: 3,
      functionName: 'add'
    });
  });

  test('should run test cases successfully', async () => {
    const code = `
      function add(a, b) {
        return a + b;
      }
    `;
    
    const testCases = [
      {
        name: 'Test 1',
        input: [1, 2],
        expected: 3,
        functionName: 'add'
      },
      {
        name: 'Test 2',
        input: [5, -3],
        expected: 2,
        functionName: 'add'
      }
    ];
    
    const results = await codeRunner.runTests(code, testCases);
    
    expect(results).toHaveLength(2);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(true);
  });

  test('should detect failing test cases', async () => {
    const code = `
      function add(a, b) {
        return a * b; // Wrong implementation
      }
    `;
    
    const testCases = [
      {
        name: 'Test 1',
        input: [1, 2],
        expected: 3,
        functionName: 'add'
      }
    ];
    
    const results = await codeRunner.runTests(code, testCases);
    
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].actual).toBe(2);
  });
});