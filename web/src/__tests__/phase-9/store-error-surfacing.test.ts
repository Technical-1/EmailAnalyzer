import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the DB module so a mutation rejects.
vi.mock('../../db/database', async () => {
  const actual = await vi.importActual<typeof import('../../db/database')>('../../db/database');
  return {
    ...actual,
    updateEmailFolder: vi.fn().mockRejectedValue(new Error('DB write failed')),
  };
});

import { useAppStore } from '../../store';
import { useToastStore } from '../../components/Toast';
import { SYSTEM_FOLDERS, type Email } from '../../types';

function seedEmail(): Email {
  return {
    id: 1,
    subject: 'x',
    sender: 'a@b.com',
    senderName: 'A',
    recipients: [],
    body: '',
    date: new Date(),
    folderId: SYSTEM_FOLDERS.INBOX,
    isRead: true,
    isStarred: false,
    emailType: 'regular',
    attachments: [],
    size: 0,
  };
}

describe('store mutation error surfacing', () => {
  beforeEach(() => {
    useToastStore.getState().clearAll();
    // Seed the store directly with one email + a working index.
    useAppStore.setState({
      emails: [seedEmail()],
      emailIndex: new Map([[1, 0]]),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error toast when deleteEmail DB op rejects', async () => {
    await useAppStore.getState().deleteEmail(1);
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].message).toMatch(/delete/i);
  });

  it('does not move the email in state when the DB op fails', async () => {
    await useAppStore.getState().deleteEmail(1);
    expect(useAppStore.getState().emails[0].folderId).toBe(SYSTEM_FOLDERS.INBOX);
  });
});
