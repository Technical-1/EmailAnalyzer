import { useMemo } from 'react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { useAppStore } from '../store';
import type { CalendarEvent } from '../types';

export function CalendarPage() {
  const { calendarEvents } = useAppStore();

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d');
  };

  const getTimeRange = (event: CalendarEvent) => {
    if (event.isAllDay) return 'All day';
    return `${format(event.startDate, 'h:mm a')} - ${format(event.endDate, 'h:mm a')}`;
  };

  // Group events by date
  const { groupedEvents, sortedDates } = useMemo(() => {
    const grouped = calendarEvents.reduce((groups, event) => {
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
  }, [calendarEvents]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Calendar Events</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {calendarEvents.length} events from your emails
        </p>
      </div>

      {calendarEvents.length > 0 ? (
        <div className="space-y-8">
          {sortedDates.slice(0, 50).map(dateKey => {
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
                      className={`bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 ${
                        isDatePast ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${
                          event.isAllDay
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                        }`}>
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {event.title}
                          </h3>

                          <div className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span>{getTimeRange(event)}</span>
                            </div>

                            {event.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span>{event.location}</span>
                              </div>
                            )}

                            {event.attendees.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                <span>{event.attendees.length} attendee(s)</span>
                              </div>
                            )}
                          </div>

                          {event.description && (
                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {sortedDates.length > 50 && (
            <p className="text-center text-slate-500 dark:text-slate-400 py-4">
              Showing 50 of {sortedDates.length} days with events.
            </p>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Calendar}
          title="No Calendar Events"
          description="Upload an OLM file to import calendar events from your Outlook archive."
          actionLabel="Upload OLM File"
          actionTo="/"
        />
      )}
    </div>
  );
}
