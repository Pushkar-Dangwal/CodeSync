import React, { useRef, useEffect } from 'react';

interface TestCaseInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  title?: string;
  required?: boolean;
}

const TestCaseInput: React.FC<TestCaseInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  title,
  required = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Save cursor position before update
    cursorPositionRef.current = e.target.selectionStart || 0;
    onChange(e.target.value);
  };

  // Restore cursor position after render
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      className={className}
      title={title}
      required={required}
    />
  );
};

export default TestCaseInput;