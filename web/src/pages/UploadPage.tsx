import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Mail, Users, Calendar, ShoppingBag, UserCheck, RefreshCw, Newspaper } from 'lucide-react';
import { FileDropzone } from '../components/FileDropzone';
import { ProgressBar } from '../components/ProgressBar';
import { StatsCard } from '../components/StatsCard';
import { workerOlmParser, type ProgressCallback } from '../services/workerOlmParser';
import { useAppStore } from '../store';
import type { OLMProcessingProgress, OLMProcessingResult } from '../types';

export function UploadPage() {
  const navigate = useNavigate();
  const { refreshAll } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<OLMProcessingProgress | null>(null);
  const [result, setResult] = useState<OLMProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const progressCallback: ProgressCallback = (p) => {
        setProgress(p);
      };

      const processingResult = await workerOlmParser.parseOLMFile(file, progressCallback);
      setResult(processingResult);
      
      // Refresh the store with new data
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Upload OLM Archive
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Import your Outlook for Mac email archive to analyze accounts, purchases, and contacts
        </p>
      </div>

      {!isProcessing && !result && (
        <FileDropzone onFileSelect={handleFileSelect} isProcessing={isProcessing} />
      )}

      {isProcessing && progress && (
        <ProgressBar progress={progress} />
      )}

      {error && (
        <div className="max-w-2xl mx-auto mt-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-3 text-green-600 dark:text-green-400">
            <CheckCircle className="w-8 h-8" />
            <span className="text-xl font-semibold">Processing Complete!</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <StatsCard
              title="Emails"
              value={result.emails}
              icon={Mail}
              iconColor="text-blue-500"
            />
            <StatsCard
              title="Accounts"
              value={result.accounts}
              icon={UserCheck}
              iconColor="text-purple-500"
            />
            <StatsCard
              title="Purchases"
              value={result.purchases}
              icon={ShoppingBag}
              iconColor="text-green-500"
            />
            <StatsCard
              title="Subscriptions"
              value={result.subscriptions}
              icon={RefreshCw}
              iconColor="text-cyan-500"
            />
            <StatsCard
              title="Newsletters"
              value={result.newsletters}
              icon={Newspaper}
              iconColor="text-amber-500"
            />
            <StatsCard
              title="Contacts"
              value={result.contacts}
              icon={Users}
              iconColor="text-orange-500"
            />
            <StatsCard
              title="Events"
              value={result.calendarEvents}
              icon={Calendar}
              iconColor="text-pink-500"
            />
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/emails')}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              View Emails
            </button>
            <button
              onClick={() => {
                setResult(null);
                setProgress(null);
              }}
              className="px-6 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!isProcessing && !result && (
        <div className="mt-12 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            How to export your OLM file
          </h2>
          <ol className="space-y-3 text-slate-600 dark:text-slate-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center justify-center">1</span>
              <span>Open Outlook for Mac</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center justify-center">2</span>
              <span>Go to File → Export</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center justify-center">3</span>
              <span>Select "Outlook for Mac Data File (.olm)"</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center justify-center">4</span>
              <span>Choose what to export and save the file</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center justify-center">5</span>
              <span>Drag the .olm file above to analyze it</span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
