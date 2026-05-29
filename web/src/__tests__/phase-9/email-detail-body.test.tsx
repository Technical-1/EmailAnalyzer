import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { insertEmail, clearAllData } from '../../db/database';
import { useAppStore } from '../../store';
import { EmailDetailPage } from '../../pages/EmailDetailPage';
import type { Email } from '../../types';

const testEmail: Omit<Email, 'id'> = {
  subject: 'Test Subject',
  sender: 'sender@example.com',
  recipients: ['me@example.com'],
  date: new Date('2024-05-01'),
  body: 'PLAIN TEXT BODY CONTENT',
  htmlBody: '<p>HTML BODY CONTENT</p>',
  attachments: [
    { id: 'att1', filename: 'doc.pdf', mimeType: 'application/pdf', size: 1024, data: 'PDFDATA' }
  ],
  size: 500,
  isRead: false,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
};

function renderDetailPage(emailId: number) {
  return render(
    <MemoryRouter initialEntries={[`/emails/${emailId}`]}>
      <Routes>
        <Route path="/emails/:id" element={<EmailDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EmailDetailPage sources body from lazy hook', () => {
  beforeEach(async () => {
    await clearAllData();
    useAppStore.setState({ isInitialized: false, emails: [], emailIndex: new Map(), threads: [] });
  });

  it('renders HTML body from lazy hook after store loads headers only', async () => {
    const id = await insertEmail(testEmail);
    await useAppStore.getState().initialize();

    // Confirm store has no body/htmlBody
    const storeEmail = useAppStore.getState().getEmailById(id);
    expect(storeEmail).toBeDefined();
    expect((storeEmail as unknown as Record<string, unknown>).htmlBody).toBeUndefined();

    renderDetailPage(id);

    // The page should eventually show the HTML body content (from lazy hook)
    await waitFor(() => {
      expect(screen.getByText(/HTML BODY CONTENT/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('renders subject and sender from header row (no lazy body needed)', async () => {
    const id = await insertEmail(testEmail);
    await useAppStore.getState().initialize();
    renderDetailPage(id);

    // These come from the header row immediately
    expect(screen.getByText('Test Subject')).toBeInTheDocument();
    expect(screen.getByText(/sender@example.com/)).toBeInTheDocument();
  });
});
