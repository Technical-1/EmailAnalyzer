import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkPlus, ChevronDown, Settings } from 'lucide-react';
import { savedSearchService } from '../services/savedSearchService';
import type { SavedSearch } from '../types';

interface SavedSearchMenuProps {
  /** The query currently typed in the search box (saved verbatim). */
  currentQuery: string;
  /** Apply a saved query to the email list. */
  onRun: (query: string) => void;
}

/**
 * Compact saved-search control for the email search bar: save the current query
 * and pick a previously saved one from a dropdown. Full management lives on the
 * Saved Searches page.
 */
export function SavedSearchMenu({ currentQuery, onRun }: SavedSearchMenuProps) {
  const [open, setOpen] = useState(false);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load fresh on open (the list may have changed elsewhere on the page).
  const toggleOpen = () => {
    if (!open) setSearches(savedSearchService.getAll());
    setOpen((o) => !o);
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleSave = () => {
    const query = currentQuery.trim();
    if (!query) return;
    const name = window.prompt('Name this search:', query);
    if (name && name.trim()) {
      savedSearchService.save(name.trim(), query);
      setSearches(savedSearchService.getAll());
    }
  };

  const handleRun = (search: SavedSearch) => {
    savedSearchService.markUsed(search.id);
    onRun(search.query);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex gap-2">
      <button
        onClick={handleSave}
        disabled={!currentQuery.trim()}
        title="Save current search"
        aria-label="Save current search"
        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-slate-600 dark:text-slate-300"
      >
        <BookmarkPlus className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-medium">Save</span>
      </button>

      <button
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open saved searches"
        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-slate-600 dark:text-slate-300"
      >
        <Bookmark className="w-5 h-5" />
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-20 py-1"
        >
          {searches.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              No saved searches yet.
            </p>
          ) : (
            searches.map((search) => (
              <button
                key={search.id}
                role="menuitem"
                onClick={() => handleRun(search)}
                className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="font-medium text-slate-900 dark:text-white truncate">{search.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{search.query}</div>
              </button>
            ))
          )}
          <div className="border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
            <Link
              to="/saved-searches"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Manage saved searches
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
