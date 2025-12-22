import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Users, Mail } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { SearchInput } from '../components/SearchInput';
import { useAppStore } from '../store';

export function ContactsPage() {
  const { contacts } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      c => c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contacts</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {contacts.length} contacts from your emails
          </p>
        </div>
      </div>

      {contacts.length > 0 && (
        <div className="mb-6">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search contacts..."
          />
        </div>
      )}

      {filteredContacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.slice(0, 100).map(contact => (
            <div
              key={contact.id}
              className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${getAvatarColor(contact.name)}`}>
                  {getInitials(contact.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {contact.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {contact.email}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  <span>{contact.emailCount} emails</span>
                </div>
                <span>
                  Last: {format(contact.lastEmailDate, 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          ))}
          {filteredContacts.length > 100 && (
            <div className="col-span-full text-center text-slate-500 dark:text-slate-400 py-4">
              Showing 100 of {filteredContacts.length} contacts. Use search to find specific contacts.
            </div>
          )}
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Contacts Yet"
          description="Upload an OLM file to import contacts from your emails."
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
