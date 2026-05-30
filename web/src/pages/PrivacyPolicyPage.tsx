import { Shield, Lock, Database, Trash2, Code, KeyRound } from 'lucide-react';

export function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-blue-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
        Last updated: February 2026
      </p>

      <div className="space-y-8">
        {/* Overview */}
        <section>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Email Archive Explorer is designed with privacy as its core principle.{' '}
            <strong>All email processing happens entirely within your browser.</strong>{' '}
            No email data is ever transmitted to any server. Your emails never leave your device.
          </p>
        </section>

        {/* Client-Side Processing */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">100% Client-Side Processing</h2>
          </div>
          <ul className="space-y-2 text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">&#10003;</span>
              Email files (.olm, .mbox, .zip) are parsed directly in your browser using Web Workers
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">&#10003;</span>
              Account, purchase, subscription, and newsletter detection runs locally
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">&#10003;</span>
              Search indexing and analytics are computed on your device
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">&#10003;</span>
              No external API calls are made with your email content
            </li>
          </ul>
        </section>

        {/* Data Storage */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Local Data Storage</h2>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-3">
            All data is stored in your browser&apos;s <strong>IndexedDB</strong>, a built-in browser database.
            This means:
          </p>
          <ul className="space-y-2 text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">&#8226;</span>
              Data persists across browser sessions on the same device
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">&#8226;</span>
              Data is sandboxed to this application and inaccessible to other websites
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">&#8226;</span>
              Clearing your browser data or using the in-app delete function removes all stored emails
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">&#8226;</span>
              No cookies are used for tracking — only localStorage for theme preference
            </li>
          </ul>
        </section>

        {/* Encryption */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <KeyRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Encryption</h2>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-3">
            The optional backup and encryption feature uses industry-standard cryptography:
          </p>
          <ul className="space-y-2 text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-1">&#8226;</span>
              AES-GCM 256-bit encryption via the Web Crypto API
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-1">&#8226;</span>
              PBKDF2 key derivation with 100,000 iterations
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500 mt-1">&#8226;</span>
              Encryption keys are derived from your password and never stored
            </li>
          </ul>
        </section>

        {/* Your Rights */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Right to Delete</h2>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-3">
            You have full control over your data at all times:
          </p>
          <ul className="space-y-2 text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">&#8226;</span>
              Use <strong>Settings &gt; Clear All Data</strong> to permanently delete all stored emails and analysis data
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">&#8226;</span>
              Clear your browser&apos;s site data to remove everything
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">&#8226;</span>
              Since no data leaves your device, deletion is immediate and complete
            </li>
          </ul>
        </section>

        {/* Third-Party Libraries */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Code className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Third-Party Libraries</h2>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-3">
            This application uses open-source libraries that run entirely in your browser:
          </p>
          <ul className="space-y-2 text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-1">&#8226;</span>
              <strong>React</strong> — UI framework
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-1">&#8226;</span>
              <strong>Dexie.js</strong> — IndexedDB wrapper for local storage
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-1">&#8226;</span>
              <strong>JSZip</strong> — ZIP file parsing (for .olm and Gmail Takeout)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-1">&#8226;</span>
              <strong>DOMPurify</strong> — HTML sanitization for safe email rendering
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-1">&#8226;</span>
              <strong>Recharts</strong> — Analytics charting
            </li>
          </ul>
          <p className="text-slate-500 dark:text-slate-500 text-sm mt-4">
            Self-hosted fonts are used to avoid external network requests.
            No analytics, tracking pixels, or third-party scripts are loaded.
          </p>
        </section>

        {/* Contact */}
        <section className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">
          <p>
            Questions about privacy? This project is open source on{' '}
            <a
              href="https://github.com/Technical-1/EmailAnalyzer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 underline"
            >
              GitHub
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
