import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, Mail, Star, Archive, Trash2, ChevronLeft, ChevronRight, 
  CheckSquare, X, Building2, User
} from 'lucide-react';
import { SearchInput } from '../components/SearchInput';
import { useAppStore } from '../store';
import { SYSTEM_FOLDERS } from '../types';

type ReadFilter = 'all' | 'unread' | 'read';
type FolderFilter = 'all' | 'inbox' | 'archive' | 'trash';
type TypeFilter = 'all' | 'account_signup' | 'purchase';

const EMAILS_PER_PAGE = 50;

export function SenderEmailsPage() {
  const { senderKey } = useParams<{ senderKey: string }>();
  const navigate = useNavigate();
  const { 
    emails, 
    toggleEmailStar, 
    toggleEmailRead,
    archiveEmail, 
    archiveEmails, 
    deleteEmail, 
    deleteEmails 
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set());

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Decode the sender key
  const decodedSenderKey = senderKey ? decodeURIComponent(senderKey) : '';

  // Get sender display name
  const senderDisplayName = useMemo(() => {
    // Try to find a sender name from the emails
    const senderEmail = emails.find(e => 
      e.sender.toLowerCase().includes(decodedSenderKey.toLowerCase())
    );
    if (senderEmail?.senderName) {
      return senderEmail.senderName;
    }
    // Capitalize domain name
    if (decodedSenderKey.includes('.')) {
      const parts = decodedSenderKey.split('.');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return decodedSenderKey;
  }, [emails, decodedSenderKey]);

  // Filter emails by sender
  const senderEmails = useMemo(() => {
    return emails.filter(email => 
      email.sender.toLowerCase().includes(decodedSenderKey.toLowerCase())
    );
  }, [emails, decodedSenderKey]);

  // Apply all filters
  const filteredEmails = useMemo(() => {
    let result = [...senderEmails];

    // Read filter
    if (readFilter === 'unread') {
      result = result.filter(e => !e.isRead);
    } else if (readFilter === 'read') {
      result = result.filter(e => e.isRead);
    }

    // Folder filter
    if (folderFilter === 'inbox') {
      result = result.filter(e => e.folderId === SYSTEM_FOLDERS.INBOX);
    } else if (folderFilter === 'archive') {
      result = result.filter(e => e.folderId === SYSTEM_FOLDERS.ARCHIVE);
    } else if (folderFilter === 'trash') {
      result = result.filter(e => e.folderId === SYSTEM_FOLDERS.TRASH);
    }

    // Type filter
    if (typeFilter === 'account_signup') {
      result = result.filter(e => e.emailType === 'account_signup');
    } else if (typeFilter === 'purchase') {
      result = result.filter(e => e.emailType === 'purchase');
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(email =>
        email.subject.toLowerCase().includes(query) ||
        email.body.toLowerCase().includes(query)
      );
    }

    // Sort by date descending
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return result;
  }, [senderEmails, readFilter, folderFilter, typeFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredEmails.length / EMAILS_PER_PAGE);
  const paginatedEmails = useMemo(() => {
    const start = (currentPage - 1) * EMAILS_PER_PAGE;
    return filteredEmails.slice(start, start + EMAILS_PER_PAGE);
  }, [filteredEmails, currentPage]);

  // Selection handlers
  const toggleEmailSelection = (emailId: number | undefined) => {
    if (!emailId) return;
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = paginatedEmails.map(e => e.id).filter((id): id is number => id !== undefined);
    const allSelected = allIds.every(id => selectedEmails.has(id));
    
    if (allSelected) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(allIds));
    }
  };

  const clearSelection = () => setSelectedEmails(new Set());

  // Bulk actions
  const handleBulkStar = async () => {
    for (const id of selectedEmails) {
      await toggleEmailStar(id);
    }
  };

  const handleBulkArchive = async () => {
    await archiveEmails(Array.from(selectedEmails));
    clearSelection();
  };

  const handleBulkDelete = async () => {
    await deleteEmails(Array.from(selectedEmails));
    clearSelection();
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/senders');
    }
  };

  // Check if sender looks like an organization (domain) or individual (email)
  const isOrganization = decodedSenderKey.includes('.') && !decodedSenderKey.includes('@');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            {isOrganization ? (
              <Building2 className="w-6 h-6 text-blue-600" />
            ) : (
              <User className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {senderDisplayName}
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              {senderEmails.length} total emails • Showing {filteredEmails.length} 
              {readFilter !== 'all' || folderFilter !== 'all' || typeFilter !== 'all' ? ' (filtered)' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={searchQuery}
          onChange={(q) => { setSearchQuery(q); setCurrentPage(1); }}
          placeholder="Search within these emails..."
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Read Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Status:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
              { value: 'read', label: 'Read' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => { setReadFilter(opt.value as ReadFilter); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  readFilter === opt.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Folder Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Folder:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'inbox', label: 'Inbox' },
              { value: 'archive', label: 'Archive' },
              { value: 'trash', label: 'Trash' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => { setFolderFilter(opt.value as FolderFilter); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  folderFilter === opt.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Type:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'account_signup', label: 'Account' },
              { value: 'purchase', label: 'Purchase' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => { setTypeFilter(opt.value as TypeFilter); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  typeFilter === opt.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Select All Header */}
      {paginatedEmails.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-t-lg border border-b-0 border-slate-200 dark:border-slate-700">
          <input
            type="checkbox"
            checked={paginatedEmails.every(e => e.id && selectedEmails.has(e.id))}
            onChange={selectAll}
            className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Select all ({paginatedEmails.length})
          </span>
        </div>
      )}

      {/* Email List */}
      {paginatedEmails.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-b-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
          {paginatedEmails.map(email => {
            const isSelected = email.id ? selectedEmails.has(email.id) : false;
            const isInTrash = email.folderId === SYSTEM_FOLDERS.TRASH;
            const isInArchive = email.folderId === SYSTEM_FOLDERS.ARCHIVE;
            
            return (
              <div
                key={email.id}
                className={`group/row px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                } ${!email.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleEmailSelection(email.id)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                />
                
                {/* Unread indicator */}
                {!email.isRead && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                )}
                
                {/* Email content - clickable */}
                <button
                  onClick={() => navigate(`/emails/${email.id}`)}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left"
                >
                  <Mail className={`w-4 h-4 flex-shrink-0 ${email.isRead ? 'text-slate-400' : 'text-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`truncate ${email.isRead ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-slate-900 dark:text-white'}`}>
                      {email.subject || '(No Subject)'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {email.body?.substring(0, 100)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Folder badge */}
                    {email.folderId !== SYSTEM_FOLDERS.INBOX && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        email.folderId === SYSTEM_FOLDERS.ARCHIVE 
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      }`}>
                        {email.folderId === SYSTEM_FOLDERS.ARCHIVE ? 'Archive' : 'Trash'}
                      </span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {format(email.date, 'MMM d, yyyy')}
                    </span>
                  </div>
                </button>
                
                {/* Quick actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (email.id) toggleEmailStar(email.id);
                    }}
                    className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-colors"
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star className={`w-4 h-4 ${email.isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-slate-400 hover:text-yellow-500'}`} />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (email.id) toggleEmailRead(email.id);
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                    title={email.isRead ? 'Mark unread' : 'Mark read'}
                  >
                    <Mail className={`w-4 h-4 ${email.isRead ? 'text-slate-400' : 'text-blue-500'}`} />
                  </button>
                  
                  {!isInArchive && !isInTrash && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (email.id) archiveEmail(email.id);
                      }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded transition-colors"
                      title="Archive"
                    >
                      <Archive className="w-4 h-4 text-slate-400 hover:text-blue-500" />
                    </button>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (email.id) deleteEmail(email.id);
                    }}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <Mail className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            {senderEmails.length === 0 
              ? 'No emails found from this sender' 
              : 'No emails match your filters'
            }
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {((currentPage - 1) * EMAILS_PER_PAGE) + 1} - {Math.min(currentPage * EMAILS_PER_PAGE, filteredEmails.length)} of {filteredEmails.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Page {currentPage} of {totalPages}
            </span>

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

      {/* Bulk Action Bar */}
      {selectedEmails.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-slate-900 dark:bg-slate-700 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-400" />
              <span className="font-medium">{selectedEmails.size} selected</span>
            </div>
            
            <div className="h-6 w-px bg-slate-600" />
            
            <button
              onClick={handleBulkStar}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
              title="Star selected"
            >
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-sm">Star</span>
            </button>
            
            <button
              onClick={handleBulkArchive}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
              title="Archive selected"
            >
              <Archive className="w-4 h-4 text-blue-400" />
              <span className="text-sm">Archive</span>
            </button>
            
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-600 rounded-lg transition-colors"
              title="Delete selected"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span className="text-sm">Delete</span>
            </button>
            
            <div className="h-6 w-px bg-slate-600" />
            
            <button
              onClick={clearSelection}
              className="p-1.5 hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
              title="Clear selection"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

