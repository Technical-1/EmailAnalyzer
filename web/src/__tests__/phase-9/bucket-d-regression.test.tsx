/**
 * Tests for Bucket D integration regressions:
 *   1. AttachmentPreview renders image once resolvedData is provided
 *   2. ThreadView expanded item shows lazy-loaded body
 *   3. EmailsPage threads-mode search uses searchText (not empty .body)
 *   4. v5 migration backfills snippet field
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { insertEmail, clearAllData, getEmailBody, db } from '../../db/database';
import { useAppStore } from '../../store';
import { AttachmentPreview } from '../../components/AttachmentPreview';
import { ThreadView } from '../../components/ThreadView';
import type { Attachment, Email, EmailThread } from '../../types';
import Dexie from 'dexie';

// ─── Helpers ────────────────────────────────────────────────────────────────

const baseAttachment: Attachment = {
  id: 'att1',
  filename: 'photo.png',
  mimeType: 'image/png',
  size: 512,
};

const B64_PNG = 'iVBORw0KGgo='; // minimal fake base64

// ─── Fix 1: AttachmentPreview renders image from resolvedData ────────────────

describe('AttachmentPreview with resolvedData (lazy-loaded)', () => {
  it('renders image preview when resolvedData is provided (no attachment.data needed)', () => {
    render(
      <AttachmentPreview
        attachment={baseAttachment}
        resolvedData={B64_PNG}
        onClose={() => {}}
      />
    );
    // An <img> element should appear with the data URI
    const img = document.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain('base64');
    expect(img!.src).toContain(B64_PNG);
  });

  it('shows NoPreview (no img element) when resolvedData is absent and attachment.data is absent', () => {
    render(
      <AttachmentPreview
        attachment={baseAttachment}
        onClose={() => {}}
      />
    );
    const img = document.querySelector('img');
    expect(img).toBeNull();
    // The filename appears in both the header and NoPreview area — at least once
    const filenames = screen.getAllByText('photo.png');
    expect(filenames.length).toBeGreaterThanOrEqual(1);
  });

  it('download button is disabled when resolvedData is absent', () => {
    render(
      <AttachmentPreview
        attachment={baseAttachment}
        onClose={() => {}}
      />
    );
    const downloadBtn = screen.getByTitle(/Loading attachment data/i);
    expect(downloadBtn).toBeDisabled();
  });

  it('download button is enabled when resolvedData is present', () => {
    render(
      <AttachmentPreview
        attachment={baseAttachment}
        resolvedData={B64_PNG}
        onClose={() => {}}
      />
    );
    const downloadBtn = screen.getByTitle('Download');
    expect(downloadBtn).not.toBeDisabled();
  });
});

// ─── Fix 2: ThreadView expanded body uses lazy hook ──────────────────────────

const baseEmail: Omit<Email, 'id'> = {
  subject: 'Thread Test',
  sender: 'a@b.com',
  recipients: [],
  date: new Date('2024-06-01'),
  body: '',
  htmlBody: undefined,
  attachments: [],
  size: 100,
  isRead: true,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  snippet: 'Snippet preview',
};

describe('ThreadView expanded body (lazy-loaded via useLazyEmailBody)', () => {
  beforeEach(async () => {
    await clearAllData();
    useAppStore.setState({
      isInitialized: false,
      emails: [],
      emailIndex: new Map(),
      threads: [],
    });
  });

  it('shows collapsed snippet without loading body', async () => {
    const id = await insertEmail({ ...baseEmail, snippet: 'COLLAPSED SNIPPET' });
    await useAppStore.getState().initialize();

    const storeEmail = useAppStore.getState().getEmailById(id)!;
    const email2: Email = { ...storeEmail, id: id + 1, snippet: 'OTHER SNIPPET' };

    const thread: EmailThread = {
      id: 'thr1',
      subject: 'Thread Test',
      emails: [storeEmail, email2],
      participants: ['a@b.com'],
      lastMessageDate: storeEmail.date,
      firstMessageDate: storeEmail.date,
      messageCount: 2,
      unreadCount: 0,
      hasAttachments: false,
      isStarred: false,
    };

    render(<ThreadView thread={thread} />);
    // Collapsed: shows the latest email's snippet
    expect(screen.getByText(/OTHER SNIPPET/)).toBeInTheDocument();
  });

  it('shows lazy-loaded body when thread item is expanded', async () => {
    const id = await insertEmail({
      ...baseEmail,
      body: 'PLAIN BODY TEXT',
      htmlBody: undefined,
      snippet: 'collapsed snippet',
    });
    await useAppStore.getState().initialize();
    const storeEmail = useAppStore.getState().getEmailById(id)!;

    // Single-email thread renders SingleEmailView — use a 2-email thread instead
    // so the latest email is rendered via ThreadEmailItem with expanded=true (isLast=true).
    const olderEmail: Email = { ...storeEmail, id: (id ?? 0) + 100, snippet: 'older snippet' };
    const thread: EmailThread = {
      id: 'thr2',
      subject: 'Thread Test',
      // storeEmail is the LAST (latest) item and will be rendered expanded
      emails: [olderEmail, storeEmail],
      participants: ['a@b.com'],
      lastMessageDate: storeEmail.date,
      firstMessageDate: storeEmail.date,
      messageCount: 2,
      unreadCount: 0,
      hasAttachments: false,
      isStarred: false,
    };

    // Expand the thread (initialExpanded opens all ThreadEmailItems;
    // the last item starts with showFull=true via the `expanded` prop)
    render(<ThreadView thread={thread} initialExpanded />);

    // After expansion the lazy body for the last (storeEmail) item should load
    await waitFor(() => {
      expect(screen.getByText(/PLAIN BODY TEXT/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

// ─── Fix 3: Threads-mode search uses searchText, not empty body ──────────────

describe('threads search uses searchText field', () => {
  it('searchText is populated on insert and accessible from header rows', async () => {
    await clearAllData();
    const id = await insertEmail({
      ...baseEmail,
      body: 'Unique email content for search testing',
    });
    // getEmailBody provides the body record; the header row should have searchText
    const row = await db.emails.get(id);
    expect(row?.searchText).toBeDefined();
    expect(row!.searchText).toContain('Unique email content');
    // Confirm body is NOT in the header row
    expect((row as unknown as Record<string, unknown>).body).toBeUndefined();
  });
});

// ─── Fix 4: v5 migration backfills snippet ───────────────────────────────────

describe('v5 migration backfills snippet field', () => {
  it('migrates legacy rows and sets snippet from body/htmlBody', async () => {
    db.close();
    await Dexie.delete('EmailAnalyzerDB');

    // Build a v4 DB without snippet or emailBodies
    const legacy = new Dexie('EmailAnalyzerDB');
    legacy.version(4).stores({
      emails: '++id, sender, date, [folderId+date], [emailType+date], [sender+date], threadId, isRead, isStarred',
      accounts: '++id, serviceName, serviceType, domain, signupDate',
      purchases: '++id, merchant, amount, purchaseDate, category, [merchant+purchaseDate]',
      contacts: '++id, name, email, emailCount, lastEmailDate',
      calendarEvents: '++id, title, startDate, endDate, isAllDay, [startDate+endDate]',
      folders: 'id, name, isSystem, createdAt',
      subscriptions: '++id, serviceName, category, isActive, lastRenewalDate',
      newsletters: '++id, senderEmail, isPromotional, lastEmailDate',
    });
    await legacy.open();
    await legacy.table('emails').add({
      subject: 'Legacy Snippet Test',
      sender: 'x@y.com',
      recipients: ['z@y.com'],
      date: new Date('2023-01-01').getTime(),
      body: 'Hello world, this is the plain body',
      htmlBody: '<p>Hello world, this is the plain body</p>',
      attachments: [],
      size: 5,
      isRead: true,
      isStarred: false,
      folderId: 'inbox',
      emailType: 'regular',
    });
    legacy.close();

    // Re-open through v5 singleton (triggers upgrade)
    await db.open();

    const rows = await db.emails.toArray();
    const row = rows.find(r => r.subject === 'Legacy Snippet Test');
    expect(row).toBeDefined();
    // snippet should have been backfilled from body/htmlBody
    expect(row!.snippet).toBeDefined();
    expect(row!.snippet).toContain('Hello world');

    await clearAllData();
  });
});

// ─── Fix 1b: getEmailBody returns attachmentData for lazy preview ─────────────

describe('getEmailBody provides attachmentData for lazy attachment loading', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('stores and retrieves base64 attachment data via getEmailBody', async () => {
    const id = await insertEmail({
      ...baseEmail,
      attachments: [
        { id: 'img1', filename: 'image.png', mimeType: 'image/png', size: 100, data: B64_PNG },
      ],
    });

    const body = await getEmailBody(id);
    expect(body?.attachmentData?.img1).toBe(B64_PNG);
  });

  it('email header row does not contain attachment data after insert', async () => {
    const id = await insertEmail({
      ...baseEmail,
      attachments: [
        { id: 'img1', filename: 'image.png', mimeType: 'image/png', size: 100, data: B64_PNG },
      ],
    });

    const row = await db.emails.get(id);
    expect(row!.attachments[0].data).toBeUndefined();
    expect(row!.attachments[0].filename).toBe('image.png');
  });
});
