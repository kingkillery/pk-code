/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
} from 'react';
import {
  useSessionMetaStore,
  useSessionLiveMetricsStore,
  useCombinedSessionState,
  initializeTelemetryListener,
  cleanupTelemetryListener,
} from '../stores/sessionMetricsStore.js';
import { SessionMetrics, ModelMetrics } from '@qwen-code/qwen-code-core';

// Re-export types for backward compatibility
export type { SessionMetrics, ModelMetrics };

// Computed stats interface (same as before)
export interface ComputedSessionStats {
  totalApiTime: number;
  totalToolTime: number;
  agentActiveTime: number;
  apiTimePercent: number;
  toolTimePercent: number;
  cacheEfficiency: number;
  totalDecisions: number;
  successRate: number;
  agreementRate: number;
  totalCachedTokens: number;
  totalPromptTokens: number;
}

// Legacy interface for backward compatibility
export interface SessionStatsState {
  sessionStartTime: Date;
  metrics: SessionMetrics;
  lastPromptTokenCount: number;
  promptCount: number;
}

// Context value interface
interface OptimizedSessionStatsContextValue {
  stats: SessionStatsState;
  startNewPrompt: () => void;
  getPromptCount: () => number;
}

// Context definition
const OptimizedSessionStatsContext = createContext<OptimizedSessionStatsContextValue | undefined>(
  undefined,
);

// Provider component using split stores
export const OptimizedSessionStatsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Initialize telemetry listener on mount
  useEffect(() => {
    initializeTelemetryListener();
    return cleanupTelemetryListener;
  }, []);

  // Get combined state from both stores
  const combinedState = useCombinedSessionState();
  
  // Get actions from meta store
  const startNewPrompt = useSessionMetaStore((state) => state.startNewPrompt);
  const getPromptCount = useCallback(
    () => combinedState.promptCount,
    [combinedState.promptCount],
  );

  // Transform to legacy format for backward compatibility
  const stats: SessionStatsState = useMemo(
    () => ({
      sessionStartTime: combinedState.sessionStartTime,
      metrics: combinedState.metrics,
      lastPromptTokenCount: combinedState.lastPromptTokenCount,
      promptCount: combinedState.promptCount,
    }),
    [combinedState],
  );

  const value = useMemo(
    () => ({
      stats,
      startNewPrompt,
      getPromptCount,
    }),
    [stats, startNewPrompt, getPromptCount],
  );

  return (
    <OptimizedSessionStatsContext.Provider value={value}>
      {children}
    </OptimizedSessionStatsContext.Provider>
  );
};

// Consumer hook
export const useOptimizedSessionStats = () => {
  const context = useContext(OptimizedSessionStatsContext);
  if (context === undefined) {
    throw new Error(
      'useOptimizedSessionStats must be used within an OptimizedSessionStatsProvider',
    );
  }
  return context;
};

// Selector-based hooks for fine-grained subscriptions
export const useSessionMeta = () => useSessionMetaStore((state) => ({
    sessionStartTime: state.sessionStartTime,
    promptCount: state.promptCount,
  }));

export const useSessionMetrics = () => useSessionLiveMetricsStore((state) => state.metrics);

export const useLastPromptTokenCount = () => useSessionLiveMetricsStore((state) => state.lastPromptTokenCount);

export const usePromptCount = () => useSessionMetaStore((state) => state.promptCount);

export const useStartNewPrompt = () => useSessionMetaStore((state) => state.startNewPrompt);

// Lightweight provider that only initializes telemetry without React context
export const TelemetryInitializer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    initializeTelemetryListener();
    return cleanupTelemetryListener;
  }, []);

  return <>{children}</>;
};
