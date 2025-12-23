import { useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Star, Mail, MailOpen, ShoppingBag, UserCheck, Paperclip, Archive, Trash2, RotateCcw, MailCheck } from 'lucide-react';
import { useAppStore } from '../store';
import { SYSTEM_FOLDERS } from '../types';

export function EmailDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    emails,
    toggleEmailStar, 
    toggleEmailRead,
    markEmailAsRead,
    archiveEmail,
    deleteEmail,
    restoreEmail,
    permanentlyDeleteEmail,
  } = useAppStore();
  
  // Get return URL from navigation state (preserves view mode)
  const returnUrl = (location.state as { returnUrl?: string })?.returnUrl;

  // Get email directly from emails array so component re-renders when it changes
  const email = useMemo(() => {
    if (!id) return null;
    const emailId = parseInt(id);
    return emails.find(e => e.id === emailId) ?? null;
  }, [id, emails]);

  // Scroll to top when opening email
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Mark email as read when viewing
  useEffect(() => {
    if (email?.id && !email.isRead) {
      markEmailAsRead(email.id);
    }
  }, [email?.id, email?.isRead, markEmailAsRead]);

  const handleBack = () => {
    // Use return URL from state if available (preserves view mode like threads)
    if (returnUrl) {
      navigate(returnUrl);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/emails');
    }
  };

  if (!email) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">Email not found</p>
        <button
          onClick={handleBack}
          className="mt-4 text-blue-500 hover:text-blue-600"
        >
          Go Back
        </button>
      </div>
    );
  }

  const TypeIcon = email.emailType === 'purchase' 
    ? ShoppingBag 
    : email.emailType === 'account_signup' 
      ? UserCheck 
      : email.isRead ? MailOpen : Mail;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex-1 truncate">
          {email.subject || '(No Subject)'}
        </h1>
        
        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Toggle read/unread */}
          <button
            onClick={() => email.id && toggleEmailRead(email.id)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={email.isRead ? 'Mark as unread' : 'Mark as read'}
          >
            {email.isRead ? (
              <Mail className="w-5 h-5 text-slate-400" />
            ) : (
              <MailCheck className="w-5 h-5 text-blue-500" />
            )}
          </button>
          
          {/* Star */}
          <button
            onClick={() => email.id && toggleEmailStar(email.id)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={email.isStarred ? 'Remove star' : 'Add star'}
          >
            <Star className={`w-5 h-5 ${email.isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-slate-400'}`} />
          </button>
          
          {/* Archive/Restore based on folder */}
          {email.folderId === SYSTEM_FOLDERS.TRASH ? (
            <button
              onClick={() => {
                if (email.id) {
                  restoreEmail(email.id);
                  handleBack();
                }
              }}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Restore from trash"
            >
              <RotateCcw className="w-5 h-5 text-green-500" />
            </button>
          ) : email.folderId !== SYSTEM_FOLDERS.ARCHIVE ? (
            <button
              onClick={() => {
                if (email.id) {
                  archiveEmail(email.id);
                  handleBack();
                }
              }}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Archive"
            >
              <Archive className="w-5 h-5 text-slate-400" />
            </button>
          ) : null}
          
          {/* Delete/Permanent delete */}
          {email.folderId === SYSTEM_FOLDERS.TRASH ? (
            <button
              onClick={() => {
                if (email.id && confirm('Permanently delete this email? This cannot be undone.')) {
                  permanentlyDeleteEmail(email.id);
                  handleBack();
                }
              }}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              title="Delete permanently"
            >
              <Trash2 className="w-5 h-5 text-red-500" />
            </button>
          ) : (
            <button
              onClick={() => {
                if (email.id) {
                  deleteEmail(email.id);
                  handleBack();
                }
              }}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Move to trash"
            >
              <Trash2 className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Email content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        {/* Metadata */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${
              email.emailType === 'purchase' 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600' 
                : email.emailType === 'account_signup'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
            }`}>
              <TypeIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-900 dark:text-white">
                  {email.senderName || email.sender}
                </span>
                {email.senderName && (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    &lt;{email.sender}&gt;
                  </span>
                )}
                {email.emailType !== 'regular' && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    email.emailType === 'purchase'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  }`}>
                    {email.emailType === 'purchase' ? 'Purchase' : 'Account Signup'}
                  </span>
                )}
              </div>
              {email.recipients.length > 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  To: {email.recipients.join(', ')}
                </div>
              )}
              <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                {format(email.date, 'EEEE, MMMM d, yyyy \'at\' h:mm a')}
                {email.folderId !== SYSTEM_FOLDERS.INBOX && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    email.folderId === SYSTEM_FOLDERS.ARCHIVE 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : email.folderId === SYSTEM_FOLDERS.TRASH
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {email.folderId === SYSTEM_FOLDERS.ARCHIVE ? 'Archived' : 
                     email.folderId === SYSTEM_FOLDERS.TRASH ? 'Trash' : 
                     email.folderId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Detection info */}
          {email.emailType === 'account_signup' && email.detectedAccount && (
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                <strong>Detected Account:</strong> {email.detectedAccount}
              </p>
            </div>
          )}

          {email.emailType === 'purchase' && email.purchaseAmount && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300">
                <strong>Purchase Amount:</strong> ${email.purchaseAmount.toFixed(2)}
                {email.purchaseMerchant && ` from ${email.purchaseMerchant}`}
              </p>
            </div>
          )}

          {/* Attachments */}
          {email.attachments.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                <Paperclip className="w-4 h-4" />
                <span>{email.attachments.length} attachment(s)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map(attachment => (
                  <div
                    key={attachment.id}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm"
                  >
                    {attachment.filename} ({(attachment.size / 1024).toFixed(1)} KB)
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {email.htmlBody ? (
            <iframe
              srcDoc={`
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    * { box-sizing: border-box; }
                    body { 
                      margin: 0; 
                      padding: 0; 
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                      font-size: 14px;
                      line-height: 1.5;
                      color: #334155;
                      background: transparent;
                    }
                    a { color: #3b82f6; }
                    img { max-width: 100%; height: auto; }
                    table { max-width: 100%; }
                  </style>
                </head>
                <body>${email.htmlBody}</body>
                </html>
              `}
              className="w-full border-0 min-h-[400px]"
              style={{ 
                height: 'auto',
                minHeight: '400px',
              }}
              onLoad={(e) => {
                const iframe = e.target as HTMLIFrameElement;
                if (iframe.contentDocument) {
                  const height = iframe.contentDocument.body.scrollHeight;
                  iframe.style.height = `${Math.max(height + 20, 400)}px`;
                }
              }}
              sandbox="allow-same-origin"
              title="Email content"
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300">
              {email.body}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
