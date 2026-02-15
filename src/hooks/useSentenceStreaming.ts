'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Split text into sentences using regex.
 * Handles ., !, ? followed by whitespace or end of string.
 */
export function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!matches) return text.trim() ? [text.trim()] : [];
  return matches.map((s) => s.trim()).filter(Boolean);
}

interface UseSentenceStreamingReturn {
  visibleText: string;
  isStreaming: boolean;
}

/**
 * Progressive sentence reveal hook.
 * When isActive, reveals sentences one at a time based on estimated speech duration.
 * When !isActive, returns full content immediately.
 */
export function useSentenceStreaming(
  content: string | undefined,
  isActive: boolean
): UseSentenceStreamingReturn {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevContentRef = useRef<string | undefined>(undefined);

  // Reset when content changes
  useEffect(() => {
    if (content !== prevContentRef.current) {
      prevContentRef.current = content;
      if (isActive) {
        setVisibleCount(1); // Show first sentence immediately
        setIsStreaming(true);
      }
    }
  }, [content, isActive]);

  useEffect(() => {
    if (!content || !isActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsStreaming(false);
      return;
    }

    const sentences = splitIntoSentences(content);
    if (sentences.length <= 1) {
      setVisibleCount(sentences.length);
      setIsStreaming(false);
      return;
    }

    // Estimate total speech duration from word count (~150 WPM)
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const totalDurationMs = Math.max((wordCount / 150) * 60 * 1000, 10000);
    const intervalMs = totalDurationMs / sentences.length;

    // Start revealing
    setVisibleCount(1);
    setIsStreaming(true);

    timerRef.current = setInterval(() => {
      setVisibleCount((prev) => {
        const next = prev + 1;
        if (next >= sentences.length) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsStreaming(false);
          return sentences.length;
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, isActive]);

  if (!content) {
    return { visibleText: '', isStreaming: false };
  }

  if (!isActive) {
    return { visibleText: content, isStreaming: false };
  }

  const sentences = splitIntoSentences(content);
  const visibleText = sentences.slice(0, visibleCount).join(' ');

  return { visibleText, isStreaming };
}
