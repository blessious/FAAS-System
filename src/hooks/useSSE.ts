import { useEffect, useRef } from 'react';

interface RecordChangeEvent {
  action: 'created' | 'updated' | 'submitted' | 'approved' | 'rejected' | 'deleted' | 'files_generated';
  record: {
    id: string | number;
    arf_no: string;
    pin?: string;
    owner_name: string | null;
    status: string;
    encoder_id: number;
  };
  timestamp: string;
}

interface UserChangeEvent {
  action: 'created' | 'updated' | 'deleted';
  userId: string | number;
  timestamp: string;
}

interface SSEOptions {
  onRecordChange?: (data: RecordChangeEvent) => void;
  onUserChange?: (data: UserChangeEvent) => void;
  onConnected?: (data: any) => void;
  enabled?: boolean;
}

export const useSSE = ({ onRecordChange, onUserChange, onConnected, enabled = true }: SSEOptions) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onRecordChangeRef = useRef(onRecordChange);
  const onUserChangeRef = useRef(onUserChange);
  const onConnectedRef = useRef(onConnected);

  // Update refs when handlers change
  useEffect(() => { onRecordChangeRef.current = onRecordChange; }, [onRecordChange]);
  useEffect(() => { onUserChangeRef.current = onUserChange; }, [onUserChange]);
  useEffect(() => { onConnectedRef.current = onConnected; }, [onConnected]);

  useEffect(() => {
    if (!enabled) return;

    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id || 'anonymous';

    console.log(`🔌 Opening SSE connection to ${API_URL}/api/events/stream?userId=${userId}`);

    const eventSource = new EventSource(`${API_URL}/api/events/stream?userId=${userId}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('✅ SSE Connected:', data);
        onConnectedRef.current?.(data);
      } catch (error) {
        console.error('Error parsing connected event:', error);
      }
    });

    eventSource.addEventListener('recordChange', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 Record change received:', data);
        onRecordChangeRef.current?.(data);
      } catch (error) {
        console.error('Error parsing recordChange event:', error);
      }
    });

    eventSource.addEventListener('userChange', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('👥 User change received:', data);
        onUserChangeRef.current?.(data);
      } catch (error) {
        console.error('Error parsing userChange event:', error);
      }
    });

    eventSource.onerror = (error) => {
      console.error('❌ SSE Connection error:', error);
    };

    return () => {
      console.log('🔌 Closing SSE connection');
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [enabled]);

  return eventSourceRef;
};