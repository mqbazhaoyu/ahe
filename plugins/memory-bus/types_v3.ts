/**
 * AHE v3.0 — Extended Type Definitions
 * 
 * New types for: ExperimentManager, TraceAnalyzer, ChangeMatrix,
 * OpenClaw Integration, Cross-Platform Adapter
 */

import { MemoryEvent, QuarantineLevel, ContaminationInfo } from './types.js';

// ─── Change Matrix (9-state) — from official AHE ────────────

export type ChangeState =
  | 'flipped'           // fail → pass (improvement ✅)
  | 'regressed'         // pass → fail (degradation 🚨)
  | 'stable_pass'       // pass → pass (stable good)
  | 'stable_fail'       // fail → fail (persistent failure)
  | 'infra_recovered'   // exception → pass
  | 'infra_lost'        // pass → exception
  | 'exception_to_fail' // exception → fail
  | 'fail_to_exception' // fail → exception
  | 'exception_stable'; // exception → exception

export interface TaskResult {
  taskId: string;
  taskName: string;
  status: 'pass' | 'fail' | 'exception';
  score: number;
  rolloutCount?: number;
  rolloutPassed?: number;
  tokenCost?: number;
  durationMs?: number;
  errorType?: string;
  errorMessage?: string;
}

export interface ChangeMatrixEntry {
  taskId: string;
  taskName: string;
  previous: TaskResult;
  current: TaskResult;
  changeState: ChangeState;
  scoreDelta: number;
}

export interface ChangeMatrixReport {
  iteration: number;
  timestamp: string;
  totalTasks: number;
  matrix: Record<ChangeState, ChangeMatrixEntry[]>;
  summary: {
    flipped: number;
    regressed: number;
    stable_pass: number;
    stable_fail: number;
    infra_issues: number; // infra_recovered + infra_lost + exception variants
    net_improvement: number; // flipped - regressed
    passRateBefore: number;
    passRateAfter: number;
  };
}

// ─── Experiment Manager ─────────────────────────────────────

export type ExperimentPhase = 'idle' | 'evaluating' | 'analyzing' | 'evolving' | 'verifying' | 'failed';

export interface ExperimentConfig {
  name: string;
  description?: string;
  maxIterations: number;
  passRateTarget: number;
  rollbackThreshold: number; // e.g. 0.1 = rollback if pass rate drops >10%
  benchmarkTasks: BenchmarkTask[];
  evolutionStrategy: 'best_of_n' | 'greedy' | 'manual';
  nVariants?: number; // for best_of_n
  autoRollback: boolean;
}

export interface BenchmarkTask {
  id: string;
  name: string;
  description: string;
  category: string;
  expectedOutput?: string;
  validationScript?: string;
}

export interface IterationRecord {
  iterationNumber: number;
  timestamp: string;
  phase: ExperimentPhase;
  harnessSnapshot: string; // git commit or file hash
  results: TaskResult[];
  passRate: number;
  changeMatrix?: ChangeMatrixReport;
  traceAnalysis?: TraceAnalysisReport;
  changes: ComponentChange[];
  predictedImpact?: ImpactPrediction;
  verdict: 'keep' | 'rollback' | 'merge';
}

export interface ComponentChange {
  component: string; // e.g. "tool-policies", "memory-schema"
  changeType: 'update' | 'add' | 'delete' | 'modify';
  description: string;
  diff: string;
  affectedTasks: string[];
}

export interface ImpactPrediction {
  predictedPassRateDelta: number;
  predictedTokenDelta: number;
  affectedComponents: string[];
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
}

// ─── Experiment State Machine ───────────────────────────────

export type StateMachineEvent =
  | 'experiment_start'
  | 'evaluation_complete'
  | 'analysis_complete'
  | 'evolution_complete'
  | 'verification_complete'
  | 'rollback_triggered'
  | 'experiment_complete'
  | 'experiment_failed';

export interface StateMachineConfig {
  initialState: ExperimentPhase;
  transitions: Record<ExperimentPhase, Partial<Record<StateMachineEvent, ExperimentPhase>>>;
}

export const DEFAULT_STATE_MACHINE: StateMachineConfig = {
  initialState: 'idle',
  transitions: {
    idle: { experiment_start: 'evaluating' },
    evaluating: { evaluation_complete: 'analyzing', experiment_failed: 'failed' },
    analyzing: { analysis_complete: 'evolving', rollback_triggered: 'idle' },
    evolving: { evolution_complete: 'verifying', rollback_triggered: 'idle' },
    verifying: { verification_complete: 'idle', rollback_triggered: 'idle' },
    failed: { experiment_start: 'evaluating' },
  },
};

// ─── Trace Analyzer ─────────────────────────────────────────

export interface TraceAnalysisReport {
  taskId: string;
  analyzedAt: string;
  rootCause: string;
  affectedComponents: string[];
  suggestedFix: string;
  confidence: number; // 0-1
  evidence: string[]; // key trace excerpts
  contaminationAssessment: ContaminationInfo;
  errorCategory: 'path_error' | 'tool_error' | 'logic_error' | 'config_error' | 'external_error' | 'unknown';
}

export interface AnalyzerConfig {
  mode: 'llm' | 'rule' | 'hybrid';
  llmBackend?: string; // 'deepseek' | 'grok' | 'claude' etc.
  llmCall?: (prompt: string) => Promise<string>;
  rulesPath?: string; // local rule definitions
}

// ─── OpenClaw Integration Layer (L0) ────────────────────────

export interface OpenClawEvent {
  type: 'task_success' | 'task_failure' | 'heartbeat' | 'cron_weekly' | 'skill_crystallized';
  timestamp: string;
  payload: Record<string, any>;
  sessionId?: string;
}

export interface AHECommand {
  command: 'status' | 'evolve' | 'analyze' | 'rollback' | 'crystallize';
  args?: Record<string, any>;
}

export interface AHEStatus {
  version: string;
  currentIteration: number;
  passRate: number;
  bestPassRate: number;
  totalEvolutions: number;
  componentCount: number;
  skillCount: number;
  contaminationEvents: number;
  lastActivity: string;
}

// ─── Contamination Firewall Middleware ───────────────────────

export interface FirewallConfig {
  weights: {
    w1_source: number;
    w2_hallucination: number;
    w3_staleness: number;
    w4_depth: number;
  };
  thresholds: {
    suspicious: number; // default 0.2
    isolated: number;    // default 0.5
    purged: number;      // default 0.8
  };
  crossValidation: {
    enabled: boolean;
    minModels: number;   // minimum models for cross-validation
  };
}

export interface ContaminationPropagation {
  sourceEventId: string;
  sourceScore: number;
  downstreamEvents: Array<{
    eventId: string;
    originalScore: number;
    propagatedPenalty: number;
    newScore: number;
  }>;
}

// ─── AHE Adapter Interface (cross-platform) ────────────────

export interface AHEAdapter {
  name: string; // 'openclaw' | 'hermes' | 'claude' | 'cursor'
  initialize(): Promise<void>;
  onTaskComplete(event: OpenClawEvent): Promise<void>;
  triggerEvolution(command: AHECommand): Promise<AHEStatus>;
  getStatus(): Promise<AHEStatus>;
}
