import React, { useState } from 'react';

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
  // Use internal state to prevent parent re-renders from affecting input
  const [internalValue, setInternalValue] = useState(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    onChange(newValue);
  };

  // Sync with external value when it changes
  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  return (
    <input
      type="text"
      placeholder={placeholder}
      value={internalValue}
      onChange={handleChange}
      className={className}
      title={title}
      required={required}
    />
  );
};

export default TestCaseInput;