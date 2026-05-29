import { useState } from 'react';
import { 
  Download, 
  Upload, 
  Shield, 
  Lock,
  Unlock,
  Trash2,
  AlertTriangle,
  CheckCircle,
  FileArchive
} from 'lucide-react';
import { backupService } from '../services/backupService';
import { encryptionService } from '../services/encryptionService';
import { useAppStore } from '../store';

export function BackupPage() {
  const { emails, accounts, purchases, contacts, calendarEvents, subscriptions, newsletters } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Export options
  const [exportOptions, setExportOptions] = useState({
    includeEmails: true,
    includeAccounts: true,
    includePurchases: true,
    includeContacts: true,
    includeCalendarEvents: true,
    includeFolders: true,
    includeSubscriptions: true,
    includeNewsletters: true,
    encrypt: false,
  });

  // Encryption state
  const [passphrase, setPassphrase] = useState('');
  const [isEncryptionSetup, setIsEncryptionSetup] = useState(encryptionService.isEncryptionSetup());
  const [isUnlocked, setIsUnlocked] = useState(encryptionService.isUnlocked());

  const handleExport = async () => {
    setIsExporting(true);
    setError('');
    try {
      const blob = await backupService.exportBackup(
        exportOptions,
        (p, msg) => {
          setProgress(p);
          setMessage(msg);
        }
      );
      backupService.downloadBackup(blob);
      setMessage('Backup downloaded successfully!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);
    setError('');
    try {
      await backupService.importBackup(file, (p, msg) => {
        setProgress(p);
        setMessage(msg);
      });
      setMessage('Backup imported successfully! Refresh to see changes.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSetupEncryption = async () => {
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }
    try {
      await encryptionService.setupEncryption(passphrase);
      setIsEncryptionSetup(true);
      setIsUnlocked(true);
      setPassphrase('');
      setMessage('Encryption set up successfully!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleUnlock = async () => {
    try {
      const valid = await encryptionService.verifyPassphrase(passphrase);
      if (valid) {
        setIsUnlocked(true);
        setPassphrase('');
        setMessage('Encryption unlocked!');
      } else {
        setError('Incorrect passphrase');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleLock = () => {
    encryptionService.lock();
    setIsUnlocked(false);
    setMessage('Encryption locked');
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
      await backupService.clearAllData();
      setMessage('All data cleared. Refresh the page.');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Backup & Security
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Export your data, import backups, and manage encryption
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}
      {message && !error && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400">
          <CheckCircle className="w-5 h-5" />
          {message}
        </div>
      )}

      {/* Data Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Your Data
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{emails.length}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Emails</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{accounts.length}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Accounts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{purchases.length}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Purchases</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{contacts.length}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Contacts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{calendarEvents.length}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Events</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{subscriptions.length}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Subscriptions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{newsletters.length}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Newsletters</div>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-6 h-6 text-blue-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Export Backup
          </h2>
        </div>
        
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            Download a backup of your data. You can choose which data to include.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries({
              includeEmails: 'Emails',
              includeAccounts: 'Accounts',
              includePurchases: 'Purchases',
              includeContacts: 'Contacts',
              includeCalendarEvents: 'Calendar',
              includeFolders: 'Folders',
              includeSubscriptions: 'Subscriptions',
              includeNewsletters: 'Newsletters',
            }).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions[key as keyof typeof exportOptions] as boolean}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-slate-700 dark:text-slate-300">{label}</span>
              </label>
            ))}
          </div>

          {isUnlocked && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={exportOptions.encrypt}
                onChange={(e) => setExportOptions(prev => ({ ...prev, encrypt: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300"
              />
              <Shield className="w-4 h-4 text-green-500" />
              <span className="text-slate-700 dark:text-slate-300">Encrypt backup</span>
            </label>
          )}

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {isExporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting... {progress}%
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Export Backup
              </>
            )}
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="w-6 h-6 text-green-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Import Backup
          </h2>
        </div>
        
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            Restore data from a previous backup file.
          </p>
          
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                // Reset so selecting the same file again re-fires onChange.
                e.target.value = '';
              }}
              disabled={isImporting}
            />
            <FileArchive className="w-10 h-10 text-slate-400 mb-2" />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {isImporting ? `Importing... ${progress}%` : 'Click to select backup file (.zip)'}
            </span>
          </label>
        </div>
      </div>

      {/* Encryption Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-purple-500" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Encryption
          </h2>
          {isEncryptionSetup && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              isUnlocked 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}>
              {isUnlocked ? 'Unlocked' : 'Locked'}
            </span>
          )}
        </div>
        
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            {isEncryptionSetup
              ? 'Encryption is configured. You can lock/unlock or create encrypted backups.'
              : 'Set up encryption to protect your backup files with a passphrase.'}
          </p>

          {!isEncryptionSetup ? (
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Enter a passphrase (min 8 characters)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={handleSetupEncryption}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Lock className="w-4 h-4" />
                Set Up Encryption
              </button>
            </div>
          ) : isUnlocked ? (
            <button
              onClick={handleLock}
              className="flex items-center gap-2 px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Lock Encryption
            </button>
          ) : (
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Enter your passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={handleUnlock}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Unlock className="w-4 h-4" />
                Unlock
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="w-6 h-6 text-red-500" />
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
            Danger Zone
          </h2>
        </div>
        
        <div className="space-y-4">
          <p className="text-red-600 dark:text-red-400">
            This will permanently delete all your data. This action cannot be undone.
          </p>
          
          <button
            onClick={handleClearData}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete All Data
          </button>
        </div>
      </div>
    </div>
  );
}

