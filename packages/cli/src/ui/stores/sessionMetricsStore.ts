/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { uiTelemetryService, SessionMetrics } from '@pk-code/core';

interface SessionMetaData {
  sessionStartTime: Date;
  promptCount: number;
}

interface SessionLiveMetrics {
  metrics: SessionMetrics;
  lastPromptTokenCount: number;
}

interface SessionMetaStore extends SessionMetaData {
  startNewPrompt: () => void;
  resetSession: () => void;
}

interface SessionLiveMetricsStore extends SessionLiveMetrics {
  updateMetrics: (
    metrics: SessionMetrics,
    lastPromptTokenCount: number,
  ) => void;
}

// Stable metadata store - rarely changes, contains prompt count and session start
export const useSessionMetaStore = create<SessionMetaStore>((set) => ({
  sessionStartTime: new Date(),
  promptCount: 0,

  startNewPrompt: () =>
    set((state) => ({
      promptCount: state.promptCount + 1,
    })),

  resetSession: () =>
    set({
      sessionStartTime: new Date(),
      promptCount: 0,
    }),
}));

// Hot metrics store - updates frequently from telemetry events
export const useSessionLiveMetricsStore = create<SessionLiveMetricsStore>(
  (set) => ({
    metrics: uiTelemetryService.getMetrics(),
    lastPromptTokenCount: uiTelemetryService.getLastPromptTokenCount(),

    updateMetrics: (metrics: SessionMetrics, lastPromptTokenCount: number) =>
      set({ metrics, lastPromptTokenCount }),
  }),
);

// Combined state selector for components that need everything
export interface CombinedSessionState {
  sessionStartTime: Date;
  promptCount: number;
  metrics: SessionMetrics;
  lastPromptTokenCount: number;
}

export const useCombinedSessionState = (): CombinedSessionState => {
  const { sessionStartTime, promptCount } = useSessionMetaStore();
  const { metrics, lastPromptTokenCount } = useSessionLiveMetricsStore();

  return {
    sessionStartTime,
    promptCount,
    metrics,
    lastPromptTokenCount,
  };
};

// TTY detection helper
const isTTY = (): boolean => process.stdout.isTTY === true;

// Initialize telemetry listener with TTY guard
let telemetryListenerInitialized = false;

export const initializeTelemetryListener = (): void => {
  if (telemetryListenerInitialized || !isTTY()) {
    return;
  }

  const updateLiveMetrics = useSessionLiveMetricsStore.getState().updateMetrics;

  const handleUpdate = ({
    metrics,
    lastPromptTokenCount,
  }: {
    metrics: SessionMetrics;
    lastPromptTokenCount: number;
  }) => {
    updateLiveMetrics(metrics, lastPromptTokenCount);
  };

  uiTelemetryService.on('update', handleUpdate);

  // Set initial state
  handleUpdate({
    metrics: uiTelemetryService.getMetrics(),
    lastPromptTokenCount: uiTelemetryService.getLastPromptTokenCount(),
  });

  telemetryListenerInitialized = true;
};

export const cleanupTelemetryListener = (): void => {
  if (!telemetryListenerInitialized) {
    return;
  }

  uiTelemetryService.removeAllListeners('update');
  telemetryListenerInitialized = false;
};
