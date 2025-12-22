import type { OLMProcessingProgress } from '../types';

interface ProgressBarProps {
  progress: OLMProcessingProgress;
}

const stageLabels: Record<OLMProcessingProgress['stage'], string> = {
  extracting: 'Extracting Archive',
  parsing_emails: 'Parsing Emails',
  parsing_contacts: 'Parsing Contacts',
  parsing_calendar: 'Parsing Calendar',
  detecting: 'Detecting Accounts & Purchases',
  saving: 'Saving Data',
};

export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {stageLabels[progress.stage]}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {progress.progress}%
          </span>
        </div>

        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${progress.progress}%` }}
          />
        </div>

        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {progress.message}
        </p>
      </div>
    </div>
  );
}

