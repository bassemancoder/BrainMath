/**
 * Settings Component - Grid size and difficulty selection
 */

import React, { useState, useCallback } from 'react';
import type { GridSize, Difficulty, Grid } from '@domain/types';
import { GRID_SIZES, DIFFICULTIES, getGridSizeLabel, getDifficultyLabel } from '@domain/services/DifficultySettings';
import { isValidHash } from '@domain/entities/GameHash';
import { createGameAsync, generateNewHash, type ProgressCallback } from '@application/useCases/CreateGameUseCase';
import { seededRandomAdapter } from '@infrastructure/random/SeededRandom';
import { useTheme } from '../../hooks/useTheme';
import { Help } from '../Help/Help';
import styles from './Settings.module.css';
import logo from '../../../assets/logo.png';
import { version } from '../../../../package.json';

interface SettingsProps {
  currentSize: GridSize;
  currentDifficulty: Difficulty;
  onStart: (hash?: string) => void;
  onClose: () => void;
  onUpdateSettings: (size?: GridSize, difficulty?: Difficulty) => void;
  showClose?: boolean;
}

/** Mini preview of a grid layout - shows structure without numbers */
const MiniMap: React.FC<{ grid: Grid }> = ({ grid }) => {
  // Calculate bounds to show only the used area
  let minRow = grid.height, maxRow = 0, minCol = grid.width, maxCol = 0;
  for (let r = 0; r < grid.height; r++) {
    for (let c = 0; c < grid.width; c++) {
      if (grid.cells[r]?.[c] !== null) {
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
      }
    }
  }
  
  const rows = [];
  for (let r = minRow; r <= maxRow; r++) {
    const cells = [];
    for (let c = minCol; c <= maxCol; c++) {
      const cell = grid.cells[r]?.[c];
      let cellClass = styles.miniEmpty;
      if (cell) {
        if (cell.type === 'number') {
          cellClass = cell.isFixed ? styles.miniFixed : styles.miniEditable;
        } else if (cell.type === 'operator') {
          cellClass = styles.miniOperator;
        } else if (cell.type === 'result') {
          cellClass = styles.miniResult;
        } else if (cell.type === 'equals') {
          cellClass = styles.miniEquals;
        }
      }
      cells.push(<div key={c} className={cellClass} />);
    }
    rows.push(<div key={r} className={styles.miniRow}>{cells}</div>);
  }
  
  return <div className={styles.miniMap}>{rows}</div>;
};

export const Settings: React.FC<SettingsProps> = ({
  currentSize,
  currentDifficulty,
  onStart,
  onClose,
  onUpdateSettings,
  showClose = true,
}) => {
  const { theme, setTheme } = useTheme();
  const [hashInput, setHashInput] = useState('');
  const [hashError, setHashError] = useState<string | null>(null);
  const [showHashInput, setShowHashInput] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  
  // Preview state
  const [previewHash, setPreviewHash] = useState<string | null>(null);
  const [previewGrid, setPreviewGrid] = useState<Grid | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');
  
  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  const handleHashSubmit = () => {
    const hash = hashInput.trim().toUpperCase();
    if (!hash) {
      setHashError('Please enter a puzzle code');
      return;
    }
    if (!isValidHash(hash)) {
      setHashError('Invalid puzzle code format');
      return;
    }
    setHashError(null);
    onStart(hash);
  };

  const handleGeneratePreview = useCallback(async () => {
    setIsGenerating(true);
    setGenerationMessage('Generating...');
    setPreviewHash(null);
    setPreviewGrid(null);
    
    // Generate a new hash
    const hash = generateNewHash(currentSize, currentDifficulty, seededRandomAdapter);
    
    // Generate the puzzle with progress
    const onProgress: ProgressCallback = (progress) => {
      setGenerationMessage(`Attempt ${progress.attempt}/${progress.maxAttempts}`);
    };
    
    const result = await createGameAsync(
      { hash },
      seededRandomAdapter,
      onProgress
    );
    
    setIsGenerating(false);
    
    if (result.success && result.puzzle) {
      setPreviewHash(result.puzzle.hash);
      setPreviewGrid(result.puzzle.solution); // Show solution grid for structure
    } else {
      setGenerationMessage('Failed to generate. Try again.');
    }
  }, [currentSize, currentDifficulty]);

  const handleStartPreview = () => {
    if (previewHash) {
      onStart(previewHash);
    }
  };

  const handleClearPreview = () => {
    setPreviewHash(null);
    setPreviewGrid(null);
    setGenerationMessage('');
  };

  const handleShareApp = useCallback(async () => {
    const shareUrl = window.location.origin + window.location.pathname;
    const shareData = {
      title: 'Brain Math',
      text: 'Try this math puzzle game!',
      url: shareUrl,
    };

    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share failed, fall back to clipboard
      }
    }

    // Fall back to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage('Link copied!');
      setTimeout(() => setShareMessage(null), 2000);
    } catch {
      setShareMessage('Failed to copy');
      setTimeout(() => setShareMessage(null), 2000);
    }
  }, []);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {showClose && (
          <button className={styles.closeButton} onClick={onClose} type="button">
            ✕
          </button>
        )}

        <div className={styles.titleGroup}>
          <img src={logo} alt="Brain Math" className={styles.logo} />
          <h2 className={styles.title}>Brain Math</h2>
        </div>
        <p className={styles.subtitle}>
          Solve the math puzzle by filling in the missing numbers.{' '}
          <button
            className={styles.rulesLink}
            onClick={() => setShowHelp(true)}
            type="button"
          >
            Read rules
          </button>
        </p>

        {!showHashInput ? (
          <>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Grid Size</h3>
              <div className={styles.options}>
                {GRID_SIZES.map((size) => (
                  <button
                    key={size}
                    className={`${styles.option} ${size === currentSize ? styles.selected : ''}`}
                    onClick={() => {
                      onUpdateSettings(size, undefined);
                      handleClearPreview();
                    }}
                    type="button"
                    disabled={isGenerating}
                  >
                    {getGridSizeLabel(size)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Difficulty</h3>
              <div className={styles.options}>
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff}
                    className={`${styles.option} ${diff === currentDifficulty ? styles.selected : ''}`}
                    onClick={() => {
                      onUpdateSettings(undefined, diff);
                      handleClearPreview();
                    }}
                    type="button"
                    disabled={isGenerating}
                  >
                    {getDifficultyLabel(diff)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.actions}>
              {previewGrid ? (
                <>
                  <button
                    className={`${styles.button} ${styles.primary}`}
                    onClick={handleStartPreview}
                    type="button"
                  >
                    ▶️ Start This Puzzle
                  </button>
                  <button
                    className={styles.button}
                    onClick={handleGeneratePreview}
                    type="button"
                    disabled={isGenerating}
                  >
                    🎲 Generate Another
                  </button>
                </>
              ) : (
                <button
                  className={`${styles.button} ${styles.primary}`}
                  onClick={handleGeneratePreview}
                  type="button"
                  disabled={isGenerating}
                >
                  🎲 Generate Map
                </button>
              )}
              <button
                className={styles.button}
                onClick={() => setShowHashInput(true)}
                type="button"
                disabled={isGenerating}
              >
                🔗 Enter Puzzle Code
              </button>
            </div>

            {/* Preview Section - below generate button */}
            {(isGenerating || previewGrid) && (
              <div className={styles.previewSection}>
                <h3 className={styles.sectionTitle}>Preview</h3>
                {isGenerating ? (
                  <div className={styles.generatingPreview}>
                    <div className={styles.spinner}></div>
                    <p>{generationMessage}</p>
                  </div>
                ) : previewGrid && (
                  <>
                    <MiniMap grid={previewGrid} />
                    <p className={styles.previewHash}>Code: {previewHash}</p>
                  </>
                )}
              </div>
            )}

            <hr className={styles.separator} />

            {/* Theme Section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Theme</h3>
              <div className={styles.themeToggle}>
                <button
                  className={`${styles.themeOption} ${theme === 'light' ? styles.selected : ''}`}
                  onClick={() => setTheme('light')}
                  type="button"
                >
                  ☀️ Light
                </button>
                <button
                  className={`${styles.themeOption} ${theme === 'dark' ? styles.selected : ''}`}
                  onClick={() => setTheme('dark')}
                  type="button"
                >
                  🌙 Dark
                </button>
              </div>
            </div>

            {/* Share Button */}
            <div className={styles.shareSection}>
              <button
                className={styles.shareButton}
                onClick={handleShareApp}
                type="button"
              >
                📤 Share Brain Math
              </button>
              {shareMessage && <p className={styles.shareMessage}>{shareMessage}</p>}
            </div>

            <p className={styles.version}>v{version}</p>
          </>
        ) : (
          <div className={styles.hashInputSection}>
            <p className={styles.hashInputLabel}>
              Enter a puzzle code to play the same puzzle as a friend:
            </p>
            <input
              type="text"
              className={styles.hashInput}
              value={hashInput}
              onChange={(e) => {
                setHashInput(e.target.value.toUpperCase());
                setHashError(null);
              }}
              placeholder="e.g., 52A7X2"
              maxLength={6}
              autoFocus
            />
            {hashError && <p className={styles.hashError}>{hashError}</p>}
            <div className={styles.actions}>
              <button
                className={`${styles.button} ${styles.primary}`}
                onClick={handleHashSubmit}
                type="button"
              >
                ▶️ Play Puzzle
              </button>
              <button
                className={styles.button}
                onClick={() => {
                  setShowHashInput(false);
                  setHashInput('');
                  setHashError(null);
                }}
                type="button"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Help Modal */}
        {showHelp && <Help onClose={() => setShowHelp(false)} />}
      </div>
    </div>
  );
};

export default Settings;
