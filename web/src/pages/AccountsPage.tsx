import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { UserCheck, ExternalLink, Mail } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { useAppStore } from '../store';
import type { Account } from '../types';

const serviceTypeIcons: Record<Account['serviceType'], string> = {
  streaming: '🎬',
  ecommerce: '🛒',
  social: '👥',
  banking: '🏦',
  communication: '💬',
  development: '💻',
  other: '📱',
};

const serviceTypeColors: Record<Account['serviceType'], string> = {
  streaming: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  ecommerce: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  social: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  banking: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  communication: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  development: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
  other: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
};

export function AccountsPage() {
  const navigate = useNavigate();
  const { accounts } = useAppStore();

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    return accounts.reduce((groups, account) => {
      const type = account.serviceType;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(account);
      return groups;
    }, {} as Record<Account['serviceType'], Account[]>);
  }, [accounts]);

  const handleAccountClick = (account: Account) => {
    if (account.signupEmailId) {
      navigate(`/emails/${account.signupEmailId}`);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Accounts</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {accounts.length} accounts detected from your emails
        </p>
      </div>

      {accounts.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
            <div key={type}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span>{serviceTypeIcons[type as Account['serviceType']]}</span>
                <span className="capitalize">{type}</span>
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  ({typeAccounts.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {typeAccounts.map(account => (
                  <div
                    key={account.id}
                    onClick={() => handleAccountClick(account)}
                    className={`bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 transition-all ${
                      account.signupEmailId 
                        ? 'cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700' 
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">
                          {serviceTypeIcons[account.serviceType]}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {account.serviceName}
                          </h3>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${serviceTypeColors[account.serviceType]}`}>
                            {account.serviceType}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {account.signupEmailId && (
                          <div className="p-2 text-blue-500" title="Click to view signup email">
                            <Mail className="w-4 h-4" />
                          </div>
                        )}
                        {account.domain && (
                          <a
                            href={`https://${account.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                            title="Visit website"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                      <p>
                        Signed up: {account.signupDate ? format(account.signupDate, 'MMM d, yyyy') : 'Unknown date'}
                      </p>
                      <p>
                        {account.emailCount} email{account.emailCount !== 1 ? 's' : ''} from this service
                      </p>
                      {account.domain && (
                        <p className="text-slate-400 dark:text-slate-500 truncate">
                          {account.domain}
                        </p>
                      )}
                    </div>
                    {account.signupEmailId && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          Click to view signup email
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UserCheck}
          title="No Accounts Detected"
          description="Upload an OLM file to automatically detect your account signups."
          actionLabel="Upload OLM File"
          actionTo="/"
        />
      )}
    </div>
  );
}
