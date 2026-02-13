import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Mail, MailOpen, Paperclip, Star, Users } from 'lucide-react';
import type { Email, EmailThread } from '../types';
import { useAppStore } from '../store';
import { stripHtml } from '../utils/emailUtils';

interface ThreadViewProps {
  thread: EmailThread;
  onEmailClick?: (email: Email) => void;
  initialExpanded?: boolean;
}

export function ThreadView({ thread, onEmailClick, initialExpanded = false }: ThreadViewProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const { toggleEmailStar, toggleEmailRead } = useAppStore();

  // Most recent email for preview
  const latestEmail = thread.emails[thread.emails.length - 1];
  const olderEmails = thread.emails.slice(0, -1);

  if (thread.messageCount === 1) {
    // Single email - render as normal email card
    return (
      <SingleEmailView 
        email={latestEmail} 
        onClick={() => onEmailClick?.(latestEmail)}
        onToggleStar={() => latestEmail.id && toggleEmailStar(latestEmail.id)}
      />
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Thread Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
      >
        <div className="flex-shrink-0 mt-1">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-900 dark:text-white truncate">
              {thread.subject || '(No Subject)'}
            </span>
            <span className="flex-shrink-0 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium">
              {thread.messageCount}
            </span>
            {thread.unreadCount > 0 && (
              <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full" />
            )}
            {thread.isStarred && (
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
            {thread.hasAttachments && (
              <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
          </div>
          
          <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
            {thread.participants.slice(0, 3).join(', ')}
            {thread.participants.length > 3 && ` +${thread.participants.length - 3} more`}
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
            {latestEmail.body.substring(0, 150)}...
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {format(thread.lastMessageDate, 'MMM d, yyyy')}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Thread */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          {/* Older emails */}
          {olderEmails.map((email) => (
            <ThreadEmailItem
              key={email.id}
              email={email}
              isLast={false}
              onClick={() => onEmailClick?.(email)}
              onToggleStar={() => email.id && toggleEmailStar(email.id)}
              onToggleRead={() => email.id && toggleEmailRead(email.id)}
            />
          ))}
          
          {/* Latest email (full) */}
          <ThreadEmailItem
            email={latestEmail}
            isLast={true}
            onClick={() => onEmailClick?.(latestEmail)}
            onToggleStar={() => latestEmail.id && toggleEmailStar(latestEmail.id)}
            onToggleRead={() => latestEmail.id && toggleEmailRead(latestEmail.id)}
            expanded
          />
        </div>
      )}
    </div>
  );
}

interface SingleEmailViewProps {
  email: Email;
  onClick: () => void;
  onToggleStar: () => void;
}

function SingleEmailView({ email, onClick, onToggleStar }: SingleEmailViewProps) {
  return (
    <div 
      className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 cursor-pointer hover:shadow-md transition-shadow ${
        !email.isRead ? 'border-l-4 border-l-blue-500' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            email.isRead 
              ? 'bg-slate-100 dark:bg-slate-700' 
              : 'bg-blue-100 dark:bg-blue-900/30'
          }`}>
            {email.isRead ? (
              <MailOpen className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            ) : (
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`truncate ${!email.isRead ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
              {email.senderName || email.sender}
            </span>
            {email.isStarred && (
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
            {email.attachments.length > 0 && (
              <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
          </div>
          
          <div className={`text-sm truncate ${!email.isRead ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
            {email.subject || '(No Subject)'}
          </div>

          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
            {stripHtml(email.body).substring(0, 100)}...
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {format(new Date(email.date), 'MMM d')}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar();
            }}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          >
            <Star className={`w-4 h-4 ${email.isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300 dark:text-slate-600'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ThreadEmailItemProps {
  email: Email;
  isLast: boolean;
  onClick: () => void;
  onToggleStar: () => void;
  onToggleRead: () => void;
  expanded?: boolean;
}

function ThreadEmailItem({ email, onClick, onToggleStar, expanded }: ThreadEmailItemProps) {
  const [showFull, setShowFull] = useState(expanded);

  return (
    <div className={`border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 ${
      !email.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
    }`}>
      <div 
        className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
        onClick={() => setShowFull(!showFull)}
      >
        <div className="flex-shrink-0">
          {email.isRead ? (
            <MailOpen className="w-4 h-4 text-slate-400 mt-1" />
          ) : (
            <Mail className="w-4 h-4 text-blue-500 mt-1" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${!email.isRead ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
              {email.senderName || email.sender}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {format(new Date(email.date), 'MMM d, h:mm a')}
            </span>
            {email.isStarred && (
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            )}
          </div>

          {showFull ? (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
              {stripHtml(email.body)}
            </div>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {stripHtml(email.body).substring(0, 100)}...
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar();
            }}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
          >
            <Star className={`w-4 h-4 ${email.isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300 dark:text-slate-600'}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-xs text-blue-500"
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

