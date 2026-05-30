import { describe, it, expect } from 'vitest';
import type { Email, RuleAction } from '../../types';
import { customRulesEngine } from '../../services/customRulesEngine';

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Hello',
  sender: 'someone@example.com',
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: 'plain message',
  attachments: [],
  size: 100,
  isRead: false,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('CustomRulesEngine.applyActionsToEmail', () => {
  it('returns null for an empty action list', () => {
    expect(customRulesEngine.applyActionsToEmail(email(), [])).toBeNull();
  });

  it('stars an unstarred email', () => {
    expect(customRulesEngine.applyActionsToEmail(email(), [{ type: 'star' }])).toEqual({ isStarred: true });
  });

  it('returns null when starring an already-starred email (no-op)', () => {
    expect(customRulesEngine.applyActionsToEmail(email({ isStarred: true }), [{ type: 'star' }])).toBeNull();
  });

  it('marks an unread email as read', () => {
    expect(customRulesEngine.applyActionsToEmail(email(), [{ type: 'markRead' }])).toEqual({ isRead: true });
  });

  it('moves to a different folder but no-ops on the same folder', () => {
    expect(customRulesEngine.applyActionsToEmail(email(), [{ type: 'move', value: 'archive' }])).toEqual({ folderId: 'archive' });
    expect(customRulesEngine.applyActionsToEmail(email({ folderId: 'archive' }), [{ type: 'move', value: 'archive' }])).toBeNull();
  });

  it('unions a new tag onto existing tags and skips duplicates', () => {
    expect(customRulesEngine.applyActionsToEmail(email({ tags: ['a'] }), [{ type: 'tag', value: 'b' }])).toEqual({ tags: ['a', 'b'] });
    expect(customRulesEngine.applyActionsToEmail(email({ tags: ['a'] }), [{ type: 'tag', value: 'a' }])).toBeNull();
  });

  it('combines multiple actions into one patch', () => {
    const actions: RuleAction[] = [
      { type: 'star' },
      { type: 'markRead' },
      { type: 'move', value: 'receipts' },
      { type: 'tag', value: 'finance' },
    ];
    expect(customRulesEngine.applyActionsToEmail(email(), actions)).toEqual({
      isStarred: true,
      isRead: true,
      folderId: 'receipts',
      tags: ['finance'],
    });
  });

  it('does not mutate the source email tags array', () => {
    const e = email({ tags: ['keep'] });
    customRulesEngine.applyActionsToEmail(e, [{ type: 'tag', value: 'new' }]);
    expect(e.tags).toEqual(['keep']);
  });
});
