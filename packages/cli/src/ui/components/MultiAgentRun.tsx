import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { EnhancedAgentRunner as AgentRunner } from '../../agent/EnhancedAgentRunner.js';

interface MultiAgentRunProps {
  runners: AgentRunner[];
}

export const MultiAgentRun: React.FC<MultiAgentRunProps> = ({ runners }) => {
  const [_, setRender] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRender((r) => r + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column">
      {runners.map((runner) => {
        const status = runner.getStatus();
        return (
          <Box
            key={status.sessionId}
            flexDirection="column"
            borderStyle="round"
            padding={1}
            marginBottom={1}
          >
            <Text color="white">
              {runner.agent.name} - {status.status}
            </Text>
            <Box marginLeft={2} flexDirection="column">
              <Text>{status.output}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
