import React, { createContext, useContext, useState } from "react";

interface TestModeContextType {
  isTestMode: boolean;
  toggleTestMode: () => void;
  testSessionId: string | null;
  setTestSessionId: (id: string | null) => void;
}

const TestModeContext = createContext<TestModeContextType | undefined>(
  undefined
);

export const TestModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isTestMode, setIsTestMode] = useState(false);
  const [testSessionId, setTestSessionId] = useState<string | null>(null);

  const toggleTestMode = () => {
    setIsTestMode(!isTestMode);
    if (!isTestMode) {
      setTestSessionId(null);
    }
  };

  return (
    <TestModeContext.Provider
      value={{ isTestMode, toggleTestMode, testSessionId, setTestSessionId }}
    >
      {children}
    </TestModeContext.Provider>
  );
};

export const useTestMode = () => {
  const context = useContext(TestModeContext);
  if (context === undefined) {
    throw new Error("useTestMode must be used within a TestModeProvider");
  }
  return context;
};
