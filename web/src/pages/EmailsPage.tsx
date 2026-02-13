import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, ChevronLeft, ChevronRight, ArrowUpDown, SortAsc, SortDesc, Archive, Trash2, Inbox, Star, Zap, MessageSquare, List, Send, FileText, AlertTriangle, Folder } from 'lucide-react';
import { SearchInput } from '../components/SearchInput';
import { AdvancedSearchBuilder } from '../components/AdvancedSearchBuilder';
import { EmailCard } from '../components/EmailCard';
import { EmptyState } from '../components/EmptyState';
import { VirtualEmailList } from '../components/VirtualEmailList';
import { VirtualThreadList } from '../components/VirtualThreadList';
import { ThreadView } from '../components/ThreadView';
import { useAppStore } from '../store';
import { SYSTEM_FOLDERS, type Email } from '../types';

type FilterType = 'all' | 'account_signup' | 'purchase' | 'unread' | 'starred';
type SortField = 'date' | 'sender' | 'subject';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'paginated' | 'virtual';
type ListMode = 'emails' | 'threads';

const EMAILS_PER_PAGE = 50;
const VIRTUAL_SCROLL_THRESHOLD = 100; // Use virtual scrolling when more than 100 emails
const THREAD_VIRTUAL_THRESHOLD = 50; // Use virtual scrolling when more than 50 threads

// Wrapper component to reset state on folder change
function EmailsPageContent({ folderParam, initialListMode }: { folderParam: string | null; initialListMode: ListMode }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { emails, threads: allThreads, emptyTrash } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search to avoid scanning email bodies on every keystroke
  useEffect(() => {
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(debounceTimer.current);
  }, [searchQuery]);

  const [filter, setFilter] = useState<FilterType>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('paginated');
  const [listMode, setListMode] = useState<ListMode>(initialListMode);
  
  // Update URL when list mode changes
  const handleListModeChange = useCallback((newMode: ListMode) => {
    setListMode(newMode);
    const newParams = new URLSearchParams(searchParams);
    if (newMode === 'threads') {
      newParams.set('view', 'threads');
    } else {
      newParams.delete('view');
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Special handling for favorites (starred emails across all folders)
  const isFavorites = folderParam === 'favorites';

  // Determine current folder - use folderParam directly if provided, else inbox
  const currentFolder = folderParam && folderParam !== 'favorites' 
    ? folderParam 
    : SYSTEM_FOLDERS.INBOX;

  // Get folder title - capitalize first letter of each word
  const getFolderTitle = () => {
    if (isFavorites) return 'Favorites';
    if (!folderParam) return 'Inbox';
    // Handle system folders
    if (folderParam === 'inbox') return 'Inbox';
    if (folderParam === 'sent') return 'Sent';
    if (folderParam === 'drafts') return 'Drafts';
    if (folderParam === 'spam') return 'Spam';
    if (folderParam === 'archive') return 'Archive';
    if (folderParam === 'trash') return 'Trash';
    // Custom folders - capitalize and replace dashes with spaces
    return folderParam
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };
  const folderTitle = getFolderTitle();

  // Get folder icon - memoized to avoid creating components during render
  const FolderIcon = useMemo(() => {
    if (isFavorites) return Star;
    if (currentFolder === 'sent') return Send;
    if (currentFolder === 'drafts') return FileText;
    if (currentFolder === 'spam') return AlertTriangle;
    if (currentFolder === 'archive') return Archive;
    if (currentFolder === 'trash') return Trash2;
    if (currentFolder === 'inbox' || !folderParam) return Inbox;
    return Folder; // Custom folders
  }, [isFavorites, currentFolder, folderParam]);

  // Filter, search, and sort emails
  const processedEmails = useMemo(() => {
    // Start with emails based on folder type
    let result = isFavorites 
      ? emails.filter(e => e.isStarred) // Favorites shows all starred emails
      : emails.filter(e => e.folderId === currentFolder);

    // Apply filter (skip starred filter if in favorites view)
    switch (filter) {
      case 'account_signup':
        result = result.filter(e => e.emailType === 'account_signup');
        break;
      case 'purchase':
        result = result.filter(e => e.emailType === 'purchase');
        break;
      case 'unread':
        result = result.filter(e => !e.isRead);
        break;
      case 'starred':
        if (!isFavorites) {
          result = result.filter(e => e.isStarred);
        }
        break;
    }

    // Apply search (debounced to avoid scanning bodies on every keystroke)
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(email =>
        email.subject.toLowerCase().includes(query) ||
        email.sender.toLowerCase().includes(query) ||
        email.body.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'sender':
          comparison = a.sender.localeCompare(b.sender);
          break;
        case 'subject':
          comparison = a.subject.localeCompare(b.subject);
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [emails, currentFolder, isFavorites, filter, debouncedSearch, sortField, sortOrder]);

  // Show all threads when in threads mode (for instant switching)
  const threads = useMemo(() => {
    if (listMode !== 'threads') return [];
    
    // Apply search within threads if user has entered a query (debounced)
    let result = allThreads;
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(thread =>
        thread.subject.toLowerCase().includes(query) ||
        thread.participants.some(p => p.toLowerCase().includes(query)) ||
        thread.emails.some(e =>
          e.sender.toLowerCase().includes(query) ||
          e.body.toLowerCase().includes(query)
        )
      );
    }

    return result.sort((a, b) => b.lastMessageDate.getTime() - a.lastMessageDate.getTime());
  }, [listMode, allThreads, debouncedSearch]);

  const folderEmailCount = isFavorites 
    ? emails.filter(e => e.isStarred).length 
    : emails.filter(e => e.folderId === currentFolder).length;

  // Pagination
  const totalPages = Math.ceil(processedEmails.length / EMAILS_PER_PAGE);
  const paginatedEmails = useMemo(() => {
    const start = (currentPage - 1) * EMAILS_PER_PAGE;
    return processedEmails.slice(start, start + EMAILS_PER_PAGE);
  }, [processedEmails, currentPage]);

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Don't show starred filter in favorites view since all are already starred
  const filters: { value: FilterType; label: string }[] = isFavorites
    ? [
        { value: 'all', label: 'All' },
        { value: 'account_signup', label: 'Account Signups' },
        { value: 'purchase', label: 'Purchases' },
        { value: 'unread', label: 'Unread' },
      ]
    : [
        { value: 'all', label: 'All' },
        { value: 'account_signup', label: 'Account Signups' },
        { value: 'purchase', label: 'Purchases' },
        { value: 'unread', label: 'Unread' },
        { value: 'starred', label: 'Starred' },
      ];

  const sortOptions: { value: SortField; label: string }[] = [
    { value: 'date', label: 'Date' },
    { value: 'sender', label: 'Sender' },
    { value: 'subject', label: 'Subject' },
  ];

  const useVirtual = viewMode === 'virtual' && processedEmails.length > 0;

  // Callback for email click in virtual list - preserve view mode for back navigation
  const handleEmailClick = useCallback((email: Email) => {
    // Build return URL with current view mode
    const returnParams = new URLSearchParams();
    if (folderParam) returnParams.set('folder', folderParam);
    if (listMode === 'threads') returnParams.set('view', 'threads');
    const returnUrl = returnParams.toString() ? `/emails?${returnParams.toString()}` : '/emails';
    
    navigate(`/emails/${email.id}`, { state: { returnUrl } });
  }, [navigate, folderParam, listMode]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderIcon className={`w-8 h-8 ${
            isFavorites ? 'text-yellow-500 fill-yellow-500'
            : currentFolder === SYSTEM_FOLDERS.ARCHIVE ? 'text-blue-500' 
            : currentFolder === SYSTEM_FOLDERS.TRASH ? 'text-red-500' 
            : 'text-slate-500'
          }`} />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{folderTitle}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1" aria-live="polite">
              {processedEmails.length} emails {filter !== 'all' ? `(filtered from ${folderEmailCount})` : ''}
            </p>
          </div>
        </div>
        {!isFavorites && currentFolder === SYSTEM_FOLDERS.TRASH && folderEmailCount > 0 && (
          <button
            onClick={() => {
              if (confirm(`Permanently delete all ${folderEmailCount} emails in trash? This cannot be undone.`)) {
                emptyTrash();
              }
            }}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Empty Trash
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <div className="flex-1">
          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={listMode === 'threads' ? "Search conversations by subject, participants, or content..." : "Search emails by subject, sender, or content..."}
          />
        </div>
        <AdvancedSearchBuilder onSearch={handleSearchChange} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Email type filters">
        {filters.map(f => {
          // Use starred emails for favorites, otherwise folder-based emails
          const baseEmails = isFavorites 
            ? emails.filter(e => e.isStarred)
            : emails.filter(e => e.folderId === currentFolder);
          const count = f.value === 'all' 
            ? baseEmails.length 
            : baseEmails.filter(e => {
                switch (f.value) {
                  case 'account_signup': return e.emailType === 'account_signup';
                  case 'purchase': return e.emailType === 'purchase';
                  case 'unread': return !e.isRead;
                  case 'starred': return e.isStarred;
                  default: return false;
                }
              }).length;
          
          return (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {f.label}
              {f.value !== 'all' && (
                <span className="ml-1 opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sort Options and View Mode */}
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2" role="group" aria-label="Sort options">
          <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-4 h-4" />
            Sort by:
          </span>
          {sortOptions.map(option => (
            <button
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              aria-label={`Sort by ${option.label}${sortField === option.value ? `, ${sortOrder === 'desc' ? 'descending' : 'ascending'}` : ''}`}
              aria-pressed={sortField === option.value}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${
                sortField === option.value
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {option.label}
              {sortField === option.value && (
                sortOrder === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* List Mode Toggle */}
          <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" role="group" aria-label="View mode">
            <button
              onClick={() => handleListModeChange('emails')}
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 transition-colors ${
                listMode === 'emails'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Show individual emails"
            >
              <List className="w-3 h-3" />
              Emails
            </button>
            <button
              onClick={() => handleListModeChange('threads')}
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 transition-colors ${
                listMode === 'threads'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Group emails into conversations"
            >
              <MessageSquare className="w-3 h-3" />
              Threads
            </button>
          </div>

          {/* View Mode Toggle */}
          {listMode === 'emails' && processedEmails.length > VIRTUAL_SCROLL_THRESHOLD && (
            <button
              onClick={() => setViewMode(viewMode === 'paginated' ? 'virtual' : 'paginated')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'virtual'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={viewMode === 'virtual' ? 'Using virtual scrolling for performance' : 'Switch to virtual scrolling'}
            >
              <Zap className="w-3 h-3" />
              {viewMode === 'virtual' ? 'Virtual Scroll' : 'Paginated'}
            </button>
          )}
        </div>
      </div>

      {/* Email List */}
      {processedEmails.length > 0 ? (
        listMode === 'threads' ? (
          // Thread View Mode
          threads.length > THREAD_VIRTUAL_THRESHOLD ? (
            // Virtual scrolling for many threads
            <>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-blue-500" />
                {threads.length} conversations (virtual scrolling enabled)
              </div>
              <VirtualThreadList
                threads={threads}
                onEmailClick={handleEmailClick}
                estimateSize={150}
                overscan={3}
              />
            </>
          ) : (
            // Normal rendering for fewer threads
            <>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-blue-500" />
                {threads.length} conversations
              </div>
              <div className="space-y-3">
                {threads.map(thread => (
                  <ThreadView
                    key={thread.id}
                    thread={thread}
                    onEmailClick={handleEmailClick}
                  />
                ))}
              </div>
            </>
          )
        ) : useVirtual ? (
          // Virtual Scrolling Mode
          <>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
              <Zap className="w-3 h-3 text-green-500" />
              Virtual scrolling enabled for {processedEmails.length} emails
            </div>
            <VirtualEmailList
              emails={processedEmails}
              onEmailClick={handleEmailClick}
              estimateSize={100}
              overscan={5}
            />
          </>
        ) : (
          // Paginated Mode
          <>
            <div className="space-y-3" role="list" aria-label="Email list">
              {paginatedEmails.map(email => (
                <EmailCard
                  key={email.id}
                  email={email}
                  onClick={() => navigate(`/emails/${email.id}`)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-700" aria-label="Email list pagination">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing {((currentPage - 1) * EMAILS_PER_PAGE) + 1} - {Math.min(currentPage * EMAILS_PER_PAGE, processedEmails.length)} of {processedEmails.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {/* Show page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          aria-label={`Page ${pageNum}`}
                          aria-current={currentPage === pageNum ? 'page' : undefined}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-500 text-white'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </nav>
            )}
          </>
        )
      ) : emails.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No Emails Yet"
          description="Upload an OLM file to import your emails and start analyzing."
          actionLabel="Upload OLM File"
          actionTo="/"
        />
      ) : folderEmailCount === 0 ? (
        <EmptyState
          icon={FolderIcon}
          title={`No Emails in ${folderTitle}`}
          description={
            isFavorites 
              ? "Star emails to add them to your favorites."
              : currentFolder === SYSTEM_FOLDERS.TRASH 
                ? "Deleted emails will appear here." 
                : currentFolder === SYSTEM_FOLDERS.ARCHIVE 
                  ? "Archived emails will appear here."
                  : "Your inbox is empty."
          }
        />
      ) : (
        <EmptyState
          icon={Mail}
          title="No Results"
          description="Try adjusting your search or filters."
        />
      )}
    </div>
  );
}

// Main export - uses key prop to reset state when folder changes
export function EmailsPage() {
  const [searchParams] = useSearchParams();
  const folderParam = searchParams.get('folder');
  const viewParam = searchParams.get('view') as ListMode | null;
  
  // Using key forces component remount when folder changes, resetting all state
  return <EmailsPageContent key={folderParam ?? 'inbox'} folderParam={folderParam} initialListMode={viewParam || 'emails'} />;
}
