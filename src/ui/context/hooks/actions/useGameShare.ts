import { useCallback } from 'react';
import { urlHashAdapter } from '@infrastructure/url/UrlHashAdapter';
import type { GameState } from '../../gameReducer';

export function useGameShare(state: GameState) {
  const copyHashToClipboard = useCallback(async (): Promise<boolean> => {
    if (!state.puzzle) return false;

    // Get the full shareable URL instead of just the hash
    const shareableUrl = urlHashAdapter.getShareableUrl(state.puzzle.hash);

    try {
      await navigator.clipboard.writeText(shareableUrl);
      return true;
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareableUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  }, [state.puzzle]);

  const getShareableUrl = useCallback((): string | null => {
    if (!state.puzzle) return null;
    return urlHashAdapter.getShareableUrl(state.puzzle.hash);
  }, [state.puzzle]);

  return {
    copyHashToClipboard,
    getShareableUrl
  };
}
