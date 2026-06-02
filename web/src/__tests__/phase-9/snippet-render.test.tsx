import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmailCard } from '../../components/EmailCard';
import { ThreadView } from '../../components/ThreadView';
import type { Email, EmailThread } from '../../types';

const base: Email = {
  id: 1, subject: 'Subj', sender: 'a@b.com', recipients: [], date: new Date('2024-01-01'),
  body: '<p>RAW HTML BODY CONTENT</p>', attachments: [], size: 0,
  isRead: false, isStarred: false, folderId: 'inbox', emailType: 'regular',
};

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('EmailCard snippet rendering', () => {
  it('renders precomputed snippet when present (does not derive from body)', () => {
    wrap(<EmailCard email={{ ...base, snippet: 'PRECOMPUTED SNIPPET' }} onClick={() => {}} />);
    expect(screen.getByText(/PRECOMPUTED SNIPPET/)).toBeInTheDocument();
  });

  it('falls back to stripped body when snippet is absent', () => {
    wrap(<EmailCard email={{ ...base, snippet: undefined }} onClick={() => {}} />);
    expect(screen.getByText(/RAW HTML BODY CONTENT/)).toBeInTheDocument();
  });

  it('does not crash when both snippet and body are empty (header-only row)', () => {
    wrap(<EmailCard email={{ ...base, snippet: undefined, body: '' }} onClick={() => {}} />);
    // renders without throwing; preview area is empty
    expect(screen.getByText('Subj')).toBeInTheDocument();
  });

  it('does not append a manual "..." to a precomputed snippet', () => {
    wrap(<EmailCard email={{ ...base, snippet: 'PRECOMPUTED SNIPPET' }} onClick={() => {}} />);
    // exact match — fails if a trailing '...' is appended to the preview
    expect(screen.getByText('PRECOMPUTED SNIPPET')).toBeInTheDocument();
  });

  it('does not double an ellipsis that makeSnippet already added', () => {
    wrap(<EmailCard email={{ ...base, snippet: 'Truncated body…' }} onClick={() => {}} />);
    expect(screen.getByText('Truncated body…')).toBeInTheDocument();
    expect(screen.queryByText(/…\.\.\./)).toBeNull();
  });
});

const oneThread: EmailThread = {
  id: 't1', subject: 'T', emails: [{ ...base, snippet: 'THREAD SNIPPET' }],
  participants: ['a@b.com'], lastMessageDate: base.date!, firstMessageDate: base.date!,
  messageCount: 1, unreadCount: 1, hasAttachments: false, isStarred: false,
};

const oneThreadNoSnippet: EmailThread = {
  id: 't2', subject: 'T2', emails: [{ ...base, snippet: undefined }],
  participants: ['a@b.com'], lastMessageDate: base.date!, firstMessageDate: base.date!,
  messageCount: 1, unreadCount: 1, hasAttachments: false, isStarred: false,
};

const multiThread: EmailThread = {
  id: 't3', subject: 'Multi', emails: [
    { ...base, id: 2, snippet: 'OLDER SNIPPET', body: 'older body' },
    { ...base, id: 3, snippet: 'LATEST SNIPPET', body: 'latest body' },
  ],
  participants: ['a@b.com'], lastMessageDate: base.date!, firstMessageDate: base.date!,
  messageCount: 2, unreadCount: 0, hasAttachments: false, isStarred: false,
};

describe('ThreadView snippet rendering', () => {
  it('ThreadView single-email uses snippet when present', () => {
    render(<ThreadView thread={oneThread} />);
    expect(screen.getByText(/THREAD SNIPPET/)).toBeInTheDocument();
  });

  it('ThreadView single-email falls back to stripped body when snippet absent', () => {
    render(<ThreadView thread={oneThreadNoSnippet} />);
    expect(screen.getByText(/RAW HTML BODY CONTENT/)).toBeInTheDocument();
  });

  it('ThreadView multi-email preview uses latest email snippet', () => {
    render(<ThreadView thread={multiThread} />);
    expect(screen.getByText(/LATEST SNIPPET/)).toBeInTheDocument();
  });

  it('ThreadView multi-email preview does not append a manual "..."', () => {
    render(<ThreadView thread={multiThread} />);
    // exact match — fails if a trailing '...' is appended to the thread preview
    expect(screen.getByText('LATEST SNIPPET')).toBeInTheDocument();
  });

  it('ThreadView single-email preview does not append a manual "..."', () => {
    render(<ThreadView thread={oneThread} />);
    expect(screen.getByText('THREAD SNIPPET')).toBeInTheDocument();
  });
});
