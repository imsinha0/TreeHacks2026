'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlayerReturn {
  enqueue: (url: string) => void;
  isPlaying: boolean;
  currentUrl: string | null;
  skip: () => void;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  // Queue in a ref so playNext() always sees the latest URLs (avoids React state timing)
  const queueRef = useRef<string[]>([]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current = null;
      }
    };
  }, []);

  const playNext = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length === 0) {
      setIsPlaying(false);
      setCurrentUrl(null);
      isPlayingRef.current = false;
      return;
    }

    const [nextUrl, ...rest] = queue;
    queueRef.current = rest;
    setCurrentUrl(nextUrl);
    setIsPlaying(true);
    isPlayingRef.current = true;

    // Create or reuse Audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;

    const handleEnded = () => {
      playNext();
    };

    audio.onended = handleEnded;
    audio.onerror = () => {
      console.error('Audio playback error');
      playNext();
    };
    audio.src = nextUrl;
    audio.play().catch((err) => {
      console.error('Failed to play audio:', err);
      playNext();
    });
  }, []);

  const enqueue = useCallback((url: string) => {
    queueRef.current = [...queueRef.current, url];
    if (!isPlayingRef.current) {
      playNext();
    }
  }, [playNext]);

  const skip = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    playNext();
  }, [playNext]);

  return { enqueue, isPlaying, currentUrl, skip };
}
