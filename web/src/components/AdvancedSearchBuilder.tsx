import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, X, Search } from 'lucide-react';

interface AdvancedSearchBuilderProps {
  onSearch: (query: string) => void;
}

interface SearchFields {
  from: string;
  to: string;
  subject: string;
  body: string;
  dateAfter: string;
  dateBefore: string;
  hasAttachment: boolean;
  isUnread: boolean;
  isStarred: boolean;
  type: '' | 'purchase' | 'account';
  folder: '' | 'inbox' | 'archive' | 'trash' | 'sent';
}

const INITIAL_FIELDS: SearchFields = {
  from: '',
  to: '',
  subject: '',
  body: '',
  dateAfter: '',
  dateBefore: '',
  hasAttachment: false,
  isUnread: false,
  isStarred: false,
  type: '',
  folder: '',
};

function buildQuery(fields: SearchFields): string {
  const parts: string[] = [];

  if (fields.from) parts.push(`from:${quoteIfNeeded(fields.from)}`);
  if (fields.to) parts.push(`to:${quoteIfNeeded(fields.to)}`);
  if (fields.subject) parts.push(`subject:${quoteIfNeeded(fields.subject)}`);
  if (fields.body) parts.push(`body:${quoteIfNeeded(fields.body)}`);
  if (fields.dateAfter) parts.push(`after:${fields.dateAfter}`);
  if (fields.dateBefore) parts.push(`before:${fields.dateBefore}`);
  if (fields.hasAttachment) parts.push('has:attachment');
  if (fields.isUnread) parts.push('is:unread');
  if (fields.isStarred) parts.push('is:starred');
  if (fields.type) parts.push(`type:${fields.type}`);
  if (fields.folder) parts.push(`in:${fields.folder}`);

  return parts.join(' ');
}

function quoteIfNeeded(value: string): string {
  return value.includes(' ') ? `"${value}"` : value;
}

export function AdvancedSearchBuilder({ onSearch }: AdvancedSearchBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fields, setFields] = useState<SearchFields>(INITIAL_FIELDS);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const updateField = <K extends keyof SearchFields>(key: K, value: SearchFields[K]) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    const query = buildQuery(fields);
    if (query) {
      onSearch(query);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setFields(INITIAL_FIELDS);
  };

  const hasFilters = Object.entries(fields).some(([, v]) => v !== '' && v !== false);

  const inputClasses = 'w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClasses = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2.5 rounded-lg border transition-colors ${
          isOpen || hasFilters
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
        aria-label="Advanced search builder"
        aria-expanded={isOpen}
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-30"
          role="dialog"
          aria-label="Advanced search filters"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Advanced Search</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              aria-label="Close advanced search"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Fields */}
          <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
            {/* Text Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>From</label>
                <input
                  type="text"
                  value={fields.from}
                  onChange={e => updateField('from', e.target.value)}
                  placeholder="sender@..."
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>To</label>
                <input
                  type="text"
                  value={fields.to}
                  onChange={e => updateField('to', e.target.value)}
                  placeholder="recipient@..."
                  className={inputClasses}
                />
              </div>
            </div>

            <div>
              <label className={labelClasses}>Subject contains</label>
              <input
                type="text"
                value={fields.subject}
                onChange={e => updateField('subject', e.target.value)}
                placeholder="e.g. invoice, welcome"
                className={inputClasses}
              />
            </div>

            <div>
              <label className={labelClasses}>Body contains</label>
              <input
                type="text"
                value={fields.body}
                onChange={e => updateField('body', e.target.value)}
                placeholder="e.g. password reset"
                className={inputClasses}
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>After date</label>
                <input
                  type="date"
                  value={fields.dateAfter}
                  onChange={e => updateField('dateAfter', e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Before date</label>
                <input
                  type="date"
                  value={fields.dateBefore}
                  onChange={e => updateField('dateBefore', e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Dropdowns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>Email type</label>
                <select
                  value={fields.type}
                  onChange={e => updateField('type', e.target.value as SearchFields['type'])}
                  className={inputClasses}
                >
                  <option value="">Any</option>
                  <option value="purchase">Purchase</option>
                  <option value="account">Account Signup</option>
                </select>
              </div>
              <div>
                <label className={labelClasses}>Folder</label>
                <select
                  value={fields.folder}
                  onChange={e => updateField('folder', e.target.value as SearchFields['folder'])}
                  className={inputClasses}
                >
                  <option value="">Any</option>
                  <option value="inbox">Inbox</option>
                  <option value="sent">Sent</option>
                  <option value="archive">Archive</option>
                  <option value="trash">Trash</option>
                </select>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fields.hasAttachment}
                  onChange={e => updateField('hasAttachment', e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-blue-500 focus:ring-blue-500"
                />
                Has attachment
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fields.isUnread}
                  onChange={e => updateField('isUnread', e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-blue-500 focus:ring-blue-500"
                />
                Unread only
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fields.isStarred}
                  onChange={e => updateField('isStarred', e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-blue-500 focus:ring-blue-500"
                />
                Starred
              </label>
            </div>

            {/* Query Preview */}
            {hasFilters && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-xs text-slate-400 mb-1">Generated query:</p>
                <code className="text-xs text-blue-600 dark:text-blue-400 break-all">
                  {buildQuery(fields)}
                </code>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleClear}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              disabled={!hasFilters}
            >
              Clear all
            </button>
            <button
              onClick={handleSearch}
              disabled={!hasFilters}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Search
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
