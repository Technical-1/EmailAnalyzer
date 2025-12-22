import { format } from 'date-fns';
import { Star, Mail, MailOpen, ShoppingBag, UserCheck } from 'lucide-react';
import type { Email } from '../types';

interface EmailCardProps {
  email: Email;
  onClick: () => void;
}

export function EmailCard({ email, onClick }: EmailCardProps) {
  const TypeIcon = email.emailType === 'purchase' 
    ? ShoppingBag 
    : email.emailType === 'account_signup' 
      ? UserCheck 
      : email.isRead ? MailOpen : Mail;

  const typeColor = email.emailType === 'purchase'
    ? 'text-green-500'
    : email.emailType === 'account_signup'
      ? 'text-purple-500'
      : 'text-slate-400';

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-slate-800 rounded-lg p-4 cursor-pointer transition-all
        border border-slate-200 dark:border-slate-700
        hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600
        ${!email.isRead ? 'border-l-4 border-l-blue-500' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-700 ${typeColor}`}>
          <TypeIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`font-medium truncate ${!email.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
              {email.subject || '(No Subject)'}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {email.isStarred && (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              )}
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {format(email.date, 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {email.sender}
          </p>

          <p className="text-sm text-slate-400 dark:text-slate-500 mt-2 line-clamp-2">
            {email.body?.substring(0, 150)}...
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
        </div>
      </div>
    </div>
  );
}

