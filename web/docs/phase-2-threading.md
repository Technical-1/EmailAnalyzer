# Phase 2: Email Organization & Threading

This document covers the email organization features implemented in Phase 2.

## Overview

Phase 2 adds conversation threading, drag & drop organization, and undo functionality to improve email management.

## Features Implemented

### 1. Email Threading / Conversations

**Location:** `src/services/threadingService.ts`

Emails are grouped into conversation threads based on:

1. **Explicit threadId** - If the email has a threadId from the source
2. **Normalized Subject** - Removes Re:, Fwd:, etc. prefixes and matches
3. **Participant Overlap** - Groups by common senders/recipients

#### Usage:

```typescript
import { threadingService } from './services/threadingService';

// Build threads from emails
const threads = threadingService.buildThreads(emails);

// Find related emails for a specific email
const related = threadingService.findRelatedEmails(email, allEmails);

// Check if email is part of a conversation
const isConversation = threadingService.isPartOfConversation(email, allEmails);
```

#### Thread Interface:

```typescript
interface EmailThread {
  id: string;
  subject: string;
  emails: Email[];
  participants: string[];
  lastMessageDate: Date;
  firstMessageDate: Date;
  messageCount: number;
  unreadCount: number;
  hasAttachments: boolean;
  isStarred: boolean;
}
```

### 2. Thread View Component

**Location:** `src/components/ThreadView.tsx`

Displays email conversations in an expandable view.

```tsx
import { ThreadView } from './components/ThreadView';

<ThreadView
  thread={thread}
  onEmailClick={(email) => navigate(`/emails/${email.id}`)}
  initialExpanded={false}
/>
```

Features:
- Collapsed view shows thread summary
- Expanded view shows all messages
- Individual messages can be expanded/collapsed
- Quick actions (star, mark read) on each message

### 3. Drag & Drop Organization

**Location:** 
- `src/components/DraggableEmailCard.tsx`
- `src/components/DroppableFolderItem.tsx`
- `src/components/DndProvider.tsx`

Enables dragging emails to folders in the sidebar.

#### Setting Up Drag & Drop:

```tsx
// Wrap your app with DndProvider
import { DndProvider } from './components/DndProvider';

<DndProvider>
  <App />
</DndProvider>
```

#### Draggable Email:

```tsx
import { DraggableEmailCard } from './components/DraggableEmailCard';

<DraggableEmailCard
  email={email}
  onClick={() => navigate(`/emails/${email.id}`)}
  isSelected={selectedIds.includes(email.id)}
  onSelect={handleSelect}
  selectedEmailIds={selectedIds}
/>
```

#### Drop Target:

```tsx
import { DroppableFolderItem } from './components/DroppableFolderItem';

<DroppableFolderItem
  folder={folder}
  onDrop={(emailIds, folderId) => moveEmailsToFolder(emailIds, folderId)}
>
  <FolderLink />
</DroppableFolderItem>
```

### 4. Multi-Select

Hold `Ctrl/Cmd` or `Shift` while clicking to select multiple emails.

Features:
- Checkbox selection on each email card
- Bulk drag & drop
- Selection count indicator during drag

### 5. Undo Actions

**Location:** `src/components/UndoToast.tsx`

Shows a toast with undo option for 5 seconds after actions like archive/delete.

#### Usage:

```typescript
import { useUndoToast } from './components/UndoToast';

function EmailActions() {
  const { showUndo } = useUndoToast();

  const handleArchive = async () => {
    const previousFolder = email.folderId;
    await archiveEmail(email.id);
    
    showUndo(
      'Email archived',
      async () => {
        await moveEmailToFolder(email.id, previousFolder);
      },
      5000 // 5 second timeout
    );
  };
}
```

#### Toast Container:

Add the toast container to your app root:

```tsx
import { UndoToastContainer } from './components/UndoToast';

function App() {
  return (
    <>
      <Router>
        <Routes />
      </Router>
      <UndoToastContainer />
    </>
  );
}
```

Features:
- Progress bar showing time remaining
- Click "Undo" to reverse action
- Auto-dismiss after timeout
- Multiple toasts stack vertically

## Testing

Tests are located in `src/__tests__/phase-2/`:

- `threadingService.test.ts` - Thread grouping logic

Run tests:
```bash
npm test
```

## Types Added

```typescript
// Email Thread
interface EmailThread {
  id: string;
  subject: string;
  emails: Email[];
  participants: string[];
  lastMessageDate: Date;
  firstMessageDate: Date;
  messageCount: number;
  unreadCount: number;
  hasAttachments: boolean;
  isStarred: boolean;
}

// Drag Item (for react-dnd)
interface DragItem {
  type: 'email';
  emailIds: number[];
  emails: Email[];
}
```

## Dependencies Added

```json
{
  "react-dnd": "^16.x",
  "react-dnd-html5-backend": "^16.x"
}
```

## CSS Animations

Added to `index.css`:

```css
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
```

## Troubleshooting

### Drag & Drop Not Working

1. Ensure `DndProvider` wraps your app
2. Check that `HTML5Backend` is imported correctly
3. Verify the drop target is a valid drop zone

### Threading Incorrect

1. Check email subjects for unusual characters
2. Verify `normalizeSubject()` handles your prefix formats
3. Use explicit `threadId` for accurate grouping

### Undo Toast Not Appearing

1. Verify `UndoToastContainer` is in your component tree
2. Check z-index conflicts with other modals
3. Ensure the toast store is being updated correctly

