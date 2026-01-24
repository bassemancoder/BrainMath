/**
 * Haptic Feedback Utility
 * Provides haptic feedback on supported devices (native Android via Capacitor)
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * Check if haptics are available (native platform)
 */
const isHapticsAvailable = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Light impact - for cell selection, number pad taps
 */
export const lightImpact = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Silently fail if haptics unavailable
  }
};

/**
 * Medium impact - for number placement
 */
export const mediumImpact = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Silently fail if haptics unavailable
  }
};

/**
 * Heavy impact - for undo, clear actions
 */
export const heavyImpact = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {
    // Silently fail if haptics unavailable
  }
};

/**
 * Success notification - for winning the game
 */
export const successNotification = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Silently fail if haptics unavailable
  }
};

/**
 * Warning notification - for validation errors
 */
export const warningNotification = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    // Silently fail if haptics unavailable
  }
};

/**
 * Error notification - for invalid moves
 */
export const errorNotification = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    // Silently fail if haptics unavailable
  }
};
