import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { UploadPage } from './pages/UploadPage';
import { EmailsPage } from './pages/EmailsPage';
import { EmailDetailPage } from './pages/EmailDetailPage';
import { AccountsPage } from './pages/AccountsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { ContactsPage } from './pages/ContactsPage';
import { CalendarPage } from './pages/CalendarPage';
import { SendersPage } from './pages/SendersPage';
import { SenderEmailsPage } from './pages/SenderEmailsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { NewslettersPage } from './pages/NewslettersPage';
import { AttachmentsPage } from './pages/AttachmentsPage';
import { BackupPage } from './pages/BackupPage';
import { DndProvider } from './components/DndProvider';
import { UndoToastContainer } from './components/UndoToast';
import { useAppStore } from './store';

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
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<UploadPage />} />
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
      </Route>
    </Routes>
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
