import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ChevronLeft, ChevronRight, ArrowUpDown, SortAsc, SortDesc } from 'lucide-react';
import { SearchInput } from '../components/SearchInput';
import { EmailCard } from '../components/EmailCard';
import { EmptyState } from '../components/EmptyState';
import { useAppStore } from '../store';

type FilterType = 'all' | 'account_signup' | 'purchase' | 'unread' | 'starred';
type SortField = 'date' | 'sender' | 'subject';
type SortOrder = 'asc' | 'desc';

const EMAILS_PER_PAGE = 50;

export function EmailsPage() {
  const navigate = useNavigate();
  const { emails } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter, search, and sort emails
  const processedEmails = useMemo(() => {
    let result = [...emails];

    // Apply filter
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
        result = result.filter(e => e.isStarred);
        break;
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
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
  }, [emails, filter, searchQuery, sortField, sortOrder]);

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

  const filters: { value: FilterType; label: string }[] = [
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Emails</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {processedEmails.length} emails {filter !== 'all' ? `(filtered from ${emails.length})` : 'in your archive'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search emails by subject, sender, or content..."
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map(f => (
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
              <span className="ml-1 opacity-70">
                ({emails.filter(e => {
                  switch (f.value) {
                    case 'account_signup': return e.emailType === 'account_signup';
                    case 'purchase': return e.emailType === 'purchase';
                    case 'unread': return !e.isRead;
                    case 'starred': return e.isStarred;
                    default: return false;
                  }
                }).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sort Options */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <ArrowUpDown className="w-4 h-4" />
          Sort by:
        </span>
        {sortOptions.map(option => (
          <button
            key={option.value}
            onClick={() => handleSortChange(option.value)}
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

      {/* Email List */}
      {paginatedEmails.length > 0 ? (
        <>
          <div className="space-y-3">
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
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {((currentPage - 1) * EMAILS_PER_PAGE) + 1} - {Math.min(currentPage * EMAILS_PER_PAGE, processedEmails.length)} of {processedEmails.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
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
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : emails.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No Emails Yet"
          description="Upload an OLM file to import your emails and start analyzing."
          actionLabel="Upload OLM File"
          actionTo="/"
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
