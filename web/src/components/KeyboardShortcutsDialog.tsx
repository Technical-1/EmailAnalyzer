import { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '../hooks/useKeyboardShortcuts';

export function KeyboardShortcutsDialog() {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dialogRef.current?.classList.add('hidden');
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      dialogRef.current?.classList.add('hidden');
    }
  };

  return (
    <div
      id="keyboard-shortcuts-dialog"
      ref={dialogRef}
      className="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-label="Keyboard shortcuts"
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => dialogRef.current?.classList.add('hidden')}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close shortcuts dialog"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {KEYBOARD_SHORTCUTS.map((shortcut) => (
            <div key={shortcut.key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-600 dark:text-slate-400">{shortcut.description}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Press <kbd className="px-1 py-0.5 text-xs font-mono bg-slate-100 dark:bg-slate-700 rounded">?</kbd> to toggle this dialog
          </p>
        </div>
      </div>
    </div>
  );
}
