'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LieAlert } from '@/types/agent';

interface LieAlertPopupProps {
  alert: LieAlert | null;
  onDismiss: () => void;
}

export default function LieAlertPopup({ alert, onDismiss }: LieAlertPopupProps) {
  // Auto-dismiss based on severity
  useEffect(() => {
    if (!alert) return;

    const duration = alert.severity === 'critical' ? 5000 : 3000;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [alert, onDismiss]);

  const handleDismiss = () => {
    // Sound effect placeholder
    // audio.play() would go here for dismiss sound
    onDismiss();
  };

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleDismiss}
        >
          {/* Semi-transparent dark red background with blur */}
          <div className="absolute inset-0 bg-red-950/60 backdrop-blur-sm" />

          {/* Alert card */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative z-10 mx-4 max-w-lg w-full rounded-2xl border-2 border-red-500/50 bg-red-950/90 p-8 shadow-2xl shadow-red-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-4 top-4 text-red-300/60 hover:text-red-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Alert icon */}
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 ring-2 ring-red-500/40">
                <ShieldAlert className="h-8 w-8 text-red-400" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-center text-lg font-bold text-red-200 mb-1">
              False Claim Detected
            </h2>

            {/* Agent name */}
            <p className="text-center text-sm text-red-300/80 mb-4">
              <span className="font-medium text-red-300">{alert.agent_name}</span>{' '}
              made a false claim
            </p>

            {/* The false claim */}
            <blockquote className="mb-4 rounded-lg border border-red-500/30 bg-red-900/40 px-4 py-3">
              <p className="text-base font-medium text-red-100 leading-relaxed italic">
                &ldquo;{alert.claim_text}&rdquo;
              </p>
            </blockquote>

            {/* Explanation */}
            <p className="text-sm text-red-200/80 leading-relaxed mb-4">
              {alert.explanation}
            </p>

            {/* Severity + confidence row */}
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className={`text-[11px] ${
                  alert.severity === 'critical'
                    ? 'bg-red-500/30 text-red-200 border-red-500/50'
                    : 'bg-yellow-500/30 text-yellow-200 border-yellow-500/50'
                }`}
              >
                {alert.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
              </Badge>

              <span className="text-xs text-red-300/60">
                Click anywhere to dismiss
              </span>
            </div>

            {/* Sound effect placeholder */}
            {/* audio.play() would go here when alert appears */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
