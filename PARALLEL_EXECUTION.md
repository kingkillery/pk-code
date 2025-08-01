# Parallel Task Execution Feature

This document describes the parallel task execution feature implemented for the PK Code CLI.

## Overview

The parallel execution feature allows users to run multiple prompts simultaneously, significantly improving productivity when working with multiple related tasks or when batch processing is needed.

## Implementation

### Files Modified/Created

1. **`packages/cli/src/config/config.ts`**
   - Added `parallel` and `parallelTasks` options to `CliArgs` interface
   - Added command-line argument parsing for `--parallel` and `--parallel-tasks`

2. **`packages/cli/src/commands/parallel.ts`** (New)
   - `ParallelTaskExecutor` class for managing concurrent task execution
   - Concurrency control with configurable limits
   - Real-time progress tracking and output capture
   - Comprehensive error handling and cleanup

3. **`packages/cli/src/gemini.tsx`**
   - Added import for `handleParallelCommand`
   - Integrated parallel command handling in the main CLI flow

### Key Features

#### 1. Concurrency Control
- Configurable maximum number of parallel tasks
- Semaphore-based task scheduling
- Prevents system overload while maximizing throughput

#### 2. Process Management
- Each task spawns a separate `pk` process
- Isolated execution environments
- Proper cleanup on termination or errors

#### 3. Output Management
- Real-time progress tracking
- Separate output files for each task
- Comprehensive execution summary

#### 4. Error Handling
- Individual task failure doesn't affect others
- Detailed error reporting
- Graceful cleanup on interruption

## Usage

### Basic Usage

```bash
# Execute multiple prompts in parallel
pk --parallel "Create a React component,Write Python tests,Generate documentation"
```

### With Concurrency Control

```bash
# Limit to 2 parallel tasks
pk --parallel "task1,task2,task3,task4" --parallel-tasks 2
```

### Command Line Options

- `--parallel <prompts>`: Comma-separated list of prompts to execute in parallel
- `--parallel-tasks <number>`: Maximum number of tasks to run concurrently (default: number of prompts)

## Architecture

### ParallelTaskExecutor Class

```typescript
class ParallelTaskExecutor {
  private tasks: ParallelTaskConfig[];
  private maxConcurrency: number;
  private results: Map<string, ParallelTaskResult>;
  private tempDir: string;
  
  async execute(): Promise<ParallelTaskResult[]>
  private async executeTask(task: ParallelTaskConfig): Promise<void>
  private printSummary(results: ParallelTaskResult[]): void
  private cleanup(): Promise<void>
}
```

### Task Configuration

```typescript
interface ParallelTaskConfig {
  id: string;
  prompt: string;
  outputFile: string;
}
```

### Task Results

```typescript
interface ParallelTaskResult {
  id: string;
  prompt: string;
  status: 'success' | 'error';
  duration?: number;
  output?: string;
  error?: string;
}
```

## Implementation Details

### Process Spawning

Each task spawns a new `pk` process with:
- Isolated working directory
- Environment variables for task identification
- Redirected stdout/stderr to separate files
- Proper signal handling for cleanup

### Concurrency Management

The executor uses a semaphore pattern to control concurrency:
1. Tasks wait for available execution slots
2. Maximum concurrency is configurable
3. Completed tasks release their slots for waiting tasks

### Output Handling

- Each task writes to a separate output file
- Real-time progress updates to console
- Final summary with success/failure statistics
- Cleanup of temporary files after execution

## Benefits

1. **Improved Productivity**: Execute multiple related tasks simultaneously
2. **Resource Optimization**: Configurable concurrency prevents system overload
3. **Isolation**: Each task runs in its own process, preventing interference
4. **Monitoring**: Real-time progress tracking and comprehensive reporting
5. **Reliability**: Robust error handling and cleanup mechanisms

## Example Output

```
🚀 Starting 5 parallel tasks...

📝 [task-1] Starting: "Create a simple React component"
📝 [task-2] Starting: "Write a Python function to sort arrays"
📝 [task-3] Starting: "Generate a README file for a project"
✅ [task-1] Completed in 1136ms
📝 [task-4] Starting: "Fix a JavaScript bug in authentication"
✅ [task-3] Completed in 1426ms
📝 [task-5] Starting: "Optimize database queries"
✅ [task-2] Completed in 1628ms
✅ [task-5] Completed in 1476ms
✅ [task-4] Completed in 2699ms

📊 Parallel Execution Summary:
==================================================
✅ Successful: 5
❌ Failed: 0
📈 Total: 5
⏱️  Average Duration: 1673ms

✨ Parallel execution completed!
```

## Future Enhancements

1. **Task Dependencies**: Support for task dependency graphs
2. **Progress Bars**: Visual progress indicators for long-running tasks
3. **Result Aggregation**: Combine outputs from related tasks
4. **Retry Logic**: Automatic retry for failed tasks
5. **Load Balancing**: Dynamic concurrency adjustment based on system resources

## Testing

A test script (`test-parallel.js`) demonstrates the functionality:

```bash
node test-parallel.js
```

This script simulates the parallel execution without requiring a full build, showing the concurrency control and output formatting in action.

## Notes

- The feature is designed to work with the existing PK Code CLI architecture
- Minimal changes to existing code ensure compatibility
- The implementation follows TypeScript best practices
- Proper error handling ensures system stability
- The feature can be extended for more complex use cases