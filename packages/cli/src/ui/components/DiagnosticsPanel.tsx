/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import {
  getDoctorChecks,
  runDoctorChecks,
  type ConfigDoctorResult,
} from '@pk-code/core';

interface DiagnosticsPanelProps {
  onClose: () => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  onClose: _onClose,
}) => {
  const [results, setResults] = useState<ConfigDoctorResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function runDiagnostics() {
      try {
        const checks = getDoctorChecks();
        const diagnosticsResults = await runDoctorChecks(checks);
        setResults(diagnosticsResults);
      } catch (error) {
        console.error('Error running diagnostics:', error);
      } finally {
        setLoading(false);
      }
    }

    void runDiagnostics();
  }, []);

  const getStatusSymbol = (status: string) => {
    switch (status) {
      case 'ok':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return Colors.AccentGreen;
      case 'warning':
        return Colors.AccentYellow;
      case 'error':
        return Colors.AccentRed;
      default:
        return Colors.Foreground;
    }
  };

  const errorCount = results.filter((r) => r.status === 'error').length;
  const warningCount = results.filter((r) => r.status === 'warning').length;

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderColor={Colors.Gray}
      borderStyle="round"
      padding={1}
    >
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={Colors.Foreground}>
          System Diagnostics
        </Text>
        <Text color={Colors.Gray}>
          Press ESC to close | Run &apos;pk config doctor&apos; for detailed
          output
        </Text>
      </Box>

      {loading ? (
        <Box marginY={1}>
          <Text color={Colors.Foreground}>Running diagnostics...</Text>
        </Box>
      ) : (
        <>
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={Colors.Foreground}>
              Configuration Status:
            </Text>
            {results.map((result) => (
              <Box key={result.id} flexDirection="column" marginY={0.5}>
                <Text color={getStatusColor(result.status)}>
                  {getStatusSymbol(result.status)} {result.title}
                </Text>
                {result.message && (
                  <Text color={Colors.Gray}>   {result.message}</Text>
                )}
                {result.suggestion && (
                  <Text color={Colors.AccentPurple}>
                    {'   💡 '}
                    {result.suggestion}
                  </Text>
                )}
              </Box>
            ))}
          </Box>

          <Box flexDirection="column" marginTop={1}>
            <Text color={Colors.Foreground}>
              Summary: {errorCount} error(s), {warningCount} warning(s)
            </Text>
            {errorCount === 0 && warningCount === 0 && (
              <Text color={Colors.AccentGreen}>
                ✨ All systems operational!
              </Text>
            )}
          </Box>

          <Box marginTop={1}>
            <Text color={Colors.Gray}>
              For detailed provider recommendations, run: pk config recommend
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
};
