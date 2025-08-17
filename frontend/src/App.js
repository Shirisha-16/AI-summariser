import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Brain, Mail, Send, Loader, CheckCircle, XCircle, Copy, Edit3 } from 'lucide-react';

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

const MeetingNotesSummarizer = () => {
  // State management
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('Summarize the meeting notes in clear bullet points, highlighting key decisions, action items, and important discussion points.');
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [recipientEmails, setRecipientEmails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ type: '', message: '' });
  const [isDragOver, setIsDragOver] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const fileInputRef = useRef(null);

  // Quick prompt templates
  const quickPrompts = [
    'Summarize in bullet points for executives',
    'Highlight only action items and deadlines',
    'Create a detailed meeting recap with key decisions',
    'Extract key insights and next steps',
    'Focus on financial discussions and budget decisions',
    'Identify risks and mitigation strategies mentioned'
  ];

  // File upload handlers
  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    if (!file.type.match('text.*') && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      alert('Please select a text file (.txt or .md)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setFileContent(e.target.result);
      setFileName(file.name);
      setGeneratedSummary('');
      setShowResult(false);
    };
    reader.readAsText(file);
  }, []);

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  // AI Summary generation
  const generateSummary = async () => {
    if (!fileContent) {
      alert('Please upload a file first!');
      return;
    }

    if (!customPrompt.trim()) {
      alert('Please enter custom instructions!');
      return;
    }

    setIsGenerating(true);
    setEmailStatus({ type: '', message: '' });

    try {
      const response = await fetch(`${API_BASE}/api/generate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: fileContent,
          prompt: customPrompt,
          filename: fileName
        })
      });

      const result = await response.json();

      if (result.success) {
        setGeneratedSummary(result.summary);
        setShowResult(true);
      } else {
        throw new Error(result.error || 'Summary generation failed');
      }
    } catch (error) {
      alert('Error generating summary: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Email sending
  const sendEmail = async () => {
    if (!recipientEmails.trim()) {
      alert('Please enter recipient email addresses!');
      return;
    }

    if (!generatedSummary.trim()) {
      alert('No summary to send!');
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus({ type: 'loading', message: 'Sending email...' });

    try {
      const response = await fetch(`${API_BASE}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipients: recipientEmails,
          summary: generatedSummary,
          subject: `Meeting Summary - ${fileName || 'AI Generated'}`
        })
      });

      const result = await response.json();

      if (result.success) {
        setEmailStatus({ 
          type: 'success', 
          message: `✅ ${result.message}` 
        });
      } else {
        throw new Error(result.error || 'Email sending failed');
      }
    } catch (error) {
      setEmailStatus({ 
        type: 'error', 
        message: `❌ Error sending email: ${error.message}` 
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedSummary);
      alert('Summary copied to clipboard!');
    } catch (error) {
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-blue-200">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">
            🤖 AI Meeting Notes Summarizer
          </h1>
          <p className="text-xl opacity-90">
            Upload your meeting transcript and get AI-powered summaries
          </p>
        </div>

        {/* Main Upload Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-6 backdrop-blur-sm bg-opacity-95">
          {/* File Upload Section */}
          <div
            className={`border-3 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer mb-6 ${
              isDragOver 
                ? 'border-purple-500 bg-purple-50 scale-105' 
                : fileContent 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-blue-400 bg-blue-50 hover:border-purple-500 hover:bg-purple-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center">
              {fileContent ? (
                <>
                  <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold text-green-700 mb-2">
                    📄 File Loaded: {fileName}
                  </h3>
                  <div className="bg-white p-4 rounded-lg border max-w-full overflow-hidden">
                    <p className="text-sm text-gray-600 font-mono text-left">
                      {fileContent.substring(0, 200)}
                      {fileContent.length > 200 && '...'}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    {fileContent.length} characters • Click to upload a different file
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-16 h-16 text-blue-500 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Upload Meeting Transcript
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Drag and drop your text file here or click to browse
                  </p>
                  <button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                    Choose File
                  </button>
                </>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Custom Instructions */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <Edit3 className="inline w-4 h-4 mr-2" />
              Custom Instructions
            </label>
            
            {/* Quick Prompt Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setCustomPrompt(prompt)}
                  className="bg-gray-100 hover:bg-blue-500 hover:text-white text-gray-700 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 transform hover:scale-105"
                >
                  {prompt.split(' ').slice(0, 2).join(' ')}...
                </button>
              ))}
            </div>

            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors duration-200 resize-none"
              rows="4"
              placeholder="E.g., 'Summarize in bullet points for executives' or 'Highlight only action items'"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={generateSummary}
            disabled={!fileContent || !customPrompt.trim() || isGenerating}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
          >
            {isGenerating ? (
              <>
                <Loader className="animate-spin w-5 h-5 mr-2" />
                AI is processing your meeting notes...
              </>
            ) : (
              <>
                <Brain className="w-5 h-5 mr-2" />
                🎯 Generate Summary
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        {showResult && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 backdrop-blur-sm bg-opacity-95 animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                <FileText className="w-6 h-6 mr-2 text-blue-500" />
                📋 Generated Summary
              </h3>
              <button
                onClick={copyToClipboard}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition-colors duration-200"
                title="Copy to clipboard"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Summary (Editable)
              </label>
              <textarea
                value={generatedSummary}
                onChange={(e) => setGeneratedSummary(e.target.value)}
                className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors duration-200 font-mono text-sm"
                rows="12"
                placeholder="Your AI-generated summary will appear here..."
              />
            </div>

            {/* Email Section */}
            <div className="border-t pt-6">
              <h4 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Mail className="w-5 h-5 mr-2 text-green-500" />
                📧 Share via Email
              </h4>
              
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Recipient Email Addresses (comma-separated)
                </label>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={recipientEmails}
                    onChange={(e) => setRecipientEmails(e.target.value)}
                    className="flex-1 p-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors duration-200"
                    placeholder="john@company.com, jane@company.com"
                    multiple
                  />
                  <button
                    onClick={sendEmail}
                    disabled={!recipientEmails.trim() || !generatedSummary.trim() || isSendingEmail}
                    className="bg-gradient-to-r from-green-500 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center"
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader className="animate-spin w-4 h-4 mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        📤 Send Email
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Email Status */}
              {emailStatus.message && (
                <div className={`p-4 rounded-lg border ${
                  emailStatus.type === 'success' 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : emailStatus.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  {emailStatus.type === 'success' && <CheckCircle className="inline w-4 h-4 mr-2" />}
                  {emailStatus.type === 'error' && <XCircle className="inline w-4 h-4 mr-2" />}
                  {emailStatus.type === 'loading' && <Loader className="inline w-4 h-4 mr-2 animate-spin" />}
                  {emailStatus.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-blue-100 opacity-75">
            Powered by AI • Secure • Fast • Professional
          </p>
        </div>
      </div>
    </div>
  );
};

export default MeetingNotesSummarizer;