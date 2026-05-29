import { useEffect } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { create } from 'zustand';

type ToastType = 'error' | 'success';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  showError: (message: string) => string;
  showSuccess: (message: string) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },

  showError: (message) => get().addToast({ message, type: 'error', duration: 6000 }),

  showSuccess: (message) => get().addToast({ message, type: 'success', duration: 4000 }),

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  clearAll: () => set({ toasts: [] }),
}));

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const duration = toast.duration ?? 6000;

  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const isError = toast.type === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      className={`text-white rounded-lg shadow-lg overflow-hidden animate-slide-in-right ${
        isError ? 'bg-red-600' : 'bg-green-600'
      }`}
    >
      <div className="p-4 flex items-center gap-3">
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="flex-1 text-sm">{toast.message}</span>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
      role="alert"
      aria-live="assertive"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}
