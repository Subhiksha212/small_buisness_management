import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom React Hook for Real-Time Server-Sent Events (SSE).
 * Connects securely to GET /api/events with token authentication.
 * User data isolation: Each user only receives events for their own business.
 * Handles automatic reconnects and triggers fresh data refetches.
 */
export const useRealtimeEvents = (callbacks = {}) => {
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'
  const [lastEvent, setLastEvent] = useState(null);
  const wasConnectedRef = useRef(false);
  const callbacksRef = useRef(callbacks);

  // Keep latest callbacks without re-triggering effect
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setConnectionStatus('disconnected');
      return;
    }

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const sseUrl = `${API_BASE_URL.replace(/\/$/, '')}/events?token=${encodeURIComponent(token)}`;

    let eventSource = null;
    let isMounted = true;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        if (!isMounted) return;
        setConnectionStatus('connected');
        if (wasConnectedRef.current && callbacksRef.current.onReconnect) {
          // Reconnected after disconnection: refetch to ensure fresh totals
          callbacksRef.current.onReconnect();
        }
        wasConnectedRef.current = true;
      };

      eventSource.onerror = (err) => {
        if (!isMounted) return;
        // EventSource automatically attempts to reconnect on error
        setConnectionStatus('disconnected');
      };

      // Handler for SSE messages
      const handleEvent = (eventType) => (e) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          setLastEvent({ type: eventType, data, timestamp: Date.now() });

          if (callbacksRef.current.onAnyEvent) {
            callbacksRef.current.onAnyEvent(eventType, data);
          }

          switch (eventType) {
            case 'payment.success':
              callbacksRef.current.onPaymentSuccess?.(data);
              break;
            case 'payment.failed':
              callbacksRef.current.onPaymentFailed?.(data);
              break;
            case 'sale.created':
              callbacksRef.current.onSaleCreated?.(data);
              break;
            case 'expense.created':
              callbacksRef.current.onExpenseCreated?.(data);
              break;
            case 'inventory.updated':
              callbacksRef.current.onInventoryUpdated?.(data);
              break;
            case 'transaction.created':
              callbacksRef.current.onTransactionCreated?.(data);
              break;
            default:
              break;
          }
        } catch (err) {
          console.warn('[SSE] Failed to parse event payload:', err);
        }
      };

      const eventTypes = [
        'payment.success',
        'payment.failed',
        'sale.created',
        'expense.created',
        'inventory.updated',
        'transaction.created',
      ];

      eventTypes.forEach((type) => {
        eventSource.addEventListener(type, handleEvent(type));
      });
    } catch (err) {
      console.error('[SSE] Failed to initialize EventSource:', err);
      setConnectionStatus('disconnected');
    }

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    lastEvent,
  };
};

export default useRealtimeEvents;
