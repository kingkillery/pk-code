/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TaskStatus, TaskWithStatus } from './TaskPlanner.js';

/**
 * Artifact stored in the blackboard
 */
export interface Artifact {
  /** Unique artifact identifier */
  id: string;
  /** Artifact name/title */
  name: string;
  /** Artifact type/category */
  type: 'file' | 'document' | 'data' | 'report' | 'config' | 'schema' | 'other';
  /** File path or storage location */
  path?: string;
  /** Artifact content (for small artifacts) */
  content?: string;
  /** Content summary for large artifacts */
  summary?: string;
  /** File size in bytes */
  size?: number;
  /** MIME type */
  mimeType?: string;
  /** Task that created this artifact */
  createdBy: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modification timestamp */
  updatedAt: Date;
  /** Tags for categorization */
  tags: string[];
  /** Dependencies on other artifacts */
  dependencies: string[];
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Shared note for inter-agent communication
 */
export interface SharedNote {
  /** Unique note identifier */
  id: string;
  /** Agent that created the note */
  author: string;
  /** Note title */
  title: string;
  /** Note content */
  content: string;
  /** Note priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Note category */
  category: 'info' | 'warning' | 'error' | 'question' | 'suggestion' | 'decision';
  /** Target agents (empty means all agents) */
  targetAgents: string[];
  /** Related task IDs */
  relatedTasks: string[];
  /** Related artifact IDs */
  relatedArtifacts: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Whether the note has been read by target agents */
  readBy: string[];
  /** Whether the note requires acknowledgment */
  requiresAck: boolean;
  /** Acknowledgments received */
  acknowledgments: Array<{
    agent: string;
    timestamp: Date;
    response?: string;
  }>;
}

/**
 * Task status entry in the blackboard
 */
export interface TaskStatusEntry {
  /** Task ID */
  taskId: string;
  /** Current status */
  status: TaskStatus;
  /** Agent assigned to the task */
  assignedAgent?: string;
  /** Status history */
  statusHistory: Array<{
    status: TaskStatus;
    timestamp: Date;
    agent?: string;
    note?: string;
  }>;
  /** Task progress (0-100) */
  progress: number;
  /** Estimated completion time */
  estimatedCompletion?: Date;
  /** Last update timestamp */
  lastUpdated: Date;
  /** Current working notes */
  workingNotes?: string;
  /** Blocking issues */
  blockingIssues: string[];
}

/**
 * Blackboard event for notifications
 */
export interface BlackboardEvent {
  /** Event type */
  type: 'task-status-changed' | 'artifact-created' | 'artifact-updated' | 'note-created' | 'note-updated';
  /** Event timestamp */
  timestamp: Date;
  /** Agent that triggered the event */
  agent: string;
  /** Event data */
  data: {
    taskId?: string;
    artifactId?: string;
    noteId?: string;
    oldValue?: unknown;
    newValue?: unknown;
  };
}

/**
 * Blackboard event listener
 */
export type BlackboardEventListener = (event: BlackboardEvent) => void;

/**
 * Query interface for blackboard searches
 */
export interface BlackboardQuery {
  /** Search artifacts */
  artifacts?: {
    type?: string[];
    tags?: string[];
    createdBy?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
    namePattern?: string;
    contentPattern?: string;
  };
  /** Search notes */
  notes?: {
    author?: string[];
    category?: ('info' | 'warning' | 'error' | 'question' | 'suggestion' | 'decision')[];
    priority?: ('low' | 'medium' | 'high' | 'critical')[];
    targetAgents?: string[];
    unreadBy?: string;
    requiresAck?: boolean;
    relatedTasks?: string[];
  };
  /** Search task statuses */
  taskStatuses?: {
    status?: TaskStatus[];
    assignedAgent?: string[];
    hasBlockingIssues?: boolean;
    progressMin?: number;
    progressMax?: number;
  };
}

/**
 * Blackboard search results
 */
export interface BlackboardSearchResults {
  artifacts: Artifact[];
  notes: SharedNote[];
  taskStatuses: TaskStatusEntry[];
}

/**
 * Shared state blackboard for inter-agent communication and coordination
 */
export class Blackboard {
  private artifacts = new Map<string, Artifact>();
  private notes = new Map<string, SharedNote>();
  private taskStatuses = new Map<string, TaskStatusEntry>();
  private eventListeners = new Set<BlackboardEventListener>();
  private nextId = 1;

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `bb-${Date.now()}-${this.nextId++}`;
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: BlackboardEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in blackboard event listener:', error);
      }
    }
  }

  /**
   * Add an event listener
   */
  addEventListener(listener: BlackboardEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: BlackboardEventListener): void {
    this.eventListeners.delete(listener);
  }

  // Task Status Management

  /**
   * Update task status
   */
  updateTaskStatus(
    taskId: string, 
    status: TaskStatus, 
    agent: string, 
    note?: string
  ): void {
    let entry = this.taskStatuses.get(taskId);
    
    if (!entry) {
      entry = {
        taskId,
        status,
        statusHistory: [],
        progress: status === 'completed' ? 100 : 0,
        lastUpdated: new Date(),
        blockingIssues: []
      };
      this.taskStatuses.set(taskId, entry);
    }

    const oldStatus = entry.status;
    entry.status = status;
    entry.lastUpdated = new Date();
    
    // Update progress based on status
    if (status === 'completed') {
      entry.progress = 100;
    } else if (status === 'running' && entry.progress === 0) {
      entry.progress = 10; // Just started
    }

    // Add to history
    entry.statusHistory.push({
      status,
      timestamp: new Date(),
      agent,
      note
    });

    // Emit event
    this.emitEvent({
      type: 'task-status-changed',
      timestamp: new Date(),
      agent,
      data: {
        taskId,
        oldValue: oldStatus,
        newValue: status
      }
    });
  }

  /**
   * Assign agent to task
   */
  assignTask(taskId: string, agent: string): void {
    let entry = this.taskStatuses.get(taskId);
    
    if (!entry) {
      entry = {
        taskId,
        status: 'pending',
        statusHistory: [],
        progress: 0,
        lastUpdated: new Date(),
        blockingIssues: []
      };
      this.taskStatuses.set(taskId, entry);
    }

    entry.assignedAgent = agent;
    entry.lastUpdated = new Date();
  }

  /**
   * Update task progress
   */
  updateTaskProgress(taskId: string, progress: number, agent: string): void {
    const entry = this.taskStatuses.get(taskId);
    if (!entry) return;

    entry.progress = Math.max(0, Math.min(100, progress));
    entry.lastUpdated = new Date();

    // Auto-update status based on progress
    if (progress >= 100 && entry.status !== 'completed') {
      this.updateTaskStatus(taskId, 'completed', agent);
    } else if (progress > 0 && entry.status === 'pending') {
      this.updateTaskStatus(taskId, 'running', agent);
    }
  }

  /**
   * Add blocking issue to task
   */
  addBlockingIssue(taskId: string, issue: string, agent: string): void {
    const entry = this.taskStatuses.get(taskId);
    if (!entry) return;

    entry.blockingIssues.push(issue);
    entry.lastUpdated = new Date();

    // Create a note about the blocking issue
    this.createNote({
      author: agent,
      title: `Blocking Issue: ${taskId}`,
      content: issue,
      priority: 'high',
      category: 'error',
      targetAgents: [], // Broadcast to all
      relatedTasks: [taskId],
      relatedArtifacts: [],
      requiresAck: true
    });
  }

  /**
   * Resolve blocking issue
   */
  resolveBlockingIssue(taskId: string, issueIndex: number, agent: string): void {
    const entry = this.taskStatuses.get(taskId);
    if (!entry || issueIndex < 0 || issueIndex >= entry.blockingIssues.length) return;

    const resolvedIssue = entry.blockingIssues.splice(issueIndex, 1)[0];
    entry.lastUpdated = new Date();

    // Create a note about the resolution
    this.createNote({
      author: agent,
      title: `Issue Resolved: ${taskId}`,
      content: `Resolved blocking issue: ${resolvedIssue}`,
      priority: 'medium',
      category: 'info',
      targetAgents: [], // Broadcast to all
      relatedTasks: [taskId],
      relatedArtifacts: [],
      requiresAck: false
    });
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): TaskStatusEntry | undefined {
    return this.taskStatuses.get(taskId);
  }

  /**
   * Get all task statuses
   */
  getAllTaskStatuses(): TaskStatusEntry[] {
    return Array.from(this.taskStatuses.values());
  }

  // Artifact Management

  /**
   * Create or update artifact
   */
  createArtifact(artifact: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateId();
    const now = new Date();
    
    const fullArtifact: Artifact = {
      ...artifact,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.artifacts.set(id, fullArtifact);

    this.emitEvent({
      type: 'artifact-created',
      timestamp: now,
      agent: artifact.createdBy,
      data: { artifactId: id }
    });

    return id;
  }

  /**
   * Update existing artifact
   */
  updateArtifact(
    id: string, 
    updates: Partial<Omit<Artifact, 'id' | 'createdAt' | 'createdBy'>>,
    agent: string
  ): boolean {
    const artifact = this.artifacts.get(id);
    if (!artifact) return false;

    const updatedArtifact = {
      ...artifact,
      ...updates,
      updatedAt: new Date()
    };
    
    this.artifacts.set(id, updatedArtifact);

    this.emitEvent({
      type: 'artifact-updated',
      timestamp: new Date(),
      agent,
      data: { artifactId: id }
    });

    return true;
  }

  /**
   * Get artifact by ID
   */
  getArtifact(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  /**
   * Get artifacts by task
   */
  getArtifactsByTask(taskId: string): Artifact[] {
    return Array.from(this.artifacts.values())
      .filter(artifact => artifact.createdBy === taskId);
  }

  /**
   * Get all artifacts
   */
  getAllArtifacts(): Artifact[] {
    return Array.from(this.artifacts.values());
  }

  // Shared Notes Management

  /**
   * Create shared note
   */
  createNote(note: Omit<SharedNote, 'id' | 'createdAt' | 'readBy' | 'acknowledgments'>): string {
    const id = this.generateId();
    const now = new Date();
    
    const fullNote: SharedNote = {
      ...note,
      id,
      createdAt: now,
      readBy: [],
      acknowledgments: []
    };
    
    this.notes.set(id, fullNote);

    this.emitEvent({
      type: 'note-created',
      timestamp: now,
      agent: note.author,
      data: { noteId: id }
    });

    return id;
  }

  /**
   * Mark note as read by agent
   */
  markNoteAsRead(noteId: string, agent: string): boolean {
    const note = this.notes.get(noteId);
    if (!note) return false;

    if (!note.readBy.includes(agent)) {
      note.readBy.push(agent);
    }

    return true;
  }

  /**
   * Acknowledge note
   */
  acknowledgeNote(noteId: string, agent: string, response?: string): boolean {
    const note = this.notes.get(noteId);
    if (!note) return false;

    // Remove existing acknowledgment from same agent
    note.acknowledgments = note.acknowledgments.filter(ack => ack.agent !== agent);
    
    // Add new acknowledgment
    note.acknowledgments.push({
      agent,
      timestamp: new Date(),
      response
    });

    // Mark as read
    this.markNoteAsRead(noteId, agent);

    return true;
  }

  /**
   * Get notes for agent
   */
  getNotesForAgent(agent: string, includeUnread?: boolean): SharedNote[] {
    return Array.from(this.notes.values()).filter(note => {
      // Check if note is targeted to this agent or broadcast
      const isTargeted = note.targetAgents.length === 0 || note.targetAgents.includes(agent);
      
      if (!isTargeted) return false;
      
      if (includeUnread) {
        return !note.readBy.includes(agent);
      }
      
      return true;
    });
  }

  /**
   * Get note by ID
   */
  getNote(id: string): SharedNote | undefined {
    return this.notes.get(id);
  }

  /**
   * Get all notes
   */
  getAllNotes(): SharedNote[] {
    return Array.from(this.notes.values());
  }

  // Search and Query

  /**
   * Search blackboard content
   */
  search(query: BlackboardQuery): BlackboardSearchResults {
    const results: BlackboardSearchResults = {
      artifacts: [],
      notes: [],
      taskStatuses: []
    };

    // Search artifacts
    if (query.artifacts) {
      results.artifacts = Array.from(this.artifacts.values()).filter(artifact => {
        const q = query.artifacts!;
        
        if (q.type && !q.type.includes(artifact.type)) return false;
        if (q.tags && !q.tags.some(tag => artifact.tags.includes(tag))) return false;
        if (q.createdBy && !q.createdBy.includes(artifact.createdBy)) return false;
        if (q.createdAfter && artifact.createdAt < q.createdAfter) return false;
        if (q.createdBefore && artifact.createdAt > q.createdBefore) return false;
        
        if (q.namePattern) {
          const regex = new RegExp(q.namePattern, 'i');
          if (!regex.test(artifact.name)) return false;
        }
        
        if (q.contentPattern && artifact.content) {
          const regex = new RegExp(q.contentPattern, 'i');
          if (!regex.test(artifact.content)) return false;
        }
        
        return true;
      });
    }

    // Search notes
    if (query.notes) {
      results.notes = Array.from(this.notes.values()).filter(note => {
        const q = query.notes!;
        
        if (q.author && !q.author.includes(note.author)) return false;
        if (q.category && !q.category.includes(note.category)) return false;
        if (q.priority && !q.priority.includes(note.priority)) return false;
        if (q.targetAgents && !q.targetAgents.some(agent => note.targetAgents.includes(agent))) return false;
        if (q.unreadBy && note.readBy.includes(q.unreadBy)) return false;
        if (q.requiresAck !== undefined && note.requiresAck !== q.requiresAck) return false;
        if (q.relatedTasks && !q.relatedTasks.some(task => note.relatedTasks.includes(task))) return false;
        
        return true;
      });
    }

    // Search task statuses
    if (query.taskStatuses) {
      results.taskStatuses = Array.from(this.taskStatuses.values()).filter(status => {
        const q = query.taskStatuses!;
        
        if (q.status && !q.status.includes(status.status)) return false;
        if (q.assignedAgent && (!status.assignedAgent || !q.assignedAgent.includes(status.assignedAgent))) return false;
        if (q.hasBlockingIssues !== undefined && (status.blockingIssues.length > 0) !== q.hasBlockingIssues) return false;
        if (q.progressMin !== undefined && status.progress < q.progressMin) return false;
        if (q.progressMax !== undefined && status.progress > q.progressMax) return false;
        
        return true;
      });
    }

    return results;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    tasks: {
      total: number;
      byStatus: Record<TaskStatus, number>;
      withBlockingIssues: number;
      averageProgress: number;
    };
    artifacts: {
      total: number;
      byType: Record<string, number>;
      totalSize: number;
    };
    notes: {
      total: number;
      unread: number;
      requireingAck: number;
      byPriority: Record<string, number>;
    };
  } {
    const tasks = Array.from(this.taskStatuses.values());
    const artifacts = Array.from(this.artifacts.values());
    const notes = Array.from(this.notes.values());

    // Task statistics
    const tasksByStatus: Record<TaskStatus, number> = {
      pending: 0,
      ready: 0,
      running: 0,
      completed: 0,
      failed: 0,
      blocked: 0
    };
    
    let totalProgress = 0;
    let tasksWithBlockingIssues = 0;
    
    for (const task of tasks) {
      tasksByStatus[task.status]++;
      totalProgress += task.progress;
      if (task.blockingIssues.length > 0) {
        tasksWithBlockingIssues++;
      }
    }

    // Artifact statistics
    const artifactsByType: Record<string, number> = {};
    let totalSize = 0;
    
    for (const artifact of artifacts) {
      artifactsByType[artifact.type] = (artifactsByType[artifact.type] || 0) + 1;
      totalSize += artifact.size || 0;
    }

    // Note statistics
    const notesByPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    let unreadNotes = 0;
    let notesRequiringAck = 0;
    
    for (const note of notes) {
      notesByPriority[note.priority]++;
      
      if (note.targetAgents.length === 0) {
        // Broadcast notes are considered unread if not read by anyone
        if (note.readBy.length === 0) unreadNotes++;
      } else {
        // Targeted notes are unread if not read by all targets
        if (note.targetAgents.some(agent => !note.readBy.includes(agent))) {
          unreadNotes++;
        }
      }
      
      if (note.requiresAck) {
        const requiredAcks = note.targetAgents.length || 1; // At least 1 if broadcast
        if (note.acknowledgments.length < requiredAcks) {
          notesRequiringAck++;
        }
      }
    }

    return {
      tasks: {
        total: tasks.length,
        byStatus: tasksByStatus,
        withBlockingIssues: tasksWithBlockingIssues,
        averageProgress: tasks.length > 0 ? totalProgress / tasks.length : 0
      },
      artifacts: {
        total: artifacts.length,
        byType: artifactsByType,
        totalSize
      },
      notes: {
        total: notes.length,
        unread: unreadNotes,
        requireingAck: notesRequiringAck,
        byPriority: notesByPriority
      }
    };
  }

  /**
   * Clear all data (for testing/reset)
   */
  clear(): void {
    this.artifacts.clear();
    this.notes.clear();
    this.taskStatuses.clear();
  }

  /**
   * Export blackboard state
   */
  export(): {
    artifacts: Artifact[];
    notes: SharedNote[];
    taskStatuses: TaskStatusEntry[];
    timestamp: Date;
  } {
    return {
      artifacts: Array.from(this.artifacts.values()),
      notes: Array.from(this.notes.values()),
      taskStatuses: Array.from(this.taskStatuses.values()),
      timestamp: new Date()
    };
  }

  /**
   * Import blackboard state
   */
  import(data: {
    artifacts?: Artifact[];
    notes?: SharedNote[];
    taskStatuses?: TaskStatusEntry[];
  }): void {
    if (data.artifacts) {
      this.artifacts.clear();
      for (const artifact of data.artifacts) {
        this.artifacts.set(artifact.id, artifact);
      }
    }

    if (data.notes) {
      this.notes.clear();
      for (const note of data.notes) {
        this.notes.set(note.id, note);
      }
    }

    if (data.taskStatuses) {
      this.taskStatuses.clear();
      for (const status of data.taskStatuses) {
        this.taskStatuses.set(status.taskId, status);
      }
    }
  }
}
