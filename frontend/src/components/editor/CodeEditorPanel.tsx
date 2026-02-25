import { useCallback } from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorPanelProps {
  htmlContent: string;
  cssContent: string;
  activeTab: 'html' | 'css';
  onTabChange: (tab: 'html' | 'css') => void;
  onHtmlChange: (value: string) => void;
  onCssChange: (value: string) => void;
}

export default function CodeEditorPanel({
  htmlContent,
  cssContent,
  activeTab,
  onTabChange,
  onHtmlChange,
  onCssChange,
}: CodeEditorPanelProps) {
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const v = value ?? '';
      if (activeTab === 'html') {
        onHtmlChange(v);
      } else {
        onCssChange(v);
      }
    },
    [activeTab, onHtmlChange, onCssChange]
  );

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* 탭 헤더 */}
      <div className="flex items-center border-b border-gray-700 bg-[#252526]">
        <button
          onClick={() => onTabChange('html')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'html'
              ? 'text-white bg-[#1e1e1e] border-t-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          HTML
        </button>
        <button
          onClick={() => onTabChange('css')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'css'
              ? 'text-white bg-[#1e1e1e] border-t-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          CSS
        </button>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          language={activeTab}
          value={activeTab === 'html' ? htmlContent : cssContent}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            tabSize: 2,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>
    </div>
  );
}
