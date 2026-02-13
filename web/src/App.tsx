import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { DndProvider } from './components/DndProvider';
import { UndoToastContainer } from './components/UndoToast';
import { useAppStore } from './store';

// Lazy-load all non-critical pages for code splitting
const EmailsPage = lazy(() => import('./pages/EmailsPage').then(m => ({ default: m.EmailsPage })));
const EmailDetailPage = lazy(() => import('./pages/EmailDetailPage').then(m => ({ default: m.EmailDetailPage })));
const AccountsPage = lazy(() => import('./pages/AccountsPage').then(m => ({ default: m.AccountsPage })));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage').then(m => ({ default: m.PurchasesPage })));
const ContactsPage = lazy(() => import('./pages/ContactsPage').then(m => ({ default: m.ContactsPage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const SendersPage = lazy(() => import('./pages/SendersPage').then(m => ({ default: m.SendersPage })));
const SenderEmailsPage = lazy(() => import('./pages/SenderEmailsPage').then(m => ({ default: m.SenderEmailsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage').then(m => ({ default: m.SubscriptionsPage })));
const NewslettersPage = lazy(() => import('./pages/NewslettersPage').then(m => ({ default: m.NewslettersPage })));
const AttachmentsPage = lazy(() => import('./pages/AttachmentsPage').then(m => ({ default: m.AttachmentsPage })));
const BackupPage = lazy(() => import('./pages/BackupPage').then(m => ({ default: m.BackupPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );
}

function AppContent() {
  const { initialize, isInitialized, isLoading } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized && isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="emails" element={<EmailsPage />} />
          <Route path="emails/:id" element={<EmailDetailPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="senders" element={<SendersPage />} />
          <Route path="sender/:senderKey" element={<SenderEmailsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="newsletters" element={<NewslettersPage />} />
          <Route path="attachments" element={<AttachmentsPage />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="privacy" element={<PrivacyPolicyPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <DndProvider>
        <AppContent />
        <UndoToastContainer />
      </DndProvider>
    </BrowserRouter>
  );
}

export default App;
