'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LieAlert } from '@/types/agent';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseLieAlertsReturn {
  alerts: LieAlert[];
  activeAlert: LieAlert | null;
  dismissAlert: (id: string) => void;
}

export function useLieAlerts(debateId: string): UseLieAlertsReturn {
  const [alerts, setAlerts] = useState<LieAlert[]>([]);
  const [activeAlert, setActiveAlert] = useState<LieAlert | null>(null);
  const activeAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the auto-dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (activeAlertTimerRef.current) {
        clearTimeout(activeAlertTimerRef.current);
      }
    };
  }, []);

  const showActiveAlert = useCallback((alert: LieAlert) => {
    // Clear any existing timer
    if (activeAlertTimerRef.current) {
      clearTimeout(activeAlertTimerRef.current);
    }

    setActiveAlert(alert);

    // Auto-clear after 5 seconds
    activeAlertTimerRef.current = setTimeout(() => {
      setActiveAlert((current) => (current?.id === alert.id ? null : current));
      activeAlertTimerRef.current = null;
    }, 5000);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a))
    );
    setActiveAlert((current) => (current?.id === id ? null : current));

    // Clear timer if dismissing the active alert
    if (activeAlertTimerRef.current) {
      clearTimeout(activeAlertTimerRef.current);
      activeAlertTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Fetch any existing alerts for the debate
    const fetchExistingAlerts = async () => {
      const { data, error } = await supabase
        .from('lie_alerts')
        .select('*')
        .eq('debate_id', debateId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch lie alerts:', error);
        return;
      }

      if (data) {
        setAlerts(data as LieAlert[]);
      }
    };

    fetchExistingAlerts();

    const channel = supabase
      .channel(`lie-alerts-${debateId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lie_alerts',
          filter: `debate_id=eq.${debateId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newAlert = payload.new as LieAlert;
          setAlerts((prev) => {
            if (prev.some((a) => a.id === newAlert.id)) return prev;
            return [...prev, newAlert];
          });
          // Show the new alert as the active RED POPUP
          showActiveAlert(newAlert);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [debateId, showActiveAlert]);

  return { alerts, activeAlert, dismissAlert };
}
