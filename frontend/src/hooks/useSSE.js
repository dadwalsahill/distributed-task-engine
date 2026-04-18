import { useEffect, useRef } from 'react';

/**
 * Connects to the SSE endpoint and calls onMessage(event, data) for each event.
 * Automatically reconnects on disconnect with exponential backoff.
 */
export function useSSE(onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let es = null;
    let retryTimeout = null;
    let retryDelay = 2000;
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      try {
        es = new EventSource('/api/tasks/events');

        es.addEventListener('connected', (e) => {
          retryDelay = 2000; // reset backoff on success
          try {
            const data = JSON.parse(e.data);
            onMessageRef.current('connected', data);
          } catch (_) {}
        });

        es.addEventListener('task_update', (e) => {
          try {
            const data = JSON.parse(e.data);
            onMessageRef.current('task_update', data);
          } catch (_) {}
        });

        es.onerror = () => {
          es.close();
          es = null;
          if (!destroyed) {
            retryTimeout = setTimeout(() => {
              retryDelay = Math.min(retryDelay * 1.5, 15000);
              connect();
            }, retryDelay);
          }
        };
      } catch (err) {
        // EventSource constructor itself failed (rare)
        if (!destroyed) {
          retryTimeout = setTimeout(connect, retryDelay);
        }
      }
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(retryTimeout);
      if (es) { es.close(); es = null; }
    };
  }, []); // empty deps — stable for component lifetime
}
