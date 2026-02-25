import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Upload, Sparkles, FileText } from 'lucide-react';
import type { AiChatMessage } from '../../types';

interface AiChatPanelProps {
  messages: AiChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onPdfUpload: (file: File, instructions?: string) => void;
  onHwpUpload?: (file: File) => void;
}

export default function AiChatPanel({
  messages,
  isLoading,
  onSendMessage,
  onPdfUpload,
  onHwpUpload,
}: AiChatPanelProps) {
  const [input, setInput] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadInstructions, setUploadInstructions] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hwpInputRef = useRef<HTMLInputElement>(null);

  // 새 메시지가 추가되면 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('PDF 파일만 업로드할 수 있습니다.');
      return;
    }
    onPdfUpload(file, uploadInstructions.trim() || undefined);
    setShowUpload(false);
    setUploadInstructions('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleHwpSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.hwp')) {
      alert('HWP 파일만 업로드할 수 있습니다.');
      return;
    }
    onHwpUpload?.(file);
    setShowUpload(false);
    if (hwpInputRef.current) hwpInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" />
          <span className="text-sm font-semibold">AI 어시스턴트</span>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
          title="PDF 업로드 (AI 변환)"
        >
          <Upload size={16} />
        </button>
      </div>

      {/* 파일 업로드 영역 (토글) */}
      {showUpload && (
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800 space-y-3">
          {/* HWP 업로드 */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <FileText size={12} className="text-blue-400" />
              <p className="text-xs font-medium text-blue-400">HWP 양식 변환</p>
            </div>
            <input
              ref={hwpInputRef}
              type="file"
              accept=".hwp"
              onChange={handleHwpSelect}
              disabled={isLoading}
              className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer disabled:opacity-50"
            />
          </div>
          {/* PDF 업로드 */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={12} className="text-purple-400" />
              <p className="text-xs font-medium text-purple-400">PDF AI 변환</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              disabled={isLoading}
              className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer disabled:opacity-50"
            />
            <textarea
              value={uploadInstructions}
              onChange={(e) => setUploadInstructions(e.target.value)}
              placeholder="추가 지시사항 (선택)"
              rows={2}
              className="mt-1 w-full px-3 py-2 text-xs bg-gray-900 border border-gray-600 rounded text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Bot size={32} className="mb-2 text-gray-600" />
            <p className="text-sm text-center">
              AI에게 HTML 수정을 요청하세요.
            </p>
            <p className="text-xs text-center mt-1 text-gray-600">
              예: "3번째 열 너비를 넓혀줘"
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center mt-0.5">
                <Bot size={14} />
              </div>
            )}
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-200 border border-gray-700'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center mt-0.5">
                <User size={14} />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 items-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
              <Bot size={14} />
            </div>
            <div className="bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                <span>AI가 처리중...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="px-4 py-3 border-t border-gray-700">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="수정 요청을 입력하세요..."
            rows={1}
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
