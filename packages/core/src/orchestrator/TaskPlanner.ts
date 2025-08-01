/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentRegistry, ParsedAgent } from '../agents/types.js';

/**
 * Task definition in the dependency graph
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Human-readable task title */
  title: string;
  /** Detailed task description/prompt */
  description: string;
  /** Task dependencies (other task IDs that must complete first) */
  dependencies: string[];
  /** Estimated effort/complexity (1-10 scale) */
  effort?: number;
  /** Task category for agent matching */
  category?: string;
  /** Specific requirements or constraints */
  requirements?: string[];
  /** Expected outputs/artifacts */
  expectedOutputs?: string[];
}

/**
 * Task execution status
 */
export type TaskStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'blocked';

/**
 * Task with runtime status information
 */
export interface TaskWithStatus extends Task {
  status: TaskStatus;
  assignedAgent?: string;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  artifacts?: string[];
}

/**
 * Task dependency graph
 */
export interface TaskDAG {
  /** Map of task ID to task definition */
  tasks: Map<string, TaskWithStatus>;
  /** Adjacency list for dependencies */
  dependencies: Map<string, string[]>;
  /** Reverse adjacency list for dependents */
  dependents: Map<string, string[]>;
  /** Original user query */
  originalQuery: string;
  /** Task decomposition strategy used */
  strategy: string;
}

/**
 * Task decomposition request
 */
export interface DecompositionRequest {
  /** User's high-level request/query */
  query: string;
  /** Available agents for task assignment consideration */
  availableAgents: ParsedAgent[];
  /** Project context information */
  context?: {
    projectType?: string;
    technologies?: string[];
    constraints?: string[];
  };
  /** Decomposition preferences */
  preferences?: {
    maxTasks?: number;
    parallelismPreference?: 'high' | 'medium' | 'low';
    detailLevel?: 'high' | 'medium' | 'low';
  };
}

/**
 * Task decomposition result
 */
export interface DecompositionResult {
  /** Generated task DAG */
  dag: TaskDAG;
  /** Decomposition confidence (0-1) */
  confidence: number;
  /** Reasoning for the decomposition */
  reasoning: string;
  /** Estimated total duration */
  estimatedDuration?: number;
  /** Critical path through the DAG */
  criticalPath?: string[];
}

/**
 * Task planner that decomposes user requests into dependency graphs
 */
export class TaskPlanner {
  constructor(private readonly registry: AgentRegistry) {}

  /**
   * Decompose a user query into a DAG of tasks
   */
  async decomposeQuery(request: DecompositionRequest): Promise<DecompositionResult> {
    const { query, availableAgents, context, preferences } = request;

    // Analyze query complexity and determine decomposition strategy
    const strategy = this.determineDecompositionStrategy(query, context);

    let tasks: Task[];
    let reasoning: string;
    let confidence: number;

    switch (strategy) {
      case 'mvp-development':
        ({ tasks, reasoning, confidence } = this.decomposeMVPDevelopment(query, context));
        break;
      case 'analysis-task':
        ({ tasks, reasoning, confidence } = this.decomposeAnalysisTask(query, context));
        break;
      case 'refactoring-task':
        ({ tasks, reasoning, confidence } = this.decomposeRefactoringTask(query, context));
        break;
      case 'feature-development':
        ({ tasks, reasoning, confidence } = this.decomposeFeatureDevelopment(query, context));
        break;
      default:
        ({ tasks, reasoning, confidence } = this.decomposeGenericTask(query, context));
    }

    // Apply preferences to adjust task granularity
    if (preferences?.maxTasks && tasks.length > preferences.maxTasks) {
      tasks = this.consolidateTasks(tasks, preferences.maxTasks);
    }

    // Build DAG
    const dag = this.buildDAG(tasks, query, strategy);

    // Calculate critical path and estimated duration
    const criticalPath = this.calculateCriticalPath(dag);
    const estimatedDuration = this.estimateProjectDuration(dag);

    return {
      dag,
      confidence,
      reasoning,
      estimatedDuration,
      criticalPath,
    };
  }

  /**
   * Determine the best decomposition strategy based on query analysis
   */
  private determineDecompositionStrategy(query: string, context?: DecompositionRequest['context']): string {
    const queryLower = query.toLowerCase();

    // MVP/Application development patterns
    if (queryLower.includes('mvp') || queryLower.includes('build') && (queryLower.includes('app') || queryLower.includes('application'))) {
      return 'mvp-development';
    }

    // Analysis patterns
    if (queryLower.includes('analyze') || queryLower.includes('review') || queryLower.includes('audit')) {
      return 'analysis-task';
    }

    // Refactoring patterns
    if (queryLower.includes('refactor') || queryLower.includes('restructure') || queryLower.includes('modernize')) {
      return 'refactoring-task';
    }

    // Feature development patterns
    if (queryLower.includes('add') || queryLower.includes('implement') || queryLower.includes('create')) {
      return 'feature-development';
    }

    return 'generic';
  }

  /**
   * Decompose MVP development requests
   */
  private decomposeMVPDevelopment(query: string, context?: DecompositionRequest['context']): {
    tasks: Task[];
    reasoning: string;
    confidence: number;
  } {
    const tasks: Task[] = [
      {
        id: 'requirements-analysis',
        title: 'Requirements Analysis',
        description: 'Analyze requirements and define project scope based on: ' + query,
        dependencies: [],
        category: 'analysis',
        effort: 3,
        expectedOutputs: ['requirements.md', 'project-scope.md']
      },
      {
        id: 'architecture-design',
        title: 'System Architecture Design',
        description: 'Design overall system architecture and technology stack',
        dependencies: ['requirements-analysis'],
        category: 'architecture',
        effort: 5,
        expectedOutputs: ['architecture.md', 'tech-stack.md']
      },
      {
        id: 'database-schema',
        title: 'Database Schema Design',
        description: 'Design database schema and data models',
        dependencies: ['architecture-design'],
        category: 'database',
        effort: 4,
        expectedOutputs: ['schema.sql', 'data-models.md']
      },
      {
        id: 'api-design',
        title: 'API Design',
        description: 'Design REST API endpoints and data contracts',
        dependencies: ['database-schema'],
        category: 'backend',
        effort: 4,
        expectedOutputs: ['api-spec.yaml', 'endpoints.md']
      },
      {
        id: 'backend-implementation',
        title: 'Backend Implementation',
        description: 'Implement core backend services and API',
        dependencies: ['api-design'],
        category: 'backend',
        effort: 8,
        expectedOutputs: ['backend-code', 'api-implementation']
      },
      {
        id: 'frontend-setup',
        title: 'Frontend Project Setup',
        description: 'Set up frontend project structure and dependencies',
        dependencies: ['architecture-design'],
        category: 'frontend',
        effort: 3,
        expectedOutputs: ['frontend-scaffold', 'build-config']
      },
      {
        id: 'ui-components',
        title: 'UI Components Development',
        description: 'Develop reusable UI components',
        dependencies: ['frontend-setup'],
        category: 'frontend',
        effort: 6,
        expectedOutputs: ['component-library', 'ui-components']
      },
      {
        id: 'frontend-integration',
        title: 'Frontend-Backend Integration',
        description: 'Connect frontend with backend APIs',
        dependencies: ['backend-implementation', 'ui-components'],
        category: 'integration',
        effort: 5,
        expectedOutputs: ['integrated-application']
      },
      {
        id: 'testing',
        title: 'Testing Implementation',
        description: 'Implement unit tests, integration tests, and end-to-end tests',
        dependencies: ['frontend-integration'],
        category: 'testing',
        effort: 6,
        expectedOutputs: ['test-suite', 'test-coverage-report']
      },
      {
        id: 'deployment',
        title: 'Deployment Setup',
        description: 'Set up deployment pipeline and production environment',
        dependencies: ['testing'],
        category: 'devops',
        effort: 4,
        expectedOutputs: ['deployment-config', 'production-setup']
      }
    ];

    const reasoning = `Decomposed MVP development into standard software development lifecycle phases: 
    requirements → architecture → database → API → implementation → testing → deployment. 
    This follows proven patterns for building scalable applications with proper separation of concerns.`;

    return { tasks, reasoning, confidence: 0.9 };
  }

  /**
   * Decompose analysis tasks
   */
  private decomposeAnalysisTask(query: string, context?: DecompositionRequest['context']): {
    tasks: Task[];
    reasoning: string;
    confidence: number;
  } {
    const tasks: Task[] = [
      {
        id: 'scope-definition',
        title: 'Define Analysis Scope',
        description: 'Define what needs to be analyzed based on: ' + query,
        dependencies: [],
        category: 'analysis',
        effort: 2,
        expectedOutputs: ['analysis-scope.md']
      },
      {
        id: 'data-collection',
        title: 'Data Collection',
        description: 'Gather relevant code, documentation, and metrics',
        dependencies: ['scope-definition'],
        category: 'analysis',
        effort: 4,
        expectedOutputs: ['collected-data', 'metrics-snapshot']
      },
      {
        id: 'static-analysis',
        title: 'Static Code Analysis',
        description: 'Perform static analysis of codebase',
        dependencies: ['data-collection'],
        category: 'analysis',
        effort: 5,
        expectedOutputs: ['static-analysis-report']
      },
      {
        id: 'pattern-analysis',
        title: 'Pattern and Architecture Analysis',
        description: 'Analyze architectural patterns and design decisions',
        dependencies: ['static-analysis'],
        category: 'analysis',
        effort: 6,
        expectedOutputs: ['architecture-analysis', 'pattern-report']
      },
      {
        id: 'findings-synthesis',
        title: 'Findings Synthesis',
        description: 'Synthesize analysis results and generate recommendations',
        dependencies: ['pattern-analysis'],
        category: 'analysis',
        effort: 4,
        expectedOutputs: ['final-analysis-report', 'recommendations.md']
      }
    ];

    const reasoning = `Decomposed analysis task into systematic analysis phases: 
    scope definition → data collection → static analysis → pattern analysis → synthesis. 
    This ensures comprehensive coverage and actionable insights.`;

    return { tasks, reasoning, confidence: 0.85 };
  }

  /**
   * Decompose refactoring tasks
   */
  private decomposeRefactoringTask(query: string, context?: DecompositionRequest['context']): {
    tasks: Task[];
    reasoning: string;
    confidence: number;
  } {
    const tasks: Task[] = [
      {
        id: 'current-state-analysis',
        title: 'Current State Analysis',
        description: 'Analyze current codebase and identify refactoring targets: ' + query,
        dependencies: [],
        category: 'analysis',
        effort: 4,
        expectedOutputs: ['current-state-report', 'refactoring-targets']
      },
      {
        id: 'refactoring-plan',
        title: 'Refactoring Strategy & Plan',
        description: 'Create detailed refactoring plan with phases and safety measures',
        dependencies: ['current-state-analysis'],
        category: 'planning',
        effort: 3,
        expectedOutputs: ['refactoring-plan.md', 'safety-checklist']
      },
      {
        id: 'test-coverage',
        title: 'Test Coverage Enhancement',
        description: 'Improve test coverage before refactoring to ensure safety',
        dependencies: ['refactoring-plan'],
        category: 'testing',
        effort: 5,
        expectedOutputs: ['enhanced-test-suite', 'coverage-report']
      },
      {
        id: 'incremental-refactoring',
        title: 'Incremental Refactoring',
        description: 'Perform refactoring in small, safe increments',
        dependencies: ['test-coverage'],
        category: 'refactoring',
        effort: 8,
        expectedOutputs: ['refactored-code', 'migration-log']
      },
      {
        id: 'validation-testing',
        title: 'Validation & Testing',
        description: 'Validate refactored code maintains functionality',
        dependencies: ['incremental-refactoring'],
        category: 'testing',
        effort: 4,
        expectedOutputs: ['validation-report', 'regression-test-results']
      }
    ];

    const reasoning = `Decomposed refactoring into safe, incremental phases: 
    analysis → planning → test enhancement → incremental refactoring → validation. 
    This minimizes risk while ensuring code quality improvements.`;

    return { tasks, reasoning, confidence: 0.88 };
  }

  /**
   * Decompose feature development tasks
   */
  private decomposeFeatureDevelopment(query: string, context?: DecompositionRequest['context']): {
    tasks: Task[];
    reasoning: string;
    confidence: number;
  } {
    const tasks: Task[] = [
      {
        id: 'feature-specification',
        title: 'Feature Specification',
        description: 'Define detailed feature requirements and acceptance criteria: ' + query,
        dependencies: [],
        category: 'analysis',
        effort: 3,
        expectedOutputs: ['feature-spec.md', 'acceptance-criteria']
      },
      {
        id: 'technical-design',
        title: 'Technical Design',
        description: 'Design technical implementation approach',
        dependencies: ['feature-specification'],
        category: 'design',
        effort: 4,
        expectedOutputs: ['technical-design.md', 'interface-definitions']
      },
      {
        id: 'implementation',
        title: 'Feature Implementation',
        description: 'Implement the feature according to technical design',
        dependencies: ['technical-design'],
        category: 'implementation',
        effort: 7,
        expectedOutputs: ['feature-code', 'updated-apis']
      },
      {
        id: 'testing',
        title: 'Feature Testing',
        description: 'Implement comprehensive tests for the new feature',
        dependencies: ['implementation'],
        category: 'testing',
        effort: 4,
        expectedOutputs: ['test-suite', 'test-documentation']
      },
      {
        id: 'integration',
        title: 'Integration & Documentation',
        description: 'Integrate feature with existing system and update documentation',
        dependencies: ['testing'],
        category: 'integration',
        effort: 3,
        expectedOutputs: ['integrated-feature', 'updated-docs']
      }
    ];

    const reasoning = `Decomposed feature development into standard development phases: 
    specification → technical design → implementation → testing → integration. 
    This ensures the feature is well-defined, properly implemented, and fully integrated.`;

    return { tasks, reasoning, confidence: 0.87 };
  }

  /**
   * Decompose generic tasks
   */
  private decomposeGenericTask(query: string, context?: DecompositionRequest['context']): {
    tasks: Task[];
    reasoning: string;
    confidence: number;
  } {
    const tasks: Task[] = [
      {
        id: 'task-analysis',
        title: 'Task Analysis',
        description: 'Analyze and break down the request: ' + query,
        dependencies: [],
        category: 'analysis',
        effort: 2,
        expectedOutputs: ['task-breakdown.md']
      },
      {
        id: 'approach-design',
        title: 'Approach Design',
        description: 'Design approach and methodology for completing the task',
        dependencies: ['task-analysis'],
        category: 'planning',
        effort: 3,
        expectedOutputs: ['approach-plan.md']
      },
      {
        id: 'implementation',
        title: 'Implementation',
        description: 'Execute the planned approach',
        dependencies: ['approach-design'],
        category: 'implementation',
        effort: 6,
        expectedOutputs: ['deliverables']
      },
      {
        id: 'review-refinement',
        title: 'Review & Refinement',
        description: 'Review results and make necessary refinements',
        dependencies: ['implementation'],
        category: 'review',
        effort: 2,
        expectedOutputs: ['final-deliverables', 'review-notes']
      }
    ];

    const reasoning = `Decomposed generic task into basic phases: 
    analysis → approach design → implementation → review. 
    This provides a structured approach for any type of request.`;

    return { tasks, reasoning, confidence: 0.6 };
  }

  /**
   * Consolidate tasks to meet maximum task constraints
   */
  private consolidateTasks(tasks: Task[], maxTasks: number): Task[] {
    if (tasks.length <= maxTasks) return tasks;

    // Simple consolidation strategy: merge sequential tasks with similar categories
    const consolidated: Task[] = [];
    let currentGroup: Task[] = [];
    let currentCategory = '';

    for (const task of tasks) {
      if (task.category === currentCategory && consolidated.length < maxTasks - 1) {
        currentGroup.push(task);
      } else {
        if (currentGroup.length > 0) {
          consolidated.push(this.mergeTaskGroup(currentGroup));
        }
        currentGroup = [task];
        currentCategory = task.category || '';
      }
    }

    if (currentGroup.length > 0) {
      consolidated.push(this.mergeTaskGroup(currentGroup));
    }

    return consolidated.slice(0, maxTasks);
  }

  /**
   * Merge a group of related tasks
   */
  private mergeTaskGroup(tasks: Task[]): Task {
    if (tasks.length === 1) return tasks[0];

    const allDependencies = Array.from(new Set(tasks.flatMap(t => t.dependencies)));
    const mergedTask: Task = {
      id: tasks.map(t => t.id).join('-'),
      title: `${tasks[0].category || 'Combined'} Phase`,
      description: tasks.map(t => `${t.title}: ${t.description}`).join('\n\n'),
      dependencies: allDependencies.filter(dep => !tasks.some(t => t.id === dep)),
      category: tasks[0].category,
      effort: Math.max(1, Math.floor(tasks.reduce((sum, t) => sum + (t.effort || 1), 0) * 0.8)), // 20% efficiency gain from consolidation
      expectedOutputs: tasks.flatMap(t => t.expectedOutputs || [])
    };

    return mergedTask;
  }

  /**
   * Build DAG from task list
   */
  private buildDAG(tasks: Task[], originalQuery: string, strategy: string): TaskDAG {
    const taskMap = new Map<string, TaskWithStatus>();
    const dependencies = new Map<string, string[]>();
    const dependents = new Map<string, string[]>();

    // Initialize all tasks with pending status
    for (const task of tasks) {
      taskMap.set(task.id, {
        ...task,
        status: task.dependencies.length === 0 ? 'ready' : 'pending'
      });
      dependencies.set(task.id, [...task.dependencies]);
      dependents.set(task.id, []);
    }

    // Build dependents map
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const deps = dependents.get(depId) || [];
        deps.push(task.id);
        dependents.set(depId, deps);
      }
    }

    return {
      tasks: taskMap,
      dependencies,
      dependents,
      originalQuery,
      strategy
    };
  }

  /**
   * Calculate critical path through the DAG
   */
  private calculateCriticalPath(dag: TaskDAG): string[] {
    const { tasks, dependencies } = dag;
    const visited = new Set<string>();
    const path: string[] = [];
    const taskEfforts = new Map<string, number>();

    // Calculate task efforts with dependency chains
    const calculateEffort = (taskId: string): number => {
      if (taskEfforts.has(taskId)) {
        return taskEfforts.get(taskId)!;
      }

      const task = tasks.get(taskId);
      if (!task) return 0;

      const deps = dependencies.get(taskId) || [];
      const maxDepEffort = deps.length > 0 
        ? Math.max(...deps.map(depId => calculateEffort(depId)))
        : 0;

      const totalEffort = (task.effort || 1) + maxDepEffort;
      taskEfforts.set(taskId, totalEffort);
      return totalEffort;
    };

    // Calculate efforts for all tasks
    for (const [taskId] of tasks) {
      calculateEffort(taskId);
    }

    // Find the task with maximum total effort (end of critical path)
    let maxEffort = 0;
    let criticalEndTask = '';
    for (const [taskId, effort] of taskEfforts) {
      if (effort > maxEffort) {
        maxEffort = effort;
        criticalEndTask = taskId;
      }
    }

    // Trace back the critical path
    const tracePath = (taskId: string): void => {
      if (visited.has(taskId)) return;
      
      visited.add(taskId);
      const deps = dependencies.get(taskId) || [];
      
      if (deps.length > 0) {
        // Find the dependency with maximum effort
        let maxDepEffort = 0;
        let criticalDep = '';
        
        for (const depId of deps) {
          const depEffort = taskEfforts.get(depId) || 0;
          if (depEffort > maxDepEffort) {
            maxDepEffort = depEffort;
            criticalDep = depId;
          }
        }
        
        if (criticalDep) {
          tracePath(criticalDep);
        }
      }
      
      path.push(taskId);
    };

    if (criticalEndTask) {
      tracePath(criticalEndTask);
    }

    return path;
  }

  /**
   * Estimate total project duration
   */
  private estimateProjectDuration(dag: TaskDAG): number {
    const { tasks } = dag;
    const criticalPath = this.calculateCriticalPath(dag);
    
    // Sum efforts along critical path
    return criticalPath.reduce((total, taskId) => {
      const task = tasks.get(taskId);
      return total + (task?.effort || 1);
    }, 0);
  }

  /**
   * Get tasks that are ready to run (all dependencies completed)
   */
  getReadyTasks(dag: TaskDAG): TaskWithStatus[] {
    const readyTasks: TaskWithStatus[] = [];
    
    for (const [taskId, task] of dag.tasks) {
      if (task.status === 'ready') {
        readyTasks.push(task);
      } else if (task.status === 'pending') {
        // Check if all dependencies are completed
        const deps = dag.dependencies.get(taskId) || [];
        const allDepsCompleted = deps.every(depId => {
          const depTask = dag.tasks.get(depId);
          return depTask?.status === 'completed';
        });
        
        if (allDepsCompleted) {
          task.status = 'ready';
          readyTasks.push(task);
        }
      }
    }
    
    return readyTasks;
  }

  /**
   * Mark task as completed and update dependent tasks
   */
  completeTask(dag: TaskDAG, taskId: string, artifacts?: string[]): void {
    const task = dag.tasks.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.endTime = new Date();
    if (artifacts) {
      task.artifacts = artifacts;
    }

    // Update dependent tasks
    const dependents = dag.dependents.get(taskId) || [];
    for (const dependentId of dependents) {
      const dependentTask = dag.tasks.get(dependentId);
      if (dependentTask && dependentTask.status === 'pending') {
        const deps = dag.dependencies.get(dependentId) || [];
        const allDepsCompleted = deps.every(depId => {
          const depTask = dag.tasks.get(depId);
          return depTask?.status === 'completed';
        });
        
        if (allDepsCompleted) {
          dependentTask.status = 'ready';
        }
      }
    }
  }

  /**
   * Mark task as failed and handle dependent tasks
   */
  failTask(dag: TaskDAG, taskId: string, error: string): void {
    const task = dag.tasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.error = error;
    task.endTime = new Date();

    // Mark dependent tasks as blocked
    const dependents = dag.dependents.get(taskId) || [];
    for (const dependentId of dependents) {
      const dependentTask = dag.tasks.get(dependentId);
      if (dependentTask && (dependentTask.status === 'pending' || dependentTask.status === 'ready')) {
        dependentTask.status = 'blocked';
      }
    }
  }
}
