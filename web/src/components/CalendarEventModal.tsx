import { format } from 'date-fns';
import { X, Calendar, Clock, MapPin, Users, Mail, MailOpen, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '../types';

interface CalendarEventModalProps {
  event: CalendarEvent;
  isOpen: boolean;
  onClose: () => void;
  onToggleRead: (id: number) => void;
  onDelete: (id: number) => void;
}

export function CalendarEventModal({ 
  event, 
  isOpen, 
  onClose, 
  onToggleRead, 
  onDelete 
}: CalendarEventModalProps) {
  if (!isOpen) return null;

  const getTimeRange = () => {
    if (event.isAllDay) return 'All day';
    return `${format(event.startDate, 'h:mm a')} - ${format(event.endDate, 'h:mm a')}`;
  };

  const handleToggleRead = () => {
    if (event.id) {
      onToggleRead(event.id);
    }
  };

  const handleDelete = () => {
    if (event.id) {
      onDelete(event.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-3 rounded-lg flex-shrink-0 ${
              event.isAllDay
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
            }`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white truncate">
                  {event.title}
                </h2>
                {!event.isRead && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {format(event.startDate, 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Time */}
          <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
            <Clock className="w-5 h-5 text-slate-400" />
            <span>{getTimeRange()}</span>
            {event.isAllDay && (
              <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                All Day
              </span>
            )}
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
              <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Attendees */}
          {event.attendees.length > 0 && (
            <div className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
              <Users className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Attendees ({event.attendees.length})</p>
                <div className="flex flex-wrap gap-2">
                  {event.attendees.map((attendee, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-sm"
                    >
                      {attendee}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                Description
              </h3>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleRead}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                event.isRead
                  ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              {event.isRead ? (
                <>
                  <Mail className="w-4 h-4" />
                  Mark as unread
                </>
              ) : (
                <>
                  <MailOpen className="w-4 h-4" />
                  Mark as read
                </>
              )}
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

