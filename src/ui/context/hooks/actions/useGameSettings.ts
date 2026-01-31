import { useCallback } from 'react';
import type { GridSize, Difficulty } from '@domain/types';
import type { GameAction } from '../../gameReducer';

export function useGameSettings(dispatch: React.Dispatch<GameAction>) {
  const showSettings = useCallback(() => {
    dispatch({ type: 'SHOW_SETTINGS' });
  }, [dispatch]);

  const hideSettings = useCallback(() => {
    dispatch({ type: 'HIDE_SETTINGS' });
  }, [dispatch]);

  const updateSettings = useCallback((gridSize?: GridSize, difficulty?: Difficulty) => {
    dispatch({ type: 'UPDATE_SETTINGS', gridSize, difficulty });
  }, [dispatch]);

  return {
    showSettings,
    hideSettings,
    updateSettings,
  };
}
