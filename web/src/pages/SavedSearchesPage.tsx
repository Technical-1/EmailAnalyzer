import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Bookmark, Play, Pencil, Trash2, Plus, Search, X, Check } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { savedSearchService } from '../services/savedSearchService';
import type { SavedSearch } from '../types';

const SYNTAX_HINTS = [
  'from:amazon', 'subject:invoice', 'has:attachment', 'is:unread',
  'type:purchase', 'after:2024-01-01', 'in:archive',
];

export function SavedSearchesPage() {
  const navigate = useNavigate();
  // localStorage-backed service: keep a local copy and bump it after every mutation.
  const [searches, setSearches] = useState<SavedSearch[]>(() => savedSearchService.getAll());
  const reload = () => setSearches(savedSearchService.getAll());

  const [newName, setNewName] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuery, setEditQuery] = useState('');

  const handleCreate = () => {
    const name = newName.trim();
    const query = newQuery.trim();
    if (!name || !query) return;
    savedSearchService.save(name, query);
    setNewName('');
    setNewQuery('');
    reload();
  };

  const handleRun = (search: SavedSearch) => {
    savedSearchService.markUsed(search.id);
    navigate(`/emails?q=${encodeURIComponent(search.query)}`);
  };

  const startEdit = (search: SavedSearch) => {
    setEditingId(search.id);
    setEditName(search.name);
    setEditQuery(search.query);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const name = editName.trim();
    const query = editQuery.trim();
    if (!name || !query) return;
    savedSearchService.update(editingId, { name, query });
    setEditingId(null);
    reload();
  };

  const handleDelete = (id: string) => {
    savedSearchService.delete(id);
    if (editingId === id) setEditingId(null);
    reload();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Saved Searches</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Save advanced search queries and run them again in one click.
        </p>
      </div>

      {/* Create form */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New saved search
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Name (e.g. Unread receipts)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="sm:w-64 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search query (e.g. type:purchase after:2024-01-01)"
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || !newQuery.trim()}
            className="px-5 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            Save
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Try:</span>
          {SYNTAX_HINTS.map((hint) => (
            <button
              key={hint}
              onClick={() => setNewQuery((q) => (q ? `${q} ${hint}` : hint))}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {hint}
            </button>
          ))}
        </div>
      </div>

      {/* Saved search list */}
      {searches.length > 0 ? (
        <div className="space-y-3">
          {searches.map((search) => (
            <div
              key={search.id}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
            >
              {editingId === search.id ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="sm:w-64 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={editQuery}
                    onChange={(e) => setEditQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      aria-label="Save changes"
                      className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel editing"
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleRun(search)}
                    aria-label={`Run search ${search.name}`}
                    className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex-shrink-0"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleRun(search)} className="flex-1 min-w-0 text-left">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">{search.name}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate">{search.query}</div>
                  </button>
                  <div className="text-xs text-slate-400 hidden sm:block flex-shrink-0">
                    {search.lastUsed
                      ? `Last used ${format(search.lastUsed, 'MMM d, yyyy')}`
                      : `Created ${format(search.createdAt, 'MMM d, yyyy')}`}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(search)}
                      aria-label={`Edit ${search.name}`}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(search.id)}
                      aria-label={`Delete ${search.name}`}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bookmark}
          title="No saved searches yet"
          description="Create one above, or save a query from the email search bar."
        />
      )}
    </div>
  );
}
