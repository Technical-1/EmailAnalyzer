import { useState } from 'react';
import { Download, Trash2, Database, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store';

export function SettingsPage() {
  const { emails, clearAll } = useAppStore();
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const data = {
        exportDate: new Date().toISOString(),
        emailCount: emails.length,
        emails: emails.map(e => ({
          ...e,
          date: e.date instanceof Date ? e.date.toISOString() : e.date,
        })),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const headers = ['Subject', 'Sender', 'Recipients', 'Date', 'Type', 'Read', 'Starred'];
      const rows = emails.map(e => [
        `"${(e.subject || '').replace(/"/g, '""')}"`,
        `"${e.sender}"`,
        `"${e.recipients.join('; ')}"`,
        e.date instanceof Date ? e.date.toISOString() : e.date,
        e.emailType,
        e.isRead ? 'Yes' : 'No',
        e.isStarred ? 'Yes' : 'No',
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await clearAll();
      setShowConfirmClear(false);
    } catch (error) {
      console.error('Failed to clear data:', error);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Settings</h1>

      {/* Export Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Export Data</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Download your email data in various formats
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleExportJSON}
            disabled={isExporting || emails.length === 0}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <div className="text-left">
              <p className="font-medium text-slate-900 dark:text-white">Export as JSON</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Complete structured data</p>
            </div>
            <Download className="w-5 h-5 text-slate-400" />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isExporting || emails.length === 0}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <div className="text-left">
              <p className="font-medium text-slate-900 dark:text-white">Export as CSV</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">For spreadsheets</p>
            </div>
            <Download className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Storage Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Storage</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your data is stored locally in your browser
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          All email data is stored in IndexedDB within your browser. Your data never leaves your device
          and is not sent to any server.
        </p>
        
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Currently storing: <span className="font-medium">{emails.length} emails</span>
        </p>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-red-200 dark:border-red-900/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Danger Zone</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Irreversible actions
            </p>
          </div>
        </div>

        {!showConfirmClear ? (
          <button
            onClick={() => setShowConfirmClear(true)}
            disabled={emails.length === 0}
            className="w-full flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg transition-colors text-red-700 dark:text-red-300 disabled:opacity-50"
          >
            <div className="text-left">
              <p className="font-medium">Clear All Data</p>
              <p className="text-sm opacity-80">Remove all emails, accounts, and purchases</p>
            </div>
            <Trash2 className="w-5 h-5" />
          </button>
        ) : (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300 mb-3">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Are you sure?</span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              This will permanently delete all your imported data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClearData}
                disabled={isClearing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                {isClearing ? 'Clearing...' : 'Yes, Clear Everything'}
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="mt-8 text-center text-sm text-slate-400 dark:text-slate-500">
        <p>Email Analyzer v1.0.0</p>
        <p>Built with Vite + React + TailwindCSS</p>
      </div>
    </div>
  );
}
