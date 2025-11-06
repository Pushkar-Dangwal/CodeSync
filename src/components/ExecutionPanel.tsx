import React, { useState, useEffect } from 'react';
import TestCaseInput from './TestCaseInput';
import './ExecutionPanel.css';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import { CodeRunner } from '../services';
import type { TestSuiteResult, TestExecutionResult, LanguageExecutionResult } from '../services';
import { useRecoilValue } from 'recoil';
import { language } from '../atoms';

interface ExecutionPanelProps {
  code: string;
  isVisible: boolean;
  onToggle: () => void;
  sharedTestCases?: Array<{
    functionName: string;
    inputs: string;
    expected: string;
    name: string;
    userInputs?: string;
    programInputs?: string;
    expectedOutput?: string;
  }>;
  onTestCasesChange?: (testCases: Array<{
    functionName: string;
    inputs: string;
    expected: string;
    name: string;
    userInputs?: string;
    programInputs?: string;
    expectedOutput?: string;
  }>) => void;
}

interface ExecutionResult {
  output: string;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

interface ExecutionError {
  message: string;
  line?: number;
  column?: number;
  stack?: string;
}

type ExecutionMode = 'code' | 'tests';

const ExecutionPanel: React.FC<ExecutionPanelProps> = ({ 
  code, 
  isVisible, 
  onToggle,
  sharedTestCases = [],
  onTestCasesChange
}) => {
  const currentLanguage = useRecoilValue(language);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ExecutionResult[]>([]);
  const [testResults, setTestResults] = useState<TestSuiteResult | null>(null);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('code');
  const [codeRunner] = useState(() => new CodeRunner());
  const [showTestCreator, setShowTestCreator] = useState(false);
  const [customTestCases, setCustomTestCases] = useState<Array<{
    functionName: string;
    inputs: string;
    expected: string;
    name: string;
    userInputs?: string;
    programInputs?: string;
    expectedOutput?: string;
  }>>([]);
  const [newTestCase, setNewTestCase] = useState({
    functionName: '',
    inputs: '',
    expected: '',
    name: '',
    userInputs: '',
    programInputs: '',
    expectedOutput: ''
  });
  const [stdinInput, setStdinInput] = useState('');

  // Sync shared test cases with local state
  useEffect(() => {
    if (sharedTestCases.length > 0) {
      console.log('Syncing shared test cases to local state:', sharedTestCases);
      setCustomTestCases(sharedTestCases);
    }
  }, [sharedTestCases]);

  // Notify parent when local test cases change
  useEffect(() => {
    if (onTestCasesChange && customTestCases.length > 0) {
      console.log('Notifying parent of test case changes:', customTestCases);
      onTestCasesChange(customTestCases);
    }
  }, [customTestCases, onTestCasesChange]);

  const MAX_RESULTS = 10; // Limit history to prevent memory issues

  const parseError = (error: string): ExecutionError => {
    // Try to extract line and column numbers from error message
    const lineMatch = error.match(/line (\d+)/i) || error.match(/:(\d+):/);
    const columnMatch = error.match(/column (\d+)/i) || error.match(/:(\d+):(\d+)/);
    
    return {
      message: error,
      line: lineMatch ? parseInt(lineMatch[1]) : undefined,
      column: columnMatch && columnMatch[2] ? parseInt(columnMatch[2]) : undefined,
      stack: error.includes('\n') ? error : undefined
    };
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString();
  };

  const SyntaxHighlightedCode: React.FC<{ code: string; language: string }> = ({ code, language }) => {
    useEffect(() => {
      Prism.highlightAll();
    }, [code]);

    return (
      <pre className={`language-${language}`}>
        <code className={`language-${language}`}>
          {code}
        </code>
      </pre>
    );
  };

  const TestResultItem: React.FC<{ result: TestExecutionResult; index: number }> = ({ result }) => {
    return (
      <div className={`test-result-item ${result.passed ? 'passed' : 'failed'}`}>
        <div className="test-result-header">
          <div className="test-info">
            <span className="test-name">{result.testCase.name}</span>
            <span className="test-function">{result.testCase.functionName}({result.testCase.input.map(arg => JSON.stringify(arg)).join(', ')})</span>
          </div>
          <div className="test-status">
            <span className={`status-indicator ${result.passed ? 'passed' : 'failed'}`}>
              {result.passed ? '✅ PASS' : '❌ FAIL'}
            </span>
            <span className="test-time">{result.executionTime.toFixed(1)}ms</span>
          </div>
        </div>
        
        <div className="test-result-body">
          <div className="test-expectation">
            <span className="label">Expected:</span>
            <span className="value">{JSON.stringify(result.testCase.expected)}</span>
          </div>
          
          {!result.passed && (
            <div className="test-actual">
              <span className="label">Actual:</span>
              <span className="value">{result.actual !== undefined ? JSON.stringify(result.actual) : 'undefined'}</span>
            </div>
          )}
          
          {result.error && (
            <div className="test-error">
              <span className="label">Error:</span>
              <span className="error-message">{result.error}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const TestSummary: React.FC<{ testResults: TestSuiteResult }> = ({ testResults }) => {
    const passRate = testResults.totalTests > 0 ? (testResults.passedTests / testResults.totalTests) * 100 : 0;
    
    return (
      <div className="test-summary">
        <div className="summary-header">
          <h4>Test Results Summary</h4>
          <span className="total-time">{testResults.totalExecutionTime.toFixed(1)}ms</span>
        </div>
        
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Total Tests:</span>
            <span className="stat-value">{testResults.totalTests}</span>
          </div>
          <div className="stat-item passed">
            <span className="stat-label">Passed:</span>
            <span className="stat-value">{testResults.passedTests}</span>
          </div>
          <div className="stat-item failed">
            <span className="stat-label">Failed:</span>
            <span className="stat-value">{testResults.failedTests}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Pass Rate:</span>
            <span className="stat-value">{passRate.toFixed(1)}%</span>
          </div>
        </div>
        
        {testResults.hasParseErrors && (
          <div className="parse-errors">
            <h5>Parse Errors:</h5>
            {testResults.parseErrors.map((error, index) => (
              <div key={index} className="parse-error">
                <span className="error-line">Line {error.line}:</span>
                <span className="error-text">{error.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const TestCaseCreator: React.FC = () => {
    return (
      <div className="test-case-creator">
        <div className="creator-header">
          <h4>Create Custom Test Cases</h4>
          <button 
            className="toggle-creator-btn"
            onClick={() => setShowTestCreator(!showTestCreator)}
          >
            {showTestCreator ? '▲ Hide' : '▼ Show'}
          </button>
        </div>
        
        {showTestCreator && (
          <div className="creator-content">
            <div className="test-form">
              {(currentLanguage === 'python' || currentLanguage === 'java') ? (
                // Python/Java: Only program input/output testing
                <>
                  <div className="form-row">
                    <TestCaseInput
                      placeholder="Test name (optional)"
                      value={newTestCase.name}
                      onChange={(value) => setNewTestCase(prev => ({ ...prev, name: value }))}
                      className="form-input"
                    />
                  </div>
                  <div className="form-row">
                    <TestCaseInput
                      placeholder="Program inputs (e.g., 1,3,5)"
                      value={newTestCase.programInputs}
                      onChange={(value) => setNewTestCase(prev => ({ ...prev, programInputs: value }))}
                      className="form-input"
                      title="Inputs exactly as user would type them"
                    />
                    <TestCaseInput
                      placeholder="Expected program output"
                      value={newTestCase.expectedOutput}
                      onChange={(value) => setNewTestCase(prev => ({ ...prev, expectedOutput: value }))}
                      className="form-input"
                      title="Expected output from the entire program"
                      required
                    />
                  </div>
                </>
              ) : (
                // JavaScript: Function testing
                <>
                  <div className="form-row">
                    <TestCaseInput
                      placeholder="Test name (optional)"
                      value={newTestCase.name}
                      onChange={(value) => setNewTestCase(prev => ({ ...prev, name: value }))}
                      className="form-input"
                    />
                    <TestCaseInput
                      placeholder="Function name"
                      value={newTestCase.functionName}
                      onChange={(value) => setNewTestCase(prev => ({ ...prev, functionName: value }))}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-row">
                    <TestCaseInput
                      placeholder="Function inputs (e.g., 1, 2, 'hello')"
                      value={newTestCase.inputs}
                      onChange={(value) => setNewTestCase(prev => ({ ...prev, inputs: value }))}
                      className="form-input"
                    />
                    <TestCaseInput
                      placeholder="Expected output"
                      value={newTestCase.expected}
                      onChange={(value) => setNewTestCase(prev => ({ ...prev, expected: value }))}
                      className="form-input"
                      required
                    />
                  </div>
                </>
              )}
              <button 
                className="add-test-btn"
                onClick={addCustomTestCase}
                disabled={
                  (currentLanguage === 'python' || currentLanguage === 'java')
                    ? !newTestCase.expectedOutput
                    : (!newTestCase.functionName || !newTestCase.expected)
                }
              >
                Add Test Case
              </button>
            </div>
            
            {customTestCases.length > 0 && (
              <div className="custom-tests-list">
                <h5>Custom Test Cases ({customTestCases.length})</h5>
                {customTestCases.map((testCase, index) => (
                  <div key={index} className="custom-test-item">
                    <div className="test-details">
                      <span className="test-name">{testCase.name}</span>
                      {(currentLanguage === 'python' || currentLanguage === 'java') ? (
                        <span className="test-signature">
                          Program Input: {testCase.programInputs || 'no input'} → Expected: {testCase.expectedOutput}
                        </span>
                      ) : (
                        <span className="test-signature">
                          {testCase.functionName}({testCase.inputs || 'no args'}) → {testCase.expected}
                        </span>
                      )}
                    </div>
                    <button 
                      className="remove-test-btn"
                      onClick={() => removeCustomTestCase(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      return;
    }

    setIsRunning(true);
    // Clear previous results
    setResults([]);
    const startTime = Date.now();

    try {
      let executionResult: LanguageExecutionResult;
      
      // Use language-aware execution
      if (currentLanguage === 'javascript') {
        const jsResult = await codeRunner.executeCode(code);
        executionResult = {
          ...jsResult,
          language: 'javascript'
        };
      } else {
        // For Python, format stdin inputs (newline-separated)
        const formattedStdin = stdinInput;
        executionResult = await codeRunner.executeCodeWithLanguage(code, currentLanguage, formattedStdin);
      }
      
      const executionTime = Date.now() - startTime;
      
      const result: ExecutionResult = {
        output: executionResult.output,
        error: executionResult.error,
        executionTime,
        timestamp: new Date()
      };

      setResults([result]);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const result: ExecutionResult = {
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime,
        timestamp: new Date()
      };

      setResults(prev => [result, ...prev].slice(0, MAX_RESULTS));
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunTests = async () => {
    if (!code.trim()) {
      return;
    }

    setIsRunning(true);
    // Clear previous test results
    setTestResults(null);

    try {
      const testSuiteResult = await codeRunner.runTestsWithLanguage(code, currentLanguage);
      setTestResults(testSuiteResult);
    } catch (error) {
      // Handle test execution error
      const errorResult: TestSuiteResult = {
        results: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        totalExecutionTime: 0,
        hasParseErrors: true,
        parseErrors: [{
          line: 0,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          originalText: ''
        }]
      };
      setTestResults(errorResult);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    if (executionMode === 'code') {
      setResults([]);
    } else {
      setTestResults(null);
    }
  };

  const addCustomTestCase = () => {
    if (currentLanguage === 'python' || currentLanguage === 'java') {
      // Python/Java: Only program output tests
      if (!newTestCase.expectedOutput) {
        return;
      }
    } else {
      // JavaScript: Function tests
      if (!newTestCase.functionName || !newTestCase.expected) {
        return;
      }
    }

    const testCase = {
      ...newTestCase,
      name: newTestCase.name || `Test ${customTestCases.length + 1}`
    };

    setCustomTestCases(prev => [...prev, testCase]);
    setNewTestCase({
      functionName: '',
      inputs: '',
      expected: '',
      name: '',
      userInputs: '',
      programInputs: '',
      expectedOutput: ''
    });
  };

  const removeCustomTestCase = (index: number) => {
    setCustomTestCases(prev => prev.filter((_, i) => i !== index));
  };

  const runCustomTests = async () => {
    if (customTestCases.length === 0) {
      return;
    }

    setIsRunning(true);
    setTestResults(null);

    try {
      if (currentLanguage === 'python') {
        // Python: Only program tests
        const programTests: any[] = [];
        
        customTestCases.forEach((tc, _index) => {
          if (tc.expectedOutput) {
            programTests.push({
              name: tc.name || `Program Test ${programTests.length + 1}`,
              programInputs: tc.programInputs || '',
              expectedOutput: tc.expectedOutput,
              line: _index + 1
            });
          }
        });

        // Run program tests
        const programResults: any[] = [];
        for (const programTest of programTests) {
          const startTime = performance.now();
          try {
            const formattedStdin = programTest.programInputs || '';
            const executionResult = await codeRunner.executeCodeWithLanguage(code, currentLanguage, formattedStdin);
            const executionTime = performance.now() - startTime;
            
            // Compare entire output
            const actualOutput = executionResult.output.trim();
            const expectedOutput = programTest.expectedOutput.trim();
            const passed = actualOutput === expectedOutput;
            
            programResults.push({
              testCase: {
                name: programTest.name,
                input: [programTest.programInputs || 'no input'],
                expected: expectedOutput,
                functionName: 'program',
                line: programTest.line
              },
              passed,
              actual: actualOutput,
              executionTime,
              output: executionResult.output
            });
          } catch (error) {
            const executionTime = performance.now() - startTime;
            programResults.push({
              testCase: {
                name: programTest.name,
                input: [programTest.programInputs || 'no input'],
                expected: programTest.expectedOutput,
                functionName: 'program',
                line: programTest.line
              },
              passed: false,
              error: error instanceof Error ? error.message : String(error),
              executionTime
            });
          }
        }

        const testSuiteResult: TestSuiteResult = {
          results: programResults,
          totalTests: programResults.length,
          passedTests: programResults.filter(r => r.passed).length,
          failedTests: programResults.filter(r => !r.passed).length,
          totalExecutionTime: programResults.reduce((sum, r) => sum + r.executionTime, 0),
          hasParseErrors: false,
          parseErrors: []
        };

        setTestResults(testSuiteResult);
      } else {
        // JavaScript: Function tests
        const functionTests: any[] = [];
        
        customTestCases.forEach((tc, _index) => {
          if (tc.functionName && tc.expected) {
            let inputs: any[] = [];
            try {
              inputs = tc.inputs.trim() ? JSON.parse(`[${tc.inputs}]`) : [];
            } catch (error) {
              inputs = tc.inputs.split(',').map(arg => {
                const trimmed = arg.trim();
                try {
                  return JSON.parse(trimmed);
                } catch {
                  return trimmed;
                }
              });
            }

            let expected: any;
            try {
              expected = JSON.parse(tc.expected);
            } catch {
              expected = tc.expected;
            }

            functionTests.push({
              name: tc.name,
              input: inputs,
              expected: expected,
              functionName: tc.functionName,
              line: _index + 1
            });
          }
        });

        // Run function tests
        const functionTestSuite = await codeRunner.runTestsWithLanguage(code, currentLanguage, functionTests);
        setTestResults(functionTestSuite);
      }


    } catch (error) {
      const errorResult: TestSuiteResult = {
        results: [],
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        totalExecutionTime: 0,
        hasParseErrors: true,
        parseErrors: [{
          line: 0,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          originalText: ''
        }]
      };
      setTestResults(errorResult);
    } finally {
      setIsRunning(false);
    }
  };

  // Listen for keyboard shortcut execution
  useEffect(() => {
    const handleExecuteCode = (event: CustomEvent) => {
      if (event.detail?.code && isVisible) {
        handleRunCode();
      }
    };

    window.addEventListener('executeCode', handleExecuteCode as EventListener);
    return () => {
      window.removeEventListener('executeCode', handleExecuteCode as EventListener);
    };
  }, [isVisible, code]);

  return (
    <div className={`execution-panel ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="execution-header">
        <h3>Code Execution</h3>
        <button 
          className="toggle-btn"
          onClick={onToggle}
          aria-label={isVisible ? 'Hide execution panel' : 'Show execution panel'}
        >
          {isVisible ? '▼' : '▲'}
        </button>
      </div>

      {isVisible && (
        <div className="execution-content">
          <div className="execution-controls">
            <div className="mode-selector">
              <button 
                className={`mode-btn ${executionMode === 'code' ? 'active' : ''}`}
                onClick={() => setExecutionMode('code')}
              >
                Run Code
              </button>
              <button 
                className={`mode-btn ${executionMode === 'tests' ? 'active' : ''}`}
                onClick={() => setExecutionMode('tests')}
              >
                Run Tests
              </button>
            </div>
            
            {/* Only show comment tests button for JavaScript */}
            {!(executionMode === 'tests' && (currentLanguage === 'python' || currentLanguage === 'java')) && (
              <button 
                className="run-btn"
                onClick={executionMode === 'code' ? handleRunCode : handleRunTests}
                disabled={isRunning || !code.trim()}
                title={executionMode === 'code' ? "Run code (Ctrl+Enter)" : "Run tests from comments (Ctrl+Shift+Enter)"}
              >
                {isRunning ? (
                  <>
                    <span className="spinner"></span>
                    Running...
                  </>
                ) : (
                  executionMode === 'code' ? '▶️ Run Code' : '🧪 Run Comment Tests'
                )}
              </button>
            )}
            
            {executionMode === 'tests' && customTestCases.length > 0 && (
              <button 
                className="run-custom-tests-btn"
                onClick={runCustomTests}
                disabled={isRunning || !code.trim()}
                title="Run custom test cases"
              >
                {isRunning ? (
                  <>
                    <span className="spinner"></span>
                    Running...
                  </>
                ) : (
                  `🎯 Run Custom Tests (${customTestCases.length})`
                )}
              </button>
            )}
            
            {((executionMode === 'code' && results.length > 0) || (executionMode === 'tests' && testResults)) && (
              <button 
                className="clear-btn"
                onClick={clearResults}
                title="Clear results"
              >
                🗑️ Clear Results
              </button>
            )}
            
            <div className="keyboard-shortcuts">
              <span className="shortcut-hint">
                Ctrl+Enter: Run {executionMode === 'code' ? 'Code' : 'Tests'} • Ctrl+Shift+E: Toggle Panel
              </span>
            </div>
          </div>

          {executionMode === 'code' && (currentLanguage === 'python' || currentLanguage === 'java') && (
            <div className="stdin-input-section">
              <label className="stdin-label">
                {currentLanguage === 'java' ? 'Java' : 'Python'} Inputs (for input calls):
                <div className="stdin-input-container">
                  <TestCaseInput
                    placeholder="Enter inputs separated by commas (e.g., 5, hello, 3.14)"
                    value={stdinInput}
                    onChange={setStdinInput}
                    className="stdin-input"
                    title="Inputs that will be provided to input() function calls"
                  />
                  {stdinInput && (
                    <button
                      className="clear-stdin-btn"
                      onClick={() => setStdinInput('')}
                      title="Clear inputs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </label>
            </div>
          )}

          <div className="results-container">
            {executionMode === 'code' ? (
              // Code execution results
              results.length === 0 ? (
                <div className="no-results">
                  Click "Run Code" to execute your code
                </div>
              ) : (
                <div className="results-list">
                  {results.map((result, index) => {
                    const parsedError = result.error ? parseError(result.error) : null;
                    
                    return (
                      <div key={index} className="result-item">
                        <div className="result-header">
                          <div className="result-info">
                            <span className="execution-time">
                              {formatTimestamp(result.timestamp)} • {result.executionTime}ms
                            </span>
                            {parsedError?.line && (
                              <span className="error-location">
                                Line {parsedError.line}{parsedError.column ? `:${parsedError.column}` : ''}
                              </span>
                            )}
                          </div>
                          <span className="result-status">
                            {result.error ? '❌ Error' : '✅ Success'}
                          </span>
                        </div>
                        
                        {result.error ? (
                          <div className="error-output">
                            {parsedError?.line && (
                              <div className="error-highlight">
                                <strong>Error at line {parsedError.line}:</strong>
                              </div>
                            )}
                            <pre>{parsedError?.message || result.error}</pre>
                          </div>
                        ) : (
                          <div className="code-output">
                            {result.output.includes('function') || result.output.includes('{') || result.output.includes('[') || result.output.includes('def ') || result.output.includes('class ') ? (
                              <SyntaxHighlightedCode code={result.output} language={currentLanguage === 'java' ? 'java' : currentLanguage === 'python' ? 'python' : 'javascript'} />
                            ) : (
                              <pre>{result.output}</pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              // Test execution results
              <div className="test-mode-content">
                <TestCaseCreator />
                
                {!testResults ? (
                  (currentLanguage === 'python' || currentLanguage === 'java') ? (
                    <div className="no-results">
                      <p>Create custom test cases above to test your {currentLanguage.charAt(0).toUpperCase() + currentLanguage.slice(1)} program</p>
                      <div className="python-input-hint">
                        <p><strong>💡 {currentLanguage === 'java' ? 'Java' : 'Python'} Testing:</strong></p>
                        <ul>
                          <li>Custom tests run the entire program and compare full output</li>
                          <li>Enter program inputs exactly as user would type them</li>
                          <li>Use "{currentLanguage === 'java' ? 'Java' : 'Python'} Inputs" field above for direct code execution</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="no-results">
                      <p>Create custom test cases above or run tests from code comments</p>
                      <div className="test-format-hint">
                        <p>Supported comment test formats for {currentLanguage}:</p>
                        <ul>
                          <li>// functionName(arg1, arg2) =&gt; expected</li>
                          <li>// sum(1, 2) =&gt; 3</li>
                          <li>// multiply(4, 5) =&gt; 20</li>
                        </ul>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="test-results">
                    <TestSummary testResults={testResults} />
                    
                    {testResults.results.length > 0 && (
                      <div className="test-results-list">
                        {testResults.results.map((result, index) => (
                          <TestResultItem key={index} result={result} index={index} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionPanel;