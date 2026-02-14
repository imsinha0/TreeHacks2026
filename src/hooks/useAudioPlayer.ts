'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlayerReturn {
  enqueue: (url: string) => void;
  isPlaying: boolean;
  currentUrl: string | null;
  skip: () => void;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [, setQueue] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

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
    setQueue((prevQueue) => {
      if (prevQueue.length === 0) {
        setIsPlaying(false);
        setCurrentUrl(null);
        isPlayingRef.current = false;
        return prevQueue;
      }

      const [nextUrl, ...rest] = prevQueue;
      setCurrentUrl(nextUrl);
      setIsPlaying(true);
      isPlayingRef.current = true;

      // Create or reuse Audio element
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const audio = audioRef.current;

      // Remove previous event listeners by replacing with fresh ones
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

      return rest;
    });
  }, []);

  const enqueue = useCallback(
    (url: string) => {
      setQueue((prev) => {
        const newQueue = [...prev, url];

        // If nothing is currently playing, start playback
        if (!isPlayingRef.current) {
          // Defer playNext to avoid state conflicts
          setTimeout(() => playNext(), 0);
        }

        return newQueue;
      });
    },
    [playNext]
  );

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
