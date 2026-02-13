import { useState, useEffect, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { create } from 'zustand';
import { logger } from '../utils/logger';

// Types
interface UndoAction {
  id: string;
  message: string;
  onUndo: () => Promise<void> | void;
  duration?: number;
}

interface UndoToastState {
  toasts: UndoAction[];
  addToast: (toast: Omit<UndoAction, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// Store for managing undo toasts
export const useUndoToastStore = create<UndoToastState>((set) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  
  clearAll: () => {
    set({ toasts: [] });
  },
}));

// Hook for showing undo toasts
export function useUndoToast() {
  const { addToast, removeToast } = useUndoToastStore();

  const showUndo = useCallback(
    (message: string, onUndo: () => Promise<void> | void, duration = 5000) => {
      return addToast({ message, onUndo, duration });
    },
    [addToast]
  );

  const dismiss = useCallback(
    (id: string) => {
      removeToast(id);
    },
    [removeToast]
  );

  return { showUndo, dismiss };
}

// Individual toast component
interface ToastItemProps {
  toast: UndoAction;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const [isUndoing, setIsUndoing] = useState(false);
  const duration = toast.duration || 5000;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await toast.onUndo();
    } catch (error) {
      logger.error('Undo failed:', error);
    } finally {
      onDismiss();
    }
  };

  return (
    <div className="bg-slate-800 dark:bg-slate-700 text-white rounded-lg shadow-lg overflow-hidden animate-slide-in-right">
      {/* Progress bar */}
      <div 
        className="h-1 bg-blue-500 transition-all duration-50 ease-linear"
        style={{ width: `${progress}%` }}
      />
      
      <div className="p-4 flex items-center gap-3">
        <span className="flex-1 text-sm">{toast.message}</span>
        
        <button
          onClick={handleUndo}
          disabled={isUndoing}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 rounded text-sm font-medium transition-colors"
        >
          <RotateCcw className={`w-4 h-4 ${isUndoing ? 'animate-spin' : ''}`} />
          Undo
        </button>
        
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-slate-600 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Toast container component
export function UndoToastContainer() {
  const { toasts, removeToast } = useUndoToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

// Add CSS animation to index.css
// @keyframes slide-in-right {
//   from {
//     transform: translateX(100%);
//     opacity: 0;
//   }
//   to {
//     transform: translateX(0);
//     opacity: 1;
//   }
// }
// .animate-slide-in-right {
//   animation: slide-in-right 0.3s ease-out;
// }

