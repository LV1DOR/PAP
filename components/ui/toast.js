'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext({ addToast: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, { variant = 'default', duration = 3000 } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <div key={t.id} className={
            'px-4 py-2 rounded shadow text-sm text-white ' +
            (t.variant === 'success' ? 'bg-green-600' : t.variant === 'error' ? 'bg-red-600' : 'bg-gray-800')
          }>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
