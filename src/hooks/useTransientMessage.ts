import { useCallback, useEffect, useRef, useState } from 'react';

export function useTransientMessage(defaultDurationMs = 2400) {
  const [message, setMessage] = useState('');
  const timeoutRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    setMessage('');
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const show = useCallback((nextMessage: string, durationMs = defaultDurationMs) => {
    setMessage(nextMessage);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setMessage('');
      timeoutRef.current = null;
    }, durationMs);
  }, [defaultDurationMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { message, show, clear, setMessage };
}
