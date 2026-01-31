/**
 * App Component - Main game container
 */

import React, { useState, useMemo } from 'react';
import { useGame } from './context/GameContext';
import { Board, NumberPad, Timer, HashDisplay, GameOver, Settings, Help } from './components';
import { calculateScore, getCellAt } from '@domain/services';
import { useTheme } from './hooks/useTheme';
import styles from './App.module.css';
import logo from '../assets/logo.png';

export const App: React.FC = () => {
  const { state, actions } = useGame();
  useTheme(); // Initialize theme (side effects only)
  
  // Track if win dialog has been dismissed for current game
  const [winDialogDismissedForHash, setWinDialogDismissedForHash] = useState<string | null>(null);
  
  // Track if help dialog is open
  const [showHelp, setShowHelp] = useState(false);
  
  // Track if header is collapsed on mobile
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  
  // Show win dialog if won and not dismissed for this specific puzzle
  const showWinDialog = state.status === 'won' && winDialogDismissedForHash !== state.puzzle?.hash;

  // Calculate score from state
  const score = useMemo(() => {
    return calculateScore(
      state.initialScore,
      state.timer,
      state.wrongAttemptCount,
      state.hintCount
    );
  }, [state.initialScore, state.timer, state.wrongAttemptCount, state.hintCount]);

  // Get the currently selected cell (for clear button state)
  const selectedCell = useMemo(() => {
    if (!state.puzzle || !state.selectedCell) return null;
    return getCellAt(state.puzzle.grid, state.selectedCell.row, state.selectedCell.col);
  }, [state.puzzle, state.selectedCell]);

  // Can clear if a cell is selected and it has a value OR has candidates
  const canClear = selectedCell !== null && selectedCell.type === 'number' && !selectedCell.isFixed && 
    (selectedCell.value !== null || (selectedCell.candidates && selectedCell.candidates.length > 0));

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

  // Show generating overlay when generating a new puzzle
  if (state.isGenerating) {
    return (
      <div className={styles.app}>
        <div className={styles.generatingOverlay}>
          <div className={styles.generatingContent}>
            <img src={logo} alt="Brain Math" className={styles.heartbeat} />
            <p className={styles.generatingMessage}>Generating puzzle...</p>
          </div>
        </div>
      </div>
    );
  }

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
            actions.hideSettings();
          }}
          onUpdateSettings={actions.updateSettings}
          showClose={state.status !== 'idle'}
        />
      </div>
    );
  }

  // Show game over modal when won
  if (state.status === 'won' && state.puzzle) {
    return (
      <div className={styles.app}>
        {/* Show game board with header */}
        <div className={`${styles.mainContent} ${showWinDialog ? styles.gameBlurred : ''}`}>
          <header className={styles.header}>
            <div className={styles.titleGroup}>
              <img src={logo} alt="Brain Math" className={styles.logo} />
              <h1 className={styles.title}>Brain Math</h1>
            </div>
            <div className={styles.headerButtons}>
              {!showWinDialog && (
                <button
                  className={styles.showScoreButton}
                  onClick={() => setWinDialogDismissedForHash(null)}
                  type="button"
                  aria-label="Show Score"
                >
                  🏆 Score
                </button>
              )}
              <button
                className={styles.settingsButton}
                onClick={actions.showSettings}
                type="button"
                aria-label="Settings"
              >
                ⚙️
              </button>
            </div>
          </header>

          <div className={styles.statusBar}>
            <HashDisplay
              hash={state.puzzle.hash}
              onCopy={actions.copyHashToClipboard}
              onShare={'share' in navigator ? handleShare : undefined}
              onDebugDump={actions.debugDumpPuzzle}
            />

            <Timer
              time={state.timer}
              isRunning={false}
              selectedCellCoords={null}
              score={score}
            />
          </div>

          <Board
            grid={state.puzzle.grid}
            selectedCell={null}
            errors={[]}
            onCellClick={() => {}}
          />
        </div>
        
        {/* GameOver modal - rendered AFTER game board so it's on top in DOM order */}
        {showWinDialog && (
          <GameOver
            time={state.timer}
            score={score}
            hash={state.puzzle.hash}
            onNewGame={() => {
              actions.resetGame();
              actions.showSettings();
            }}
            onPlayAgain={() => {
              actions.startGame(state.puzzle?.hash);
            }}
            onClose={() => setWinDialogDismissedForHash(state.puzzle?.hash ?? null)}
            shareableUrl={actions.getShareableUrl()}
            wrongAttemptCount={state.wrongAttemptCount}
            hintCount={state.hintCount}
            difficulty={state.settings.difficulty}
            gridSize={state.settings.gridSize}
            initialScore={state.initialScore}
          />
        )}
      </div>
    );
  }

  // Main game view
  if (state.puzzle) {
    // Calculate selected cell coordinates (H1, V1 format - relative to visible grid)
    const getSelectedCellCoords = (): string | null => {
      if (!state.selectedCell || !state.puzzle) return null;
      
      const grid = state.puzzle.grid;
      
      // Calculate grid bounds (same logic as Board component)
      let minRow = grid.height;
      let minCol = grid.width;
      
      for (let row = 0; row < grid.height; row++) {
        for (let col = 0; col < grid.width; col++) {
          if (grid.cells[row]?.[col] !== null) {
            minRow = Math.min(minRow, row);
            minCol = Math.min(minCol, col);
          }
        }
      }
      
      // Calculate relative (1-based) coordinates
      const relativeCol = state.selectedCell.col - minCol + 1;
      const relativeRow = state.selectedCell.row - minRow + 1;
      
      return `H${relativeCol}, V${relativeRow}`;
    };

    const selectedCellCoords = getSelectedCellCoords();
    return (
      <div className={styles.app}>
        {showHelp && <Help onClose={() => setShowHelp(false)} />}
        <div className={styles.mainContent}>
          {!headerCollapsed && (
            <>
              <header className={styles.header}>
                <img src={logo} alt="Brain Math" className={styles.logo} />
                <h1 className={styles.title}>Brain Math</h1>
                <button
                  className={styles.settingsButton}
                  onClick={actions.showSettings}
                  type="button"
                  aria-label="Settings"
                >
                  ⚙️
                </button>
              </header>

              <div className={styles.statusBar}>
                <HashDisplay
                  hash={state.puzzle.hash}
                  onCopy={actions.copyHashToClipboard}
                  onDebugDump={actions.debugDumpPuzzle}
                />

                <Timer
                  time={state.timer}
                  isRunning={state.isTimerRunning}
                  selectedCellCoords={selectedCellCoords}
                  score={score}
                />
              </div>
            </>
          )}

          <Board
            grid={state.puzzle.grid}
            selectedCell={state.selectedCell}
            errors={state.errors}
            highlightedNumber={state.highlightedNumber}
            swapFirstCell={state.swapFirstCell}
            hintedCell={state.hintedCell}
            errorHintCell={state.errorHintCell}
            justPlacedCell={state.justPlacedCell}
            onCellClick={
              state.swapMode 
                ? actions.handleSwapCellClick 
                : state.uncertainMode 
                  ? actions.handleUncertainCellClick 
                  : actions.selectCell
            }
            onCellDoubleClick={state.swapMode || state.uncertainMode ? undefined : actions.clearCell}
            onDeselect={
              state.swapMode 
                ? () => actions.toggleSwapMode() 
                : state.uncertainMode 
                  ? () => actions.toggleUncertainMode() 
                  : actions.deselectCell
            }
            headerCollapsed={headerCollapsed}
            onToggleHeader={() => setHeaderCollapsed(!headerCollapsed)}
          />
        </div>

        <div className={styles.numberPadContainer}>
          <NumberPad
            onNumberClick={actions.placeNumber}
            onUndo={actions.undo}
            onSolve={
              (window.location.hostname === 'localhost')
                ? actions.solvePuzzle
                : undefined
            }
            onSwap={actions.toggleSwapMode}
            onHint={actions.useHint}
            onUncertain={actions.toggleUncertainMode}
            onPencil={actions.togglePencilMode}
            disabled={!state.selectedCell && !state.swapMode}
            canUndo={state.undoStack.length > 0}
            canClear={canClear}
            uncertainMode={state.uncertainMode}
            pencilMode={state.pencilMode}
            swapMode={state.swapMode}
            swapFirstCellSelected={state.swapFirstCell !== null}
            hasEmptyCells={state.availableNumbers.length > 0}
            hintCooldownUntil={state.hintCooldownUntil}
            availableNumbers={state.availableNumbers}
            usedNumbers={state.usedNumbers}
            highlightedNumber={state.highlightedNumber}
            onUsedNumberClick={actions.setHighlightedNumber}
          />
        </div>
      </div>
    );
  }

  return null;
};

export default App;
