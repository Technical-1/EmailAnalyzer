import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, Mail, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { SearchInput } from '../components/SearchInput';
import { EmptyState } from '../components/EmptyState';
import { useAppStore } from '../store';
import type { Email } from '../types';

type GroupMode = 'sender' | 'organization';

interface EmailGroup {
  key: string;
  displayName: string;
  emails: Email[];
  latestDate: Date;
}

export function SendersPage() {
  const navigate = useNavigate();
  const { emails } = useAppStore();
  const [groupMode, setGroupMode] = useState<GroupMode>('organization');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'count' | 'name' | 'date'>('count');

  // Group emails by sender or organization
  const groupedEmails = useMemo(() => {
    const groups = new Map<string, EmailGroup>();

    emails.forEach(email => {
      const sender = email.sender.toLowerCase();
      let key: string;
      let displayName: string;

      if (groupMode === 'sender') {
        key = sender;
        displayName = email.senderName || sender;
      } else {
        // Extract domain/organization
        const atIndex = sender.indexOf('@');
        if (atIndex !== -1) {
          const domain = sender.substring(atIndex + 1);
          // Get the main domain part (e.g., "amazon" from "email.amazon.com")
          const parts = domain.split('.');
          if (parts.length >= 2) {
            // Take the second-to-last part as the org name
            key = parts[parts.length - 2] + '.' + parts[parts.length - 1];
            displayName = parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
          } else {
            key = domain;
            displayName = domain;
          }
        } else {
          key = sender;
          displayName = sender;
        }
      }

      const existing = groups.get(key);
      if (existing) {
        existing.emails.push(email);
        if (new Date(email.date) > existing.latestDate) {
          existing.latestDate = new Date(email.date);
        }
      } else {
        groups.set(key, {
          key,
          displayName,
          emails: [email],
          latestDate: new Date(email.date),
        });
      }
    });

    // Convert to array and filter by search
    let result = Array.from(groups.values());

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(group =>
        group.displayName.toLowerCase().includes(query) ||
        group.key.toLowerCase().includes(query) ||
        group.emails.some(e => e.subject.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'count':
          return b.emails.length - a.emails.length;
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        case 'date':
          return b.latestDate.getTime() - a.latestDate.getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [emails, groupMode, searchQuery, sortBy]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
      'bg-indigo-500',
      'bg-red-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {groupMode === 'sender' ? 'Senders' : 'Organizations'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {groupedEmails.length} {groupMode === 'sender' ? 'senders' : 'organizations'} from {emails.length} emails
          </p>
        </div>
      </div>

      {/* Toggle and Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setGroupMode('organization')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              groupMode === 'organization'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Organizations
          </button>
          <button
            onClick={() => setGroupMode('sender')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              groupMode === 'sender'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Individual Senders
          </button>
        </div>
        <div className="flex-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={`Search ${groupMode === 'sender' ? 'senders' : 'organizations'}...`}
          />
        </div>
      </div>

      {/* Sort Options */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-slate-500 dark:text-slate-400">Sort by:</span>
        {[
          { value: 'count' as const, label: 'Email Count' },
          { value: 'name' as const, label: 'Name' },
          { value: 'date' as const, label: 'Recent Activity' },
        ].map(option => (
          <button
            key={option.value}
            onClick={() => setSortBy(option.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sortBy === option.value
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Groups List */}
      {groupedEmails.length > 0 ? (
        <div className="space-y-2">
          {groupedEmails.map(group => (
            <div
              key={group.key}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${getAvatarColor(group.displayName)}`}>
                  {groupMode === 'organization' ? (
                    <Building2 className="w-5 h-5" />
                  ) : (
                    getInitials(group.displayName)
                  )}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {group.displayName}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {group.key}
                  </p>
                </div>
                <div className="text-right mr-4">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {group.emails.length} email{group.emails.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Last: {format(group.latestDate, 'MMM d, yyyy')}
                  </p>
                </div>
                {expandedGroups.has(group.key) ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {/* Expanded Emails */}
              {expandedGroups.has(group.key) && (
                <div className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
                  {group.emails.slice(0, 10).map(email => (
                    <button
                      key={email.id}
                      onClick={() => navigate(`/emails/${email.id}`)}
                      className="w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left"
                    >
                      <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`truncate ${email.isRead ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-slate-900 dark:text-white'}`}>
                          {email.subject || '(No Subject)'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {email.sender}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                        {format(email.date, 'MMM d, yyyy')}
                      </span>
                    </button>
                  ))}
                  {group.emails.length > 10 && (
                    <div className="px-5 py-3 text-center">
                      <button
                        onClick={() => navigate(`/emails?search=${encodeURIComponent(group.key)}`)}
                        className="text-sm text-blue-500 hover:text-blue-600"
                      >
                        View all {group.emails.length} emails →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : emails.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Emails Yet"
          description="Upload an OLM file to see your senders and organizations."
          actionLabel="Upload OLM File"
          actionTo="/"
        />
      ) : (
        <EmptyState
          icon={Users}
          title="No Results"
          description="Try a different search term."
        />
      )}
    </div>
  );
}

