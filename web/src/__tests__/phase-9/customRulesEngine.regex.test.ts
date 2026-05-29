import { describe, it, expect } from 'vitest';
import type { Email, RuleCondition } from '../../types';
import { customRulesEngine } from '../../services/customRulesEngine';

const mk = (body: string): Email => ({
  id: 1,
  subject: 'subj',
  sender: 'a@example.com',
  recipients: ['me@example.com'],
  date: new Date(),
  body,
  attachments: [],
  size: 1024,
  isRead: false,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
});

describe('customRulesEngine regex safety (issue 12)', () => {
  it('returns quickly for a catastrophic-backtracking pattern against a long body', () => {
    const body = 'a'.repeat(50000) + '!';
    const condition: RuleCondition = {
      field: 'body',
      operator: 'regex',
      value: '(a+)+$',
      caseSensitive: false,
    };

    const start = Date.now();
    const result = customRulesEngine.matchesCondition(mk(body), condition);
    const elapsed = Date.now() - start;

    expect(typeof result).toBe('boolean');
    expect(elapsed).toBeLessThan(1000); // must not hang
  });

  it('still matches a normal regex within the bounded window', () => {
    const condition: RuleCondition = {
      field: 'body',
      operator: 'regex',
      value: 'hello',
      caseSensitive: false,
    };
    expect(customRulesEngine.matchesCondition(mk('say hello world'), condition)).toBe(true);
  });

  it('returns false for an invalid regex pattern', () => {
    const condition: RuleCondition = {
      field: 'body',
      operator: 'regex',
      value: '(',
      caseSensitive: false,
    };
    expect(customRulesEngine.matchesCondition(mk('anything'), condition)).toBe(false);
  });
});
