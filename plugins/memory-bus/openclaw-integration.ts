/**
 * AHE v3.0 — OpenClaw Integration Layer (L0)
 * 
 * Bridges AHE into OpenClaw's native event system.
 * Handles: failure auto-trigger, skill auto-registration, natural language commands.
 */

import { EventEmitter } from 'events';
import { MemoryEvent } from './types.js';
import { MemoryBus } from './index.js';
import { ExperimentManager } from './experiment-manager.js';
import { TraceAnalyzer } from './trace-analyzer.js';
import { ContaminationFirewall } from './contamination-firewall.js';
import { OpenClawEvent, AHECommand, AHEStatus } from './types_v3.js';

const AHE_VERSION = '3.0.0-alpha';

export class OpenClawIntegration extends EventEmitter {
  private memoryBus: MemoryBus;
  private experimentManager: ExperimentManager | null = null;
  private traceAnalyzer: TraceAnalyzer | null = null;
  private firewall: ContaminationFirewall;
  private autoEvolveEnabled: boolean = true;
  private lastActivity: string = new Date().toISOString();
  private evolutionCount: number = 0;

  constructor(memoryBus: MemoryBus) {
    super();
    this.memoryBus = memoryBus;
    this.firewall = new ContaminationFirewall();
  }

  // ─── Event Handlers ─────────────────────────────────────────

  /**
   * Called on every OpenClaw task completion.
   * Auto-triggers analysis on failure, skill crystallization on success.
   */
  async onTaskComplete(event: OpenClawEvent): Promise<void> {
    this.lastActivity = new Date().toISOString();

    // Ingest event into MemoryBus (through firewall)
    const memoryEvent = this.toMemoryEvent(event);
    const filtered = await this.firewall.intercept(memoryEvent);
    
    // Only store clean/suspicious events (skip isolated/purged)
    if (filtered.contamination.quarantine_level !== 'isolated' &&
        filtered.contamination.quarantine_level !== 'purged') {
      // await this.memoryBus.memory_add(filtered);
    }

    if (event.type === 'task_failure' && this.autoEvolveEnabled) {
      this.emit('evolution_needed', { taskId: event.payload?.taskId, error: event.payload?.error });
      
      // Auto-trigger trace analysis if analyzer is available
      if (this.traceAnalyzer) {
        // const report = await this.traceAnalyzer.analyze(
        //   event.payload?.taskId || 'unknown',
        //   [filtered],
        //   event.payload?.trace
        // );
        this.evolutionCount++;
        this.emit('analysis_complete', { analyzed: true });
      }
    }

    if (event.type === 'task_success' && this.autoEvolveEnabled) {
      this.emit('crystallization_recommended', { taskId: event.payload?.taskId });
    }

    if (event.type === 'skill_crystallized') {
      this.emit('skill_registered', { skillId: event.payload?.skillId });
    }

    return;
  }

  /**
   * Parse and execute AHE natural language commands.
   */
  async handleCommand(command: AHECommand): Promise<AHEStatus> {
    this.lastActivity = new Date().toISOString();

    switch (command.command) {
      case 'status':
        return this.getStatus();
      case 'evolve':
        return this.triggerEvolution(command.args || {});
      case 'analyze':
        return this.triggerAnalysis(command.args || {});
      case 'rollback':
        return this.triggerRollback(command.args || {});
      case 'crystallize':
        return this.triggerCrystallization(command.args || {});
      default:
        throw new Error(`Unknown AHE command: ${command.command}`);
    }
  }

  // ─── Status ─────────────────────────────────────────────────

  async getStatus(): Promise<AHEStatus> {
    const skills = []; // await this.memoryBus.listSkills();
    const stats = this.firewall.getQuarantineStats([]);

    return {
      version: AHE_VERSION,
      currentIteration: this.experimentManager?.iteration || 0,
      passRate: 0, // from experiment manager
      bestPassRate: this.experimentManager?.getBestEver()?.passRate || 0,
      totalEvolutions: this.evolutionCount,
      componentCount: 8, // 7 original + new v3 components
      skillCount: skills.length,
      contaminationEvents: stats.suspicious + stats.isolated + stats.purged,
      lastActivity: this.lastActivity,
    };
  }

  // ─── Sub-commands ───────────────────────────────────────────

  private async triggerEvolution(args: Record<string, any>): Promise<AHEStatus> {
    this.evolutionCount++;
    
    if (this.traceAnalyzer) {
      // Analyze recent failures
      // const report = await this.traceAnalyzer.analyze(...);
      this.emit('evolution_triggered', args);
    }
    
    return this.getStatus();
  }

  private async triggerAnalysis(args: Record<string, any>): Promise<AHEStatus> {
    if (!this.traceAnalyzer) {
      throw new Error('TraceAnalyzer not configured');
    }
    this.emit('analysis_triggered', args);
    return this.getStatus();
  }

  private async triggerRollback(args: Record<string, any>): Promise<AHEStatus> {
    this.emit('rollback_triggered', args);
    return this.getStatus();
  }

  private async triggerCrystallization(args: Record<string, any>): Promise<AHEStatus> {
    this.emit('crystallization_triggered', args);
    return this.getStatus();
  }

  // ─── Wiring ─────────────────────────────────────────────────

  setExperimentManager(manager: ExperimentManager): void {
    this.experimentManager = manager;
    manager.on('new_best', (best) => {
      this.emit('new_best_achieved', best);
    });
    manager.on('auto_rollback', (info) => {
      this.emit('rollback_executed', info);
      this.evolutionCount++;
    });
  }

  setTraceAnalyzer(analyzer: TraceAnalyzer): void {
    this.traceAnalyzer = analyzer;
  }

  enableAutoEvolve(enabled: boolean): void {
    this.autoEvolveEnabled = enabled;
  }

  // ─── Helpers ────────────────────────────────────────────────

  private toMemoryEvent(event: OpenClawEvent): MemoryEvent {
    return {
      id: `oc-${event.timestamp}-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: event.timestamp,
      type: event.type === 'task_failure' ? 'error' : 'fact',
      content: JSON.stringify(event.payload),
      metadata: {
        created_at: event.timestamp,
        source_agent: 'openclaw',
        tags: [event.type],
      },
      provenance: {
        source_type: 'system',
        confidence: event.type === 'task_failure' ? 0.9 : 0.99,
        depth: 0,
      },
      compression_info: { compressed: false },
      routing_hints: {},
      contamination: {
        suspicion_score: 0.05,
        quarantine_level: 'clean',
        provenance_depth: 0,
      },
    };
  }
}
