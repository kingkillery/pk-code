/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import { BaseTool, ToolResult, ToolResultDisplay } from './tools.js';
import { TodoTool, TodoItem, TodoQuery } from './todo-tool.js';
import { Config } from '../config/config.js';

/**
 * Tool wrapper for TodoTool that integrates with the PK Code tool system
 */

interface CreateTodoParams {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  tags?: string[];
  category?: string;
  assignee?: string;
  dependencies?: string[];
  estimatedHours?: number;
  global?: boolean;
}

interface UpdateTodoParams {
  id: string;
  title?: string;
  description?: string;
  status?: 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  tags?: string[];
  category?: string;
  assignee?: string;
  dependencies?: string[];
  estimatedHours?: number;
  actualHours?: number;
  global?: boolean;
}

interface QueryTodosParams {
  status?: Array<
    'pending' | 'in-progress' | 'completed' | 'cancelled' | 'blocked'
  >;
  priority?: Array<'low' | 'medium' | 'high' | 'critical'>;
  tags?: string[];
  assignee?: string;
  category?: string;
  dueBefore?: string;
  dueAfter?: string;
  createdBefore?: string;
  createdAfter?: string;
  project?: string;
  searchText?: string;
  global?: boolean;
  limit?: number;
}

interface DeleteTodoParams {
  id: string;
  global?: boolean;
}

interface AddSubtaskParams {
  parentId: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  tags?: string[];
  estimatedHours?: number;
  global?: boolean;
}

interface UpdateSubtaskParams {
  parentId: string;
  subtaskId: string;
  title?: string;
  description?: string;
  status?: 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  global?: boolean;
}

interface GetStatsParams {
  global?: boolean;
}

interface ExportTodosParams {
  outputPath: string;
  query?: QueryTodosParams;
  global?: boolean;
}

interface ImportTodosParams {
  inputPath: string;
  global?: boolean;
  merge?: boolean;
}

type TodoToolParams =
  | { action: 'create'; data: CreateTodoParams }
  | { action: 'update'; data: UpdateTodoParams }
  | { action: 'query'; data: QueryTodosParams }
  | { action: 'delete'; data: DeleteTodoParams }
  | { action: 'addSubtask'; data: AddSubtaskParams }
  | { action: 'updateSubtask'; data: UpdateSubtaskParams }
  | { action: 'getStats'; data: GetStatsParams }
  | { action: 'export'; data: ExportTodosParams }
  | { action: 'import'; data: ImportTodosParams };

export class TodoToolWrapper extends BaseTool<TodoToolParams, ToolResult> {
  private todoTool: TodoTool;

  constructor(private config: Config) {
    super(
      'todo',
      'Todo Manager',
      'Manage project and personal todo items with priorities, due dates, and dependencies',
      {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.STRING,
            enum: [
              'create',
              'update',
              'query',
              'delete',
              'addSubtask',
              'updateSubtask',
              'getStats',
              'export',
              'import',
            ],
            description: 'The action to perform on the todo system',
          },
          data: {
            type: Type.OBJECT,
            description: 'Data for the action',
            properties: {
              // Create todo properties
              title: { type: Type.STRING, description: 'Todo title' },
              description: {
                type: Type.STRING,
                description: 'Todo description',
              },
              priority: {
                type: Type.STRING,
                enum: ['low', 'medium', 'high', 'critical'],
                description: 'Todo priority level',
              },
              dueDate: {
                type: Type.STRING,
                description: 'Due date in ISO format',
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Tags for categorization',
              },
              category: { type: Type.STRING, description: 'Todo category' },
              assignee: {
                type: Type.STRING,
                description: 'Person assigned to the todo',
              },
              dependencies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'IDs of dependent todos',
              },
              estimatedHours: {
                type: Type.NUMBER,
                description: 'Estimated hours to complete',
              },
              actualHours: {
                type: Type.NUMBER,
                description: 'Actual hours spent',
              },
              global: {
                type: Type.BOOLEAN,
                description: 'Whether to operate on global todos',
              },

              // Query properties
              status: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                  enum: [
                    'pending',
                    'in-progress',
                    'completed',
                    'cancelled',
                    'blocked',
                  ],
                },
                description: 'Filter by status',
              },
              searchText: {
                type: Type.STRING,
                description: 'Search text in title/description/tags',
              },
              limit: {
                type: Type.NUMBER,
                description: 'Maximum number of results',
              },

              // IDs
              id: { type: Type.STRING, description: 'Todo ID' },
              parentId: {
                type: Type.STRING,
                description: 'Parent todo ID for subtasks',
              },
              subtaskId: { type: Type.STRING, description: 'Subtask ID' },

              // File paths
              outputPath: {
                type: Type.STRING,
                description: 'Output file path for export',
              },
              inputPath: {
                type: Type.STRING,
                description: 'Input file path for import',
              },

              // Import options
              merge: {
                type: Type.BOOLEAN,
                description: 'Merge on import instead of replace',
              },
            },
          },
        },
        required: ['action'],
      },
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );

    this.todoTool = new TodoTool();
  }

  validateToolParams(params: TodoToolParams): string | null {
    if (!params.action) {
      return 'Action is required';
    }

    switch (params.action) {
      case 'create':
        if (!params.data?.title) {
          return 'Title is required for creating todos';
        }
        break;
      case 'update':
      case 'delete':
        if (!params.data?.id) {
          return 'Todo ID is required';
        }
        break;
      case 'addSubtask':
      case 'updateSubtask':
        if (!params.data?.parentId) {
          return 'Parent ID is required for subtask operations';
        }
        if (params.action === 'updateSubtask' && !params.data?.subtaskId) {
          return 'Subtask ID is required for updating subtasks';
        }
        if (params.action === 'addSubtask' && !params.data?.title) {
          return 'Title is required for adding subtasks';
        }
        break;
      case 'export':
        if (!params.data?.outputPath) {
          return 'Output path is required for export';
        }
        break;
      case 'import':
        if (!params.data?.inputPath) {
          return 'Input path is required for import';
        }
        break;
      default:
        // Query operations and other actions don't require additional validation
        break;
    }

    return null;
  }

  getDescription(params: TodoToolParams): string {
    switch (params.action) {
      case 'create':
        return `Create a new todo item: "${params.data?.title}"`;
      case 'update':
        return `Update todo item ${params.data?.id}`;
      case 'query':
        return `Query todo items with filters`;
      case 'delete':
        return `Delete todo item ${params.data?.id}`;
      case 'addSubtask':
        return `Add subtask "${params.data?.title}" to todo ${params.data?.parentId}`;
      case 'updateSubtask':
        return `Update subtask ${params.data?.subtaskId} in todo ${params.data?.parentId}`;
      case 'getStats':
        return `Get todo statistics`;
      case 'export':
        return `Export todos to ${params.data?.outputPath}`;
      case 'import':
        return `Import todos from ${params.data?.inputPath}`;
      default:
        return 'Perform todo management operation';
    }
  }

  async execute(params: TodoToolParams): Promise<ToolResult> {
    try {
      let result: any;

      switch (params.action) {
        case 'create':
          result = await this.executeCreate(params.data as CreateTodoParams);
          break;
        case 'update':
          result = await this.executeUpdate(params.data as UpdateTodoParams);
          break;
        case 'query':
          result = await this.executeQuery(params.data as QueryTodosParams);
          break;
        case 'delete':
          result = await this.executeDelete(params.data as DeleteTodoParams);
          break;
        case 'addSubtask':
          result = await this.executeAddSubtask(
            params.data as AddSubtaskParams,
          );
          break;
        case 'updateSubtask':
          result = await this.executeUpdateSubtask(
            params.data as UpdateSubtaskParams,
          );
          break;
        case 'getStats':
          result = await this.executeGetStats(params.data as GetStatsParams);
          break;
        case 'export':
          result = await this.executeExport(params.data as ExportTodosParams);
          break;
        case 'import':
          result = await this.executeImport(params.data as ImportTodosParams);
          break;
        default:
          throw new Error(`Unknown action: ${(params as any).action}`);
      }

      return {
        summary: this.getExecutionSummary(params, result),
        llmContent: [{ text: JSON.stringify(result, null, 2) }],
        returnDisplay: this.formatResultDisplay(params.action, result),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        summary: `Todo operation failed: ${errorMessage}`,
        llmContent: [{ text: `Error: ${errorMessage}` }],
        returnDisplay: `❌ Error: ${errorMessage}`,
      };
    }
  }

  private async executeCreate(data: CreateTodoParams): Promise<TodoItem> {
    const dueDate = data.dueDate ? new Date(data.dueDate) : undefined;

    return await this.todoTool.createTodo(data.title, {
      description: data.description,
      priority: data.priority,
      dueDate,
      tags: data.tags,
      category: data.category,
      assignee: data.assignee,
      dependencies: data.dependencies,
      estimatedHours: data.estimatedHours,
      global: data.global,
    });
  }

  private async executeUpdate(
    data: UpdateTodoParams,
  ): Promise<TodoItem | null> {
    const dueDate = data.dueDate ? new Date(data.dueDate) : undefined;

    return await this.todoTool.updateTodo(
      data.id,
      {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        dueDate,
        tags: data.tags,
        category: data.category,
        assignee: data.assignee,
        dependencies: data.dependencies,
        estimatedHours: data.estimatedHours,
        actualHours: data.actualHours,
      },
      data.global || false,
    );
  }

  private async executeQuery(data: QueryTodosParams): Promise<TodoItem[]> {
    const query: TodoQuery = {
      status: data.status,
      priority: data.priority,
      tags: data.tags,
      assignee: data.assignee,
      category: data.category,
      dueBefore: data.dueBefore ? new Date(data.dueBefore) : undefined,
      dueAfter: data.dueAfter ? new Date(data.dueAfter) : undefined,
      createdBefore: data.createdBefore
        ? new Date(data.createdBefore)
        : undefined,
      createdAfter: data.createdAfter ? new Date(data.createdAfter) : undefined,
      project: data.project,
      searchText: data.searchText,
    };

    return await this.todoTool.queryTodos(query, data.global || false);
  }

  private async executeDelete(data: DeleteTodoParams): Promise<boolean> {
    return await this.todoTool.deleteTodo(data.id, data.global || false);
  }

  private async executeAddSubtask(
    data: AddSubtaskParams,
  ): Promise<TodoItem | null> {
    const dueDate = data.dueDate ? new Date(data.dueDate) : undefined;

    return await this.todoTool.addSubtask(
      data.parentId,
      data.title,
      {
        description: data.description,
        priority: data.priority,
        dueDate,
        tags: data.tags,
        estimatedHours: data.estimatedHours,
      },
      data.global || false,
    );
  }

  private async executeUpdateSubtask(
    data: UpdateSubtaskParams,
  ): Promise<boolean> {
    const dueDate = data.dueDate ? new Date(data.dueDate) : undefined;

    return await this.todoTool.updateSubtask(
      data.parentId,
      data.subtaskId,
      {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        dueDate,
        tags: data.tags,
        estimatedHours: data.estimatedHours,
        actualHours: data.actualHours,
      },
      data.global || false,
    );
  }

  private async executeGetStats(data: GetStatsParams): Promise<any> {
    return await this.todoTool.getStats(data.global || false);
  }

  private async executeExport(data: ExportTodosParams): Promise<string> {
    const query = data.query
      ? {
          status: data.query.status,
          priority: data.query.priority,
          tags: data.query.tags,
          assignee: data.query.assignee,
          category: data.query.category,
          dueBefore: data.query.dueBefore
            ? new Date(data.query.dueBefore)
            : undefined,
          dueAfter: data.query.dueAfter
            ? new Date(data.query.dueAfter)
            : undefined,
          createdBefore: data.query.createdBefore
            ? new Date(data.query.createdBefore)
            : undefined,
          createdAfter: data.query.createdAfter
            ? new Date(data.query.createdAfter)
            : undefined,
          project: data.query.project,
          searchText: data.query.searchText,
        }
      : undefined;

    await this.todoTool.exportTodos(
      data.outputPath,
      query,
      data.global || false,
    );
    return `Todos exported to ${data.outputPath}`;
  }

  private async executeImport(data: ImportTodosParams): Promise<number> {
    return await this.todoTool.importTodos(
      data.inputPath,
      data.global || false,
      data.merge || false,
    );
  }

  private getExecutionSummary(params: TodoToolParams, result: any): string {
    switch (params.action) {
      case 'create':
        return `Created todo: ${(result as TodoItem).title}`;
      case 'update':
        return `Updated todo: ${(result as TodoItem)?.title || params.data?.id}`;
      case 'query':
        return `Found ${(result as TodoItem[]).length} todos`;
      case 'delete':
        return `Deleted todo: ${result ? 'success' : 'not found'}`;
      case 'addSubtask':
        return `Added subtask: ${(result as TodoItem)?.title || 'unknown'}`;
      case 'updateSubtask':
        return `Updated subtask: ${result ? 'success' : 'failed'}`;
      case 'getStats':
        return `Retrieved todo statistics`;
      case 'export':
        return `Exported todos`;
      case 'import':
        return `Imported ${result} todos`;
      default:
        return 'Todo operation completed';
    }
  }

  private formatResultDisplay(action: string, result: any): ToolResultDisplay {
    switch (action) {
      case 'create':
      case 'update': {
        const todo = result as TodoItem;
        return `📝 **${todo.title}**
Status: ${todo.status} | Priority: ${todo.priority}
${todo.description ? `Description: ${todo.description}` : ''}
${todo.dueDate ? `Due: ${todo.dueDate.toLocaleDateString()}` : ''}
${todo.tags?.length ? `Tags: ${todo.tags.join(', ')}` : ''}
ID: ${todo.id}`;
      }

      case 'query': {
        const todos = result as TodoItem[];
        if (todos.length === 0) {
          return '📋 No todos found matching the criteria.';
        }

        let display = `📋 Found ${todos.length} todo(s):\n\n`;
        for (const todo of todos.slice(0, 10)) {
          display += `• **${todo.title}** (${todo.status}, ${todo.priority})\n`;
          if (todo.dueDate) {
            display += `  Due: ${todo.dueDate.toLocaleDateString()}\n`;
          }
          display += `  ID: ${todo.id}\n\n`;
        }

        if (todos.length > 10) {
          display += `... and ${todos.length - 10} more todos.`;
        }

        return display;
      }

      case 'getStats': {
        const stats = result as any;
        return `📊 **Todo Statistics**
Total: ${stats.total}
By Status: ${Object.entries(stats.byStatus)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')}
By Priority: ${Object.entries(stats.byPriority)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')}
Overdue: ${stats.overdue}
Due Today: ${stats.dueToday}
Due This Week: ${stats.dueThisWeek}`;
      }

      default:
        return typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2);
    }
  }
}
