/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  tags: string[];
  assignee?: string;
  dependencies: string[]; // IDs of other todo items
  subtasks: TodoItem[];
  project?: string;
  category?: string;
  estimatedHours?: number;
  actualHours?: number;
  metadata?: Record<string, unknown>;
}

export interface TodoList {
  items: TodoItem[];
  version: string;
  lastModified: Date;
  project?: string;
}

export interface TodoQuery {
  status?: Array<TodoItem['status']>;
  priority?: Array<TodoItem['priority']>;
  tags?: string[];
  assignee?: string;
  category?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  createdBefore?: Date;
  createdAfter?: Date;
  project?: string;
  searchText?: string;
}

export interface TodoStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  averageCompletionTime: number;
  totalEstimatedHours: number;
  totalActualHours: number;
}

export class TodoTool {
  private readonly projectTodoFile: string;
  private readonly globalTodoFile: string;

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this.projectTodoFile = path.join(root, '.pk', 'todos.json');

    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const globalTodoDir = path.join(homeDir, '.pk', 'todos');
    this.globalTodoFile = path.join(globalTodoDir, 'global-todos.json');

    this.ensureDirectories();
  }

  /**
   * Create a new todo item
   */
  async createTodo(
    title: string,
    options: {
      description?: string;
      priority?: TodoItem['priority'];
      dueDate?: Date;
      tags?: string[];
      category?: string;
      assignee?: string;
      dependencies?: string[];
      estimatedHours?: number;
      project?: string;
      global?: boolean;
    } = {},
  ): Promise<TodoItem> {
    const todoFile = options.global
      ? this.globalTodoFile
      : this.projectTodoFile;

    const todo: TodoItem = {
      id: this.generateId(),
      title,
      description: options.description,
      status: 'pending',
      priority: options.priority || 'medium',
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: options.dueDate,
      tags: options.tags || [],
      assignee: options.assignee,
      dependencies: options.dependencies || [],
      subtasks: [],
      project: options.project,
      category: options.category,
      estimatedHours: options.estimatedHours,
      metadata: {},
    };

    await this.saveTodoItem(todoFile, todo);
    return todo;
  }

  /**
   * Update an existing todo item
   */
  async updateTodo(
    id: string,
    updates: Partial<Omit<TodoItem, 'id' | 'createdAt'>>,
    global: boolean = false,
  ): Promise<TodoItem | null> {
    const todoFile = global ? this.globalTodoFile : this.projectTodoFile;
    const todoList = await this.loadTodoList(todoFile);

    const index = todoList.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updatedTodo = {
      ...todoList.items[index],
      ...updates,
      updatedAt: new Date(),
    };

    todoList.items[index] = updatedTodo;
    await this.saveTodoList(todoFile, todoList);

    return updatedTodo;
  }

  /**
   * Delete a todo item
   */
  async deleteTodo(id: string, global: boolean = false): Promise<boolean> {
    const todoFile = global ? this.globalTodoFile : this.projectTodoFile;
    const todoList = await this.loadTodoList(todoFile);

    const initialLength = todoList.items.length;
    todoList.items = todoList.items.filter((item) => item.id !== id);

    if (todoList.items.length < initialLength) {
      await this.saveTodoList(todoFile, todoList);
      return true;
    }

    return false;
  }

  /**
   * Query todo items
   */
  async queryTodos(
    query: TodoQuery,
    global: boolean = false,
  ): Promise<TodoItem[]> {
    const todoFile = global ? this.globalTodoFile : this.projectTodoFile;
    const todoList = await this.loadTodoList(todoFile);

    let results = [...todoList.items];

    // Filter by status
    if (query.status && query.status.length > 0) {
      results = results.filter((item) => query.status!.includes(item.status));
    }

    // Filter by priority
    if (query.priority && query.priority.length > 0) {
      results = results.filter((item) =>
        query.priority!.includes(item.priority),
      );
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter((item) =>
        query.tags!.some((tag) => item.tags.includes(tag)),
      );
    }

    // Filter by assignee
    if (query.assignee) {
      results = results.filter((item) => item.assignee === query.assignee);
    }

    // Filter by category
    if (query.category) {
      results = results.filter((item) => item.category === query.category);
    }

    // Filter by due date
    if (query.dueBefore) {
      results = results.filter(
        (item) => item.dueDate && item.dueDate <= query.dueBefore!,
      );
    }
    if (query.dueAfter) {
      results = results.filter(
        (item) => item.dueDate && item.dueDate >= query.dueAfter!,
      );
    }

    // Filter by creation date
    if (query.createdBefore) {
      results = results.filter(
        (item) => item.createdAt <= query.createdBefore!,
      );
    }
    if (query.createdAfter) {
      results = results.filter((item) => item.createdAt >= query.createdAfter!);
    }

    // Filter by project
    if (query.project) {
      results = results.filter((item) => item.project === query.project);
    }

    // Search by text
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      results = results.filter(
        (item) =>
          item.title.toLowerCase().includes(searchLower) ||
          (item.description &&
            item.description.toLowerCase().includes(searchLower)) ||
          item.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
      );
    }

    return results;
  }

  /**
   * Get todo statistics
   */
  async getStats(global: boolean = false): Promise<TodoStats> {
    const todoFile = global ? this.globalTodoFile : this.projectTodoFile;
    const todoList = await this.loadTodoList(todoFile);

    const stats: TodoStats = {
      total: todoList.items.length,
      byStatus: {},
      byPriority: {},
      byCategory: {},
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
      averageCompletionTime: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    let totalCompletionTime = 0;
    let completedCount = 0;

    for (const item of todoList.items) {
      // Count by status
      stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;

      // Count by priority
      stats.byPriority[item.priority] =
        (stats.byPriority[item.priority] || 0) + 1;

      // Count by category
      if (item.category) {
        stats.byCategory[item.category] =
          (stats.byCategory[item.category] || 0) + 1;
      }

      // Check due dates
      if (item.dueDate) {
        if (item.dueDate < now && item.status !== 'completed') {
          stats.overdue++;
        }
        if (
          item.dueDate >= today &&
          item.dueDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)
        ) {
          stats.dueToday++;
        }
        if (item.dueDate >= today && item.dueDate <= weekFromNow) {
          stats.dueThisWeek++;
        }
      }

      // Calculate completion time
      if (item.status === 'completed' && item.actualHours) {
        totalCompletionTime += item.actualHours;
        completedCount++;
      }

      // Sum hours
      if (item.estimatedHours) {
        stats.totalEstimatedHours += item.estimatedHours;
      }
      if (item.actualHours) {
        stats.totalActualHours += item.actualHours;
      }
    }

    stats.averageCompletionTime =
      completedCount > 0 ? totalCompletionTime / completedCount : 0;

    return stats;
  }

  /**
   * Add a subtask to an existing todo
   */
  async addSubtask(
    parentId: string,
    title: string,
    options: {
      description?: string;
      priority?: TodoItem['priority'];
      dueDate?: Date;
      tags?: string[];
      estimatedHours?: number;
    } = {},
    global: boolean = false,
  ): Promise<TodoItem | null> {
    const parentTodo = await this.updateTodo(
      parentId,
      {
        subtasks: [
          ...((await this.getTodo(parentId, global))?.subtasks || []),
          {
            id: this.generateId(),
            title,
            description: options.description,
            status: 'pending',
            priority: options.priority || 'medium',
            createdAt: new Date(),
            updatedAt: new Date(),
            dueDate: options.dueDate,
            tags: options.tags || [],
            dependencies: [],
            subtasks: [],
            estimatedHours: options.estimatedHours,
          },
        ],
      },
      global,
    );

    return parentTodo;
  }

  /**
   * Update a subtask
   */
  async updateSubtask(
    parentId: string,
    subtaskId: string,
    updates: Partial<Omit<TodoItem, 'id' | 'createdAt'>>,
    global: boolean = false,
  ): Promise<boolean> {
    const parentTodo = await this.getTodo(parentId, global);
    if (!parentTodo) return false;

    const subtaskIndex = parentTodo.subtasks.findIndex(
      (sub) => sub.id === subtaskId,
    );
    if (subtaskIndex === -1) return false;

    parentTodo.subtasks[subtaskIndex] = {
      ...parentTodo.subtasks[subtaskIndex],
      ...updates,
      updatedAt: new Date(),
    };

    await this.updateTodo(parentId, { subtasks: parentTodo.subtasks }, global);
    return true;
  }

  /**
   * Export todos to a file
   */
  async exportTodos(
    outputPath: string,
    query?: TodoQuery,
    global: boolean = false,
  ): Promise<void> {
    const todos = query
      ? await this.queryTodos(query, global)
      : await this.getAllTodos(global);

    const exportData = {
      exportedAt: new Date().toISOString(),
      todos,
      metadata: {
        totalTodos: todos.length,
        filters: query,
        global,
      },
    };

    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(exportData, null, 2),
      'utf8',
    );
  }

  /**
   * Import todos from a file
   */
  async importTodos(
    inputPath: string,
    global: boolean = false,
    merge: boolean = false,
  ): Promise<number> {
    const data = await fs.promises.readFile(inputPath, 'utf8');
    const importData = JSON.parse(data);

    if (!importData.todos || !Array.isArray(importData.todos)) {
      throw new Error('Invalid import file format');
    }

    const todos = importData.todos as TodoItem[];
    const todoFile = global ? this.globalTodoFile : this.projectTodoFile;

    if (!merge) {
      // Replace existing todos
      const todoList: TodoList = {
        items: todos,
        version: '1.0',
        lastModified: new Date(),
      };
      await this.saveTodoList(todoFile, todoList);
      return todos.length;
    } else {
      // Merge with existing todos
      const existingList = await this.loadTodoList(todoFile);
      let importedCount = 0;

      for (const todo of todos) {
        const existingIndex = existingList.items.findIndex(
          (item) => item.id === todo.id,
        );
        if (existingIndex >= 0) {
          existingList.items[existingIndex] = todo;
        } else {
          existingList.items.push(todo);
          importedCount++;
        }
      }

      await this.saveTodoList(todoFile, existingList);
      return importedCount;
    }
  }

  // Private helper methods

  private async getTodo(
    id: string,
    global: boolean = false,
  ): Promise<TodoItem | null> {
    const todos = await this.getAllTodos(global);
    return todos.find((todo) => todo.id === id) || null;
  }

  private async getAllTodos(global: boolean = false): Promise<TodoItem[]> {
    const todoFile = global ? this.globalTodoFile : this.projectTodoFile;
    const todoList = await this.loadTodoList(todoFile);
    return todoList.items;
  }

  private async loadTodoList(filePath: string): Promise<TodoList> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          items: [],
          version: '1.0',
          lastModified: new Date(),
        };
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      const todoList = JSON.parse(data);

      // Convert date strings back to Date objects
      todoList.items = todoList.items.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        subtasks: item.subtasks.map((sub: any) => ({
          ...sub,
          createdAt: new Date(sub.createdAt),
          updatedAt: new Date(sub.updatedAt),
          dueDate: sub.dueDate ? new Date(sub.dueDate) : undefined,
        })),
      }));

      return todoList;
    } catch (error) {
      console.warn(`Failed to load todo list ${filePath}:`, error);
      return {
        items: [],
        version: '1.0',
        lastModified: new Date(),
      };
    }
  }

  private async saveTodoList(
    filePath: string,
    todoList: TodoList,
  ): Promise<void> {
    todoList.lastModified = new Date();
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(todoList, null, 2),
      'utf8',
    );
  }

  private async saveTodoItem(filePath: string, todo: TodoItem): Promise<void> {
    const todoList = await this.loadTodoList(filePath);
    todoList.items.push(todo);
    await this.saveTodoList(filePath, todoList);
  }

  private generateId(): string {
    return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private ensureDirectories(): void {
    const projectDir = path.dirname(this.projectTodoFile);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const globalDir = path.dirname(this.globalTodoFile);
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
  }
}

// Validation schemas - forward declare to handle recursion
const TodoItemSchemaBase = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum([
    'pending',
    'in-progress',
    'completed',
    'cancelled',
    'blocked',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  createdAt: z.date(),
  updatedAt: z.date(),
  dueDate: z.date().optional(),
  tags: z.array(z.string()),
  assignee: z.string().optional(),
  dependencies: z.array(z.string()),
  project: z.string().optional(),
  category: z.string().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const TodoItemSchema: z.ZodType<TodoItem> = TodoItemSchemaBase.extend({
  subtasks: z.array(z.lazy(() => TodoItemSchema)),
});

export { TodoItemSchema };

export const TodoQuerySchema = z.object({
  status: z
    .array(
      z.enum(['pending', 'in-progress', 'completed', 'cancelled', 'blocked']),
    )
    .optional(),
  priority: z.array(z.enum(['low', 'medium', 'high', 'critical'])).optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  category: z.string().optional(),
  dueBefore: z.date().optional(),
  dueAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  createdAfter: z.date().optional(),
  project: z.string().optional(),
  searchText: z.string().optional(),
});

export const TodoStatsSchema = z.object({
  total: z.number(),
  byStatus: z.record(z.string(), z.number()),
  byPriority: z.record(z.string(), z.number()),
  byCategory: z.record(z.string(), z.number()),
  overdue: z.number(),
  dueToday: z.number(),
  dueThisWeek: z.number(),
  averageCompletionTime: z.number(),
  totalEstimatedHours: z.number(),
  totalActualHours: z.number(),
});
