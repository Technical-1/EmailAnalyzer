import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Users, Mail, Phone, Tag, Edit2, FileText } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { SearchInput } from '../components/SearchInput';
import { ContactModal } from '../components/ContactModal';
import { useAppStore } from '../store';
import type { Contact } from '../types';

type SortBy = 'name' | 'emailCount' | 'lastActivity';
type FilterBy = 'all' | 'with-phone' | 'with-tags';

export function ContactsPage() {
  const navigate = useNavigate();
  const { contacts, updateContact } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('emailCount');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredContacts = useMemo(() => {
    let result = [...contacts];
    
    // Filter by type
    switch (filterBy) {
      case 'with-phone':
        result = result.filter(c => c.phone);
        break;
      case 'with-tags':
        result = result.filter(c => c.tags && c.tags.length > 0);
        break;
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        c => c.name.toLowerCase().includes(query) || 
             c.email.toLowerCase().includes(query) ||
             (c.phone && c.phone.includes(query)) ||
             (c.tags && c.tags.some(t => t.toLowerCase().includes(query)))
      );
    }
    
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'emailCount':
          return b.emailCount - a.emailCount;
        case 'lastActivity':
          return (b.lastEmailDate?.getTime() ?? -Infinity) - (a.lastEmailDate?.getTime() ?? -Infinity);
        default:
          return 0;
      }
    });
    
    return result;
  }, [contacts, searchQuery, sortBy, filterBy]);

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
      'from-blue-400 to-blue-600',
      'from-green-400 to-green-600',
      'from-purple-400 to-purple-600',
      'from-orange-400 to-orange-600',
      'from-pink-400 to-pink-600',
      'from-teal-400 to-teal-600',
      'from-indigo-400 to-indigo-600',
      'from-red-400 to-red-600',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleOpenEditContact = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingContact(contact);
    setIsModalOpen(true);
  };

  const handleSaveContact = async (contactData: { id: number } & Partial<Contact>) => {
    if (contactData.id) {
      await updateContact(contactData.id, contactData);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const withPhone = contacts.filter(c => c.phone).length;
    const withTags = contacts.filter(c => c.tags && c.tags.length > 0).length;
    return { withPhone, withTags };
  }, [contacts]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contacts</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {contacts.length} contacts{stats.withPhone > 0 && ` • ${stats.withPhone} with phone`}{stats.withTags > 0 && ` • ${stats.withTags} tagged`}
        </p>
      </div>

      {contacts.length > 0 && (
        <>
          <div className="mb-4">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, email, phone, or tag..."
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Filter:</span>
              {[
                { value: 'all' as const, label: 'All' },
                { value: 'with-phone' as const, label: 'With Phone' },
                { value: 'with-tags' as const, label: 'Tagged' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setFilterBy(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterBy === option.value
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-slate-500 dark:text-slate-400">Sort by:</span>
              {[
                { value: 'emailCount' as const, label: 'Emails' },
                { value: 'name' as const, label: 'Name' },
                { value: 'lastActivity' as const, label: 'Recent' },
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
          </div>
        </>
      )}

      {filteredContacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map(contact => (
            <div
              key={contact.id}
              className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
              onClick={() => navigate(`/sender/${encodeURIComponent(contact.email)}`)}
            >
              {/* Edit button */}
              <button
                onClick={(e) => handleOpenEditContact(contact, e)}
                className="absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                title="Edit contact"
              >
                <Edit2 className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
              </button>

              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br ${getAvatarColor(contact.name)} shadow-sm flex-shrink-0`}>
                  {getInitials(contact.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate text-lg">
                    {contact.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {contact.email}
                  </p>
                </div>
              </div>

              {/* Contact details */}
              <div className="mt-4 space-y-2">
                {/* Phone */}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Phone className="w-4 h-4 text-green-500" />
                    <span>{contact.phone}</span>
                  </div>
                )}

                {/* Email count & last activity */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <Mail className="w-4 h-4 text-blue-500" />
                    <span>{contact.emailCount} emails</span>
                  </div>
                  <span className="text-slate-400 dark:text-slate-500">•</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {contact.lastEmailDate ? format(contact.lastEmailDate, 'MMM d, yyyy') : 'Unknown date'}
                  </span>
                </div>

                {/* Notes preview */}
                {contact.notes && (
                  <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{contact.notes}</span>
                  </div>
                )}

                {/* Tags */}
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Tag className="w-4 h-4 text-purple-500" />
                    {contact.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
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
          description="Try a different search term or filter."
        />
      )}

      {/* Contact Modal */}
      {editingContact && (
        <ContactModal
          key={`${editingContact.id}-${isModalOpen}`}
          contact={editingContact}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveContact}
        />
      )}
    </div>
  );
}
