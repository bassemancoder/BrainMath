import type { GameState, GameAction } from '../gameReducer';
import { useGameLifecycle } from './actions/useGameLifecycle';
import { useGameInput } from './actions/useGameInput';
import { useGameSettings } from './actions/useGameSettings';
import { useGameModes } from './actions/useGameModes';
import { useGameDebug } from './actions/useGameDebug';
import { useGameShare } from './actions/useGameShare';

export function useGameActions(state: GameState, dispatch: React.Dispatch<GameAction>) {
  const lifecycle = useGameLifecycle(state, dispatch);
  const input = useGameInput(state, dispatch);
  const settings = useGameSettings(dispatch);
  const modes = useGameModes(state, dispatch);
  const debug = useGameDebug(state, dispatch);
  const share = useGameShare(state);

  return {
    ...lifecycle,
    ...input,
    ...settings,
    ...modes,
    ...debug,
    ...share,
  };
}
