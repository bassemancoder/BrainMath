/**
 * Animations Hook - Manages animation preference with localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { StorageKeys } from '@domain/constants';

type AnimationSetting = 'enabled' | 'disabled';

function getInitialAnimationSetting(): AnimationSetting {
  // Check localStorage first
  const stored = localStorage.getItem(StorageKeys.ANIMATIONS);
  if (stored === 'enabled' || stored === 'disabled') {
    return stored;
  }

  // Fall back to system preference (prefers-reduced-motion)
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return 'disabled';
  }

  return 'enabled';
}

export function useAnimations() {
  const [animations, setAnimationsState] = useState<AnimationSetting>(getInitialAnimationSetting);

  // Apply animation setting to document
  useEffect(() => {
    document.documentElement.setAttribute('data-animations', animations);
    localStorage.setItem(StorageKeys.ANIMATIONS, animations);
  }, [animations]);

  // Listen for system preference changes (only if no stored preference)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem(StorageKeys.ANIMATIONS);
      if (!stored) {
        setAnimationsState(e.matches ? 'disabled' : 'enabled');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleAnimations = useCallback(() => {
    setAnimationsState(prev => prev === 'enabled' ? 'disabled' : 'enabled');
  }, []);

  const setAnimations = useCallback((newSetting: AnimationSetting) => {
    setAnimationsState(newSetting);
  }, []);

  return {
    animations,
    toggleAnimations,
    setAnimations,
    animationsEnabled: animations === 'enabled',
  };
}
