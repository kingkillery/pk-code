import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { AgentRunner } from '../../agent/AgentRunner.js';

interface MultiAgentRunProps {
  runners: AgentRunner[];
}

export const MultiAgentRun: React.FC<MultiAgentRunProps> = ({ runners }) => {
  const [_, setRender] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRender(r => r + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column">
      {runners.map(runner => (
        <Box key={runner.agent.name} flexDirection="column" borderStyle="round" padding={1} marginBottom={1}>
          <Text color={(runner.agent as any).color || 'white'}>
            {runner.agent.name} - {runner.status}
          </Text>
          <Box marginLeft={2} flexDirection="column">
            <Text>{runner.latestOutput}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
