/**
 * useBoardDrag - Custom hook for drag-to-scroll functionality
 * 
 * Provides pointer event handlers for panning/scrolling the board
 * container by clicking and dragging with a mouse only.
 * Touch scrolling is handled natively by the browser via touch-action CSS.
 */

import { useState, useCallback, useRef, type RefObject } from 'react';

// ============================================
// TYPES
// ============================================

/** Internal state for tracking drag operations */
interface DragState {
  /** Whether we're tracking a potential drag (mouse is down) */
  isTracking: boolean;
  /** Whether actual dragging/scrolling has started (moved past threshold) */
  isDragging: boolean;
  /** Starting X position of the drag (in page coordinates) */
  startX: number;
  /** Starting Y position of the drag (in page coordinates) */
  startY: number;
  /** Scroll position at drag start (horizontal) */
  scrollLeft: number;
  /** Scroll position at drag start (vertical) */
  scrollTop: number;
}

/** Return type for the useBoardDrag hook */
export interface BoardDragHandlers {
  /** Ref to attach to the scrollable container */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Whether currently dragging (for cursor styling) */
  isDragging: boolean;
  /** Check if a drag operation just completed (to suppress clicks) - call from event handlers only */
  getWasDragging: () => boolean;
  /** Pointer down handler (mouse only) */
  handlePointerDown: (e: React.PointerEvent) => void;
  /** Pointer move handler (mouse only) */
  handlePointerMove: (e: React.PointerEvent) => void;
  /** Pointer up handler (mouse only) */
  handlePointerUp: (e: React.PointerEvent) => void;
}

// ============================================
// CONSTANTS
// ============================================

/** Minimum pixels moved before considering it a drag (not a click) */
const DRAG_THRESHOLD = 5;

// ============================================
// HOOK IMPLEMENTATION
// ============================================

/**
 * Custom hook for drag-to-scroll functionality on the board.
 * Uses Pointer Events API with pointerType filtering to only handle
 * mouse interactions. Touch scrolling is handled natively by the browser.
 * 
 * Key behavior: Only starts drag scrolling after the user moves past the
 * threshold, allowing normal clicks on cells to work as expected.
 * 
 * @returns Object containing container ref and event handlers
 */
export function useBoardDrag(): BoardDragHandlers {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [dragState, setDragState] = useState<DragState>({
    isTracking: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  
  // Track if a drag just completed (to suppress cell clicks)
  const wasDraggingRef = useRef(false);

  // ----------------------------------------
  // Pointer Event Handlers (Mouse Only)
  // ----------------------------------------

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle mouse events, let touch events pass through for native scrolling
    if (e.pointerType !== 'mouse') return;
    
    // Only track on left mouse button
    if (e.button !== 0) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Reset wasDragging flag
    wasDraggingRef.current = false;
    
    // Start tracking potential drag (don't capture yet - allow clicks to work)
    setDragState({
      isTracking: true,
      isDragging: false,
      startX: e.pageX - container.offsetLeft,
      startY: e.pageY - container.offsetTop,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Only handle mouse events
    if (e.pointerType !== 'mouse') return;
    
    // Must be tracking (mouse was pressed down)
    if (!dragState.isTracking) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    const walkX = x - dragState.startX;
    const walkY = y - dragState.startY;
    
    // Check if we've moved enough to start dragging
    if (!dragState.isDragging) {
      if (Math.abs(walkX) > DRAG_THRESHOLD || Math.abs(walkY) > DRAG_THRESHOLD) {
        // Start actual dragging
        setDragState(prev => ({ ...prev, isDragging: true }));
      }
      return; // Don't scroll yet until we're past the threshold
    }
    
    // We're dragging - prevent default and scroll
    e.preventDefault();
    
    container.scrollLeft = dragState.scrollLeft - walkX;
    container.scrollTop = dragState.scrollTop - walkY;
  }, [dragState]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Only handle mouse events
    if (e.pointerType !== 'mouse') return;
    
    // Track if we were dragging (to suppress cell clicks if needed)
    if (dragState.isDragging) {
      wasDraggingRef.current = true;
      
      // Clear wasDragging after a short delay to allow click events to check it
      setTimeout(() => {
        wasDraggingRef.current = false;
      }, 100);
    }
    
    setDragState(prev => ({ ...prev, isTracking: false, isDragging: false }));
  }, [dragState.isDragging]);

  // Getter function to check wasDragging - safe to call from event handlers
  const getWasDragging = useCallback(() => wasDraggingRef.current, []);

  return {
    containerRef,
    isDragging: dragState.isDragging,
    getWasDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
