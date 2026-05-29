import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcutsDialog } from '../store/keyboardShortcutsStore';

interface KeyboardShortcutsOptions {
  onToggleSidebar?: () => void;
  onCloseSidebar?: () => void;
}

export const KEYBOARD_SHORTCUTS = [
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: 'Esc', description: 'Close sidebar / dialog' },
  { key: 'g then i', description: 'Go to Inbox' },
  { key: 'g then h', description: 'Go to Home' },
  { key: 'g then a', description: 'Go to Analytics' },
  { key: 'g then s', description: 'Go to Settings' },
  { key: '/', description: 'Focus search input' },
] as const;

export function useKeyboardShortcuts({ onCloseSidebar }: KeyboardShortcutsOptions = {}) {
  const navigate = useNavigate();
  const toggleDialog = useKeyboardShortcutsDialog((s) => s.toggle);
  const closeDialog = useKeyboardShortcutsDialog((s) => s.close);

  // Track the single pending "g" sequence handler + its timeout so repeated 'g'
  // presses replace (not stack) the pending sequence.
  const pendingGoTo = useRef<((ev: KeyboardEvent) => void) | null>(null);
  const goToTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingGoTo = useCallback(() => {
    if (pendingGoTo.current) {
      document.removeEventListener('keydown', pendingGoTo.current);
      pendingGoTo.current = null;
    }
    if (goToTimeout.current) {
      clearTimeout(goToTimeout.current);
      goToTimeout.current = null;
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      if (e.key === 'Escape') {
        (target as HTMLInputElement).blur();
      }
      return;
    }

    // Escape — close dialog if open, else close sidebar
    if (e.key === 'Escape') {
      closeDialog();
      onCloseSidebar?.();
      return;
    }

    // / — focus search input
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>('input[type="text"][placeholder*="Search"]');
      searchInput?.focus();
      return;
    }

    // ? — toggle keyboard shortcuts dialog (React-state driven)
    if (e.key === '?' && e.shiftKey) {
      e.preventDefault();
      toggleDialog();
      return;
    }

    // g prefix shortcuts (go to). Replace any pending sequence first.
    if (e.key === 'g') {
      clearPendingGoTo();

      const handleGoTo = (ev: KeyboardEvent) => {
        clearPendingGoTo();
        switch (ev.key) {
          case 'i': navigate('/emails'); break;
          case 'h': navigate('/'); break;
          case 'a': navigate('/analytics'); break;
          case 's': navigate('/settings'); break;
        }
      };

      pendingGoTo.current = handleGoTo;
      document.addEventListener('keydown', handleGoTo, { once: true });
      goToTimeout.current = setTimeout(clearPendingGoTo, 1000);
      return;
    }
  }, [navigate, onCloseSidebar, toggleDialog, closeDialog, clearPendingGoTo]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearPendingGoTo();
    };
  }, [handleKeyDown, clearPendingGoTo]);
}
