import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Star, Mail, MailOpen, ShoppingBag, UserCheck, Paperclip } from 'lucide-react';
import { useAppStore } from '../store';

export function EmailDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getEmailById } = useAppStore();

  const email = useMemo(() => {
    if (!id) return null;
    return getEmailById(parseInt(id));
  }, [id, getEmailById]);

  const handleBack = () => {
    // Use browser history to go back to the previous page
    if (window.history.length > 1) {
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
        <button
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Star className={`w-5 h-5 ${email.isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-slate-400'}`} />
        </button>
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
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {format(email.date, 'EEEE, MMMM d, yyyy \'at\' h:mm a')}
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
            <div
              className="prose dark:prose-invert max-w-none overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: email.htmlBody }}
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
