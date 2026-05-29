import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { useToastStore, ToastContainer } from '../../components/Toast';

describe('Toast', () => {
  beforeEach(() => {
    act(() => {
      useToastStore.getState().clearAll();
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      useToastStore.getState().clearAll();
    });
  });

  it('showError adds an error toast to the store', () => {
    act(() => {
      useToastStore.getState().showError('Something broke');
    });
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Something broke');
    expect(toasts[0].type).toBe('error');
  });

  it('showSuccess adds a success toast to the store', () => {
    act(() => {
      useToastStore.getState().showSuccess('Saved');
    });
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
  });

  it('ToastContainer renders the toast message', () => {
    render(<ToastContainer />);
    act(() => {
      useToastStore.getState().showError('Failed to delete email');
    });
    expect(screen.getByText('Failed to delete email')).toBeInTheDocument();
  });

  it('removeToast removes a toast by id', () => {
    let id = '';
    act(() => {
      id = useToastStore.getState().showError('temp');
    });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    act(() => {
      useToastStore.getState().removeToast(id);
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });
});
