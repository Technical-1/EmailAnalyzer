import { memo, useMemo } from 'react';
import { format } from 'date-fns';
import { Star, Mail, MailOpen, ShoppingBag, UserCheck, Archive, Trash2, Circle } from 'lucide-react';
import type { Email } from '../types';
import { useAppStore } from '../store';
import { SYSTEM_FOLDERS } from '../types';
import { makeSnippet } from '../services/mimeUtils';

interface EmailCardProps {
  email: Email;
  onClick: () => void;
}

export const EmailCard = memo(function EmailCard({ email, onClick }: EmailCardProps) {
  const { toggleEmailStar, toggleEmailRead, archiveEmail, deleteEmail, restoreEmail } = useAppStore();

  const preview = useMemo(
    () => email.snippet ?? makeSnippet(email.body ?? ''),
    [email.snippet, email.body]
  );

  const TypeIcon = email.emailType === 'purchase'
    ? ShoppingBag 
    : email.emailType === 'account_signup' 
      ? UserCheck 
      : email.isRead ? MailOpen : Mail;

  const typeColor = email.emailType === 'purchase'
    ? 'text-green-500'
    : email.emailType === 'account_signup'
      ? 'text-purple-500'
      : email.isRead ? 'text-slate-400' : 'text-blue-500';

  // Stop propagation helper for quick actions
  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  const isInTrash = email.folderId === SYSTEM_FOLDERS.TRASH;
  const isInArchive = email.folderId === SYSTEM_FOLDERS.ARCHIVE;

  return (
    <div
      onClick={onClick}
      role="listitem"
      aria-label={`${!email.isRead ? 'Unread: ' : ''}${email.subject || '(No Subject)'} from ${email.sender}`}
      className={`
        group rounded-lg p-4 cursor-pointer transition-all
        border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600
        ${!email.isRead
          ? 'bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500'
          : 'bg-white dark:bg-slate-800'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Unread indicator dot */}
        <div className="flex flex-col items-center gap-1">
          {!email.isRead && (
            <Circle className="w-2.5 h-2.5 text-blue-500 fill-blue-500" />
          )}
          <div className={`p-2 rounded-lg ${!email.isRead ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-slate-100 dark:bg-slate-700'} ${typeColor}`}>
            <TypeIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`truncate ${!email.isRead ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-300 font-medium'}`}>
              {email.subject || '(No Subject)'}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Quick Actions - visible on hover */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Toggle Read */}
                <button
                  onClick={(e) => handleAction(e, () => email.id && toggleEmailRead(email.id))}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  title={email.isRead ? 'Mark as unread' : 'Mark as read'}
                >
                  {email.isRead ? (
                    <Mail className="w-4 h-4 text-slate-400" />
                  ) : (
                    <MailOpen className="w-4 h-4 text-blue-500" />
                  )}
                </button>
                
                {/* Archive or Restore */}
                {isInTrash ? (
                  <button
                    onClick={(e) => handleAction(e, () => email.id && restoreEmail(email.id))}
                    className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                    title="Restore from trash"
                  >
                    <Archive className="w-4 h-4 text-green-500" />
                  </button>
                ) : !isInArchive && (
                  <button
                    onClick={(e) => handleAction(e, () => email.id && archiveEmail(email.id))}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                    title="Archive"
                  >
                    <Archive className="w-4 h-4 text-slate-400" />
                  </button>
                )}
                
                {/* Delete */}
                <button
                  onClick={(e) => handleAction(e, () => email.id && deleteEmail(email.id))}
                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                  title={isInTrash ? 'Delete permanently' : 'Move to trash'}
                >
                  <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                </button>
              </div>
              
              {/* Star Button - always visible */}
              <button
                onClick={(e) => handleAction(e, () => email.id && toggleEmailStar(email.id))}
                className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-colors"
                title={email.isStarred ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star className={`w-4 h-4 ${email.isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300 hover:text-yellow-500'}`} />
              </button>
              
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                {email.date ? format(email.date, 'MMM d, yyyy') : 'Unknown date'}
              </span>
            </div>
          </div>

          <p className={`text-sm mt-1 ${!email.isRead ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
            {email.sender}
          </p>

          <p className="text-sm text-slate-400 dark:text-slate-500 mt-2 line-clamp-2">
            {preview}
          </p>

          {email.emailType !== 'regular' && (
            <div className="mt-2 flex items-center gap-2">
              {email.emailType === 'account_signup' && email.detectedAccount && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                  Account: {email.detectedAccount}
                </span>
              )}
              {email.emailType === 'purchase' && email.purchaseAmount && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  ${email.purchaseAmount.toFixed(2)} - {email.purchaseMerchant}
                </span>
              )}
            </div>
          )}

          {email.tags && email.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {email.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

