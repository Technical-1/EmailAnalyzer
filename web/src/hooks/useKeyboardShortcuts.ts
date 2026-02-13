import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Only handle Escape in inputs
      if (e.key === 'Escape') {
        (target as HTMLInputElement).blur();
      }
      return;
    }

    // Escape — close sidebar on mobile
    if (e.key === 'Escape') {
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

    // ? — toggle keyboard shortcuts dialog
    if (e.key === '?' && e.shiftKey) {
      const dialog = document.getElementById('keyboard-shortcuts-dialog');
      if (dialog) {
        dialog.classList.toggle('hidden');
      }
      return;
    }

    // g prefix shortcuts (go to)
    if (e.key === 'g') {
      const handleGoTo = (ev: KeyboardEvent) => {
        document.removeEventListener('keydown', handleGoTo);
        switch (ev.key) {
          case 'i': navigate('/emails'); break;
          case 'h': navigate('/'); break;
          case 'a': navigate('/analytics'); break;
          case 's': navigate('/settings'); break;
        }
      };
      document.addEventListener('keydown', handleGoTo, { once: true });
      // Auto-cancel after 1s if no second key
      setTimeout(() => document.removeEventListener('keydown', handleGoTo), 1000);
      return;
    }
  }, [navigate, onCloseSidebar]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
