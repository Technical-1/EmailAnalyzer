import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, cleanup, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useKeyboardShortcutsDialog } from '../../store/keyboardShortcutsStore';
import { KeyboardShortcutsDialog } from '../../components/KeyboardShortcutsDialog';

function HookHost() {
  useKeyboardShortcuts();
  return null;
}

function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
  });
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    useKeyboardShortcutsDialog.setState({ isOpen: false });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('toggles the shortcuts dialog store on Shift+?', () => {
    render(<MemoryRouter><HookHost /></MemoryRouter>);
    expect(useKeyboardShortcutsDialog.getState().isOpen).toBe(false);
    press('?', { shiftKey: true });
    expect(useKeyboardShortcutsDialog.getState().isOpen).toBe(true);
    press('?', { shiftKey: true });
    expect(useKeyboardShortcutsDialog.getState().isOpen).toBe(false);
  });

  it('does not stack listeners when "g" is pressed repeatedly', () => {
    render(<MemoryRouter><HookHost /></MemoryRouter>);
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    // Press 'g' three times without completing a sequence.
    press('g');
    press('g');
    press('g');

    // Each new 'g' must clear the prior pending sequence handler before adding a new one,
    // so the count of pending "go-to" listeners never grows beyond one.
    const adds = addSpy.mock.calls.filter(c => c[0] === 'keydown').length;
    const removes = removeSpy.mock.calls.filter(c => c[0] === 'keydown').length;
    // 3 adds for the 3 sequences; at least 2 removes clearing the prior pending ones.
    expect(adds).toBe(3);
    expect(removes).toBeGreaterThanOrEqual(2);
  });

  it('renders the dialog only when the store is open', () => {
    render(<KeyboardShortcutsDialog />);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => useKeyboardShortcutsDialog.getState().open());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => useKeyboardShortcutsDialog.getState().close());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
