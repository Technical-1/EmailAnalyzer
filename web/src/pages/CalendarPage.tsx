import { useState, useMemo } from 'react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { Calendar, MapPin, Users, Clock, Mail, MailOpen, Trash2, CheckSquare, X } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { SearchInput } from '../components/SearchInput';
import { CalendarEventModal } from '../components/CalendarEventModal';
import { useAppStore } from '../store';
import type { CalendarEvent } from '../types';

type FilterBy = 'all' | 'unread' | 'read' | 'upcoming' | 'past';

export function CalendarPage() {
  const { 
    calendarEvents, 
    toggleCalendarEventRead, 
    deleteCalendarEvent, 
    deleteCalendarEvents 
  } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d');
  };

  const getTimeRange = (event: CalendarEvent) => {
    if (event.isAllDay) return 'All day';
    return `${format(event.startDate, 'h:mm a')} - ${format(event.endDate, 'h:mm a')}`;
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = [...calendarEvents];
    
    // Apply filter
    const now = new Date();
    switch (filterBy) {
      case 'unread':
        result = result.filter(e => !e.isRead);
        break;
      case 'read':
        result = result.filter(e => e.isRead);
        break;
      case 'upcoming':
        result = result.filter(e => e.startDate >= now);
        break;
      case 'past':
        result = result.filter(e => e.startDate < now);
        break;
    }
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.title.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [calendarEvents, filterBy, searchQuery]);

  // Group events by date
  const { groupedEvents, sortedDates } = useMemo(() => {
    const grouped = filteredEvents.reduce((groups, event) => {
      const dateKey = format(event.startDate, 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
      return groups;
    }, {} as Record<string, CalendarEvent[]>);

    return {
      groupedEvents: grouped,
      sortedDates: Object.keys(grouped).sort(),
    };
  }, [filteredEvents]);

  // Stats
  const stats = useMemo(() => {
    const unread = calendarEvents.filter(e => !e.isRead).length;
    const upcoming = calendarEvents.filter(e => e.startDate >= new Date()).length;
    return { unread, upcoming, total: calendarEvents.length };
  }, [calendarEvents]);

  // Selection handlers
  const handleToggleSelect = (id: number) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEvents(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEvents.size === filteredEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.id!)));
    }
  };

  const handleBulkMarkAsRead = async () => {
    for (const id of selectedEvents) {
      const event = calendarEvents.find(e => e.id === id);
      if (event && !event.isRead) {
        await toggleCalendarEventRead(id);
      }
    }
    setSelectedEvents(new Set());
  };

  const handleBulkMarkAsUnread = async () => {
    for (const id of selectedEvents) {
      const event = calendarEvents.find(e => e.id === id);
      if (event && event.isRead) {
        await toggleCalendarEventRead(id);
      }
    }
    setSelectedEvents(new Set());
  };

  const handleBulkDelete = async () => {
    await deleteCalendarEvents(Array.from(selectedEvents));
    setSelectedEvents(new Set());
  };

  const handleEventClick = (event: CalendarEvent) => {
    setModalEvent(event);
  };

  const handleCloseModal = () => {
    setModalEvent(null);
  };

  const handleToggleRead = (id: number) => {
    toggleCalendarEventRead(id);
    // Update the modal event if it's the same one
    if (modalEvent?.id === id) {
      const updatedEvent = calendarEvents.find(e => e.id === id);
      if (updatedEvent) {
        setModalEvent({ ...updatedEvent, isRead: !updatedEvent.isRead });
      }
    }
  };

  const handleDeleteEvent = (id: number) => {
    deleteCalendarEvent(id);
    setModalEvent(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Calendar Events</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {stats.total} events • {stats.unread} unread • {stats.upcoming} upcoming
          </p>
        </div>
      </div>

      {calendarEvents.length > 0 && (
        <>
          <div className="mb-4">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search events by title, location, or description..."
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-sm text-slate-500 dark:text-slate-400">Filter:</span>
            {[
              { value: 'all' as const, label: 'All' },
              { value: 'unread' as const, label: `Unread (${stats.unread})` },
              { value: 'read' as const, label: 'Read' },
              { value: 'upcoming' as const, label: 'Upcoming' },
              { value: 'past' as const, label: 'Past' },
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
            
            {filteredEvents.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <CheckSquare className="w-4 h-4" />
                {selectedEvents.size === filteredEvents.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
        </>
      )}

      {filteredEvents.length > 0 ? (
        <div className="space-y-8">
          {sortedDates.map(dateKey => {
            const dateEvents = groupedEvents[dateKey];
            const date = new Date(dateKey);
            const isDatePast = isPast(date) && !isToday(date);

            return (
              <div key={dateKey}>
                <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                  isDatePast ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
                }`}>
                  <Calendar className="w-5 h-5" />
                  {getDateLabel(date)}
                  {isToday(date) && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                      Today
                    </span>
                  )}
                </h2>

                <div className="space-y-3">
                  {dateEvents.map(event => (
                    <div
                      key={event.id}
                      className={`group relative bg-white dark:bg-slate-800 rounded-xl shadow-sm border transition-all cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 ${
                        isDatePast ? 'opacity-60' : ''
                      } ${
                        !event.isRead 
                          ? 'border-l-4 border-l-blue-500 border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10' 
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Checkbox */}
                          <div className="flex items-center pt-1">
                            <input
                              type="checkbox"
                              checked={selectedEvents.has(event.id!)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleSelect(event.id!);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="form-checkbox h-4 w-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-blue-500"
                            />
                          </div>
                          
                          {/* Icon */}
                          <div className={`p-3 rounded-lg flex-shrink-0 ${
                            !event.isRead
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                              : event.isAllDay
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                            <Calendar className="w-5 h-5" />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold truncate ${
                                !event.isRead 
                                  ? 'text-slate-900 dark:text-white' 
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}>
                                {event.title}
                              </h3>
                              {!event.isRead && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{getTimeRange(event)}</span>
                              </div>

                              {event.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  <span className="truncate max-w-48">{event.location}</span>
                                </div>
                              )}

                              {event.attendees.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Users className="w-4 h-4" />
                                  <span>{event.attendees.length}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCalendarEventRead(event.id!);
                              }}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title={event.isRead ? 'Mark as unread' : 'Mark as read'}
                            >
                              {event.isRead ? (
                                <Mail className="w-4 h-4 text-slate-400" />
                              ) : (
                                <MailOpen className="w-4 h-4 text-blue-500" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCalendarEvent(event.id!);
                              }}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete event"
                            >
                              <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : calendarEvents.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No Calendar Events"
          description="Upload an OLM file to import calendar events from your Outlook archive."
          actionLabel="Upload OLM File"
          actionTo="/"
        />
      ) : (
        <EmptyState
          icon={Calendar}
          title="No Results"
          description="Try a different search term or filter."
        />
      )}

      {/* Bulk action bar */}
      {selectedEvents.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50">
          <span className="font-medium">{selectedEvents.size} event{selectedEvents.size > 1 ? 's' : ''} selected</span>
          <button
            onClick={handleBulkMarkAsRead}
            className="p-2 hover:bg-blue-700 rounded-full transition-colors"
            title="Mark as read"
          >
            <MailOpen className="w-5 h-5" />
          </button>
          <button
            onClick={handleBulkMarkAsUnread}
            className="p-2 hover:bg-blue-700 rounded-full transition-colors"
            title="Mark as unread"
          >
            <Mail className="w-5 h-5" />
          </button>
          <button
            onClick={handleBulkDelete}
            className="p-2 hover:bg-blue-700 rounded-full transition-colors"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSelectedEvents(new Set())}
            className="p-2 hover:bg-blue-700 rounded-full transition-colors"
            title="Clear selection"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Event Modal */}
      {modalEvent && (
        <CalendarEventModal
          event={modalEvent}
          isOpen={!!modalEvent}
          onClose={handleCloseModal}
          onToggleRead={handleToggleRead}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
  );
}
