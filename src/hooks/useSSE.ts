import { useEffect, useRef } from 'react';

interface RecordChangeEvent {
  action: 'created' | 'updated' | 'submitted' | 'approved' | 'rejected' | 'deleted' | 'files_generated';
  record: {
    id: string | number;
    arf_no: string;
    owner_name: string | null;
    status: string;
    encoder_id: number;
  };
  timestamp: string;
}

interface SSEOptions {
  onRecordChange?: (data: RecordChangeEvent) => void;
  onConnected?: (data: any) => void;
  enabled?: boolean;
}

export const useSSE = ({ onRecordChange, onConnected, enabled = true }: SSEOptions) => {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const eventSource = new EventSource(`${API_URL}/api/events/stream`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('✅ SSE Connected:', data);
        onConnected?.(data);
      } catch (error) {
        console.error('Error parsing connected event:', error);
      }
    });

    eventSource.addEventListener('recordChange', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 Record change received:', data);
        onRecordChange?.(data);
      } catch (error) {
        console.error('Error parsing recordChange event:', error);
      }
    });

    eventSource.onerror = (error) => {
      console.error('❌ SSE Connection error:', error);
      // EventSource will automatically try to reconnect
    };

    return () => {
      console.log('🔌 Closing SSE connection');
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [onRecordChange, onConnected, enabled]);

  return eventSourceRef;
};