/**
 * App Component - Main game container
 */

import React, { useState, useEffect } from 'react';
import { useGame } from './context/GameContext';
import { Board, NumberPad, Timer, HashDisplay, GameOver, Settings } from './components';
import { localStorageAdapter } from '@infrastructure/storage/LocalStorageAdapter';
import styles from './App.module.css';

export const App: React.FC = () => {
  const { state, actions } = useGame();
  const [showWinDialog, setShowWinDialog] = useState(true);

  // Reset showWinDialog when game status changes to 'won'
  useEffect(() => {
    if (state.status === 'won') {
      setShowWinDialog(true);
    }
  }, [state.status]);

  const handleShare = async () => {
    const url = actions.getShareableUrl();
    if (url && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Brain Math Challenge',
          text: `Can you solve puzzle ${state.puzzle?.hash}?`,
          url,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  };

  // Show settings modal on idle or when explicitly opened
  if (state.status === 'idle' || state.showSettings) {
    return (
      <div className={styles.app}>
        <Settings
          currentSize={state.settings.gridSize}
          currentDifficulty={state.settings.difficulty}
          onStart={(hash) => {
            actions.hideSettings();
            actions.startGame(hash);
          }}
          onClose={() => {
            if (state.status !== 'idle') {
              actions.hideSettings();
            }
          }}
          onUpdateSettings={actions.updateSettings}
        />
      </div>
    );
  }

  // Show game over modal when won
  if (state.status === 'won' && state.puzzle) {
    const bestTime = localStorageAdapter.getBestTime(state.puzzle.hash)?.time ?? null;
    
    return (
      <div className={styles.app}>
        {showWinDialog && (
          <GameOver
            time={state.timer}
            bestTime={bestTime}
            hash={state.puzzle.hash}
            onNewGame={() => {
              actions.resetGame();
              actions.showSettings();
            }}
            onPlayAgain={() => {
              actions.startGame(state.puzzle?.hash);
            }}
            onClose={() => setShowWinDialog(false)}
            shareableUrl={actions.getShareableUrl()}
          />
        )}
        
        {/* Show game board */}
        <div className={showWinDialog ? styles.gameBlurred : undefined}>
          <Board
            grid={state.puzzle.grid}
            selectedCell={null}
            errors={[]}
            onCellClick={() => {}}
          />
        </div>
      </div>
    );
  }

  // Main game view
  if (state.puzzle) {
    const bestTime = localStorageAdapter.getBestTime(state.puzzle.hash)?.time ?? null;

    return (
      <div className={styles.app}>
        <div className={styles.mainContent}>
          <header className={styles.header}>
            <h1 className={styles.title}>🧠 Brain Math</h1>
            <button
              className={styles.settingsButton}
              onClick={actions.showSettings}
              type="button"
              aria-label="Settings"
            >
              ⚙️
            </button>
          </header>

          <HashDisplay
            hash={state.puzzle.hash}
            onCopy={actions.copyHashToClipboard}
            onShare={'share' in navigator ? handleShare : undefined}
          />

          <Timer
            time={state.timer}
            isRunning={state.isTimerRunning}
            bestTime={bestTime}
          />

          <Board
            grid={state.puzzle.grid}
            selectedCell={state.selectedCell}
            errors={state.errors}
            onCellClick={actions.selectCell}
          />
        </div>

        <div className={styles.numberPadContainer}>
          <NumberPad
            onNumberClick={actions.placeNumber}
            disabled={!state.selectedCell}
            availableNumbers={state.availableNumbers}
          />
        </div>
      </div>
    );
  }

  return null;
};

export default App;
