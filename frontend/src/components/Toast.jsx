import React, { createContext, useContext, useReducer, useCallback, useMemo, useState, useEffect, useRef } from 'react';

const ToastContext = createContext(null);
const TOAST_LIMIT = 5;
const DEFAULT_DURATION = 3000;
const EXIT_MS = 260;

const ICONS = {
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

function toastsReducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [...state, action.toast].slice(-TOAST_LIMIT);
    case 'DISMISS':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

function ToastCard({ toast, onDismiss }) {
  const { id, type, title, message } = toast;
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(null);
  const leavingRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => finishLeave(), DEFAULT_DURATION);
  }, []);

  const finishLeave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    setTimeout(() => onDismiss(id), EXIT_MS);
  }, [id, onDismiss]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer]);

  const pause = () => clearTimer();
  const resume = () => {
    if (!leavingRef.current) startTimer();
  };

  return (
    <div
      role="status"
      className={`pangasin-toast pangasin-toast--${type}${leaving ? ' is-leaving' : ''}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div className="pangasin-toast-body">
        <div className="pangasin-toast-title">{title}</div>
        {message && <div className="pangasin-toast-message">{message}</div>}
      </div>
      <button type="button" className="pangasin-toast-close" onClick={finishLeave} aria-label="Dismiss notification">
        <span dangerouslySetInnerHTML={{ __html: ICONS.close }} />
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="pangasin-toaster" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastsReducer, []);

  const dismiss = useCallback((id) => dispatch({ type: 'DISMISS', id }), []);

  const push = useCallback((type, title, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    dispatch({ type: 'ADD', toast: { id, type, title, message } });
  }, []);

  const value = useMemo(() => ({
    toastSuccess: (message, title = 'Success') => push('success', title, message),
    toastError: (message, title = 'Something went wrong') => push('error', title, message),
    toastInfo: (message, title = 'Heads up') => push('info', title, message),
    toastWarning: (message, title = 'Please check') => push('warning', title, message),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>.');
  }
  return ctx;
}