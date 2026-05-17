/**
 * AHE v3.0 — Experiment Manager
 * 
 * State machine driven experiment lifecycle management.
 * Manages: configs/ → runs/ → iteration tracking → change matrix → auto-rollback
 * 
 * Based on official AHE's configs/ + runs/ system, reimplemented in TypeScript.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import {
  ExperimentConfig, ExperimentPhase, StateMachineEvent,
  IterationRecord, TaskResult, ChangeMatrixReport, ChangeMatrixEntry,
  ComponentChange, ImpactPrediction,
  DEFAULT_STATE_MACHINE, StateMachineConfig,
  BenchmarkTask, ChangeState,
} from './types_v3.js';

export class ExperimentManager extends EventEmitter {
  private config: ExperimentConfig;
  private stateMachine: StateMachineConfig;
  private currentPhase: ExperimentPhase;
  private currentIteration: number;
  private iterations: IterationRecord[];
  private experimentsBase: string;

  constructor(experimentConfig: ExperimentConfig, baseDir?: string) {
    super();
    this.config = experimentConfig;
    this.stateMachine = { ...DEFAULT_STATE_MACHINE };
    this.currentPhase = 'idle';
    this.currentIteration = 0;
    this.iterations = [];
    this.experimentsBase = baseDir || process.env.AHE_ROOT || process.cwd();
  }

  // ─── State Machine ──────────────────────────────────────────

  transition(event: StateMachineEvent): ExperimentPhase {
    const allowed = this.stateMachine.transitions[this.currentPhase];
    const next = allowed?.[event];
    if (!next) {
      throw new Error(`Invalid transition: ${this.currentPhase} → ${event}`);
    }
    const prev = this.currentPhase;
    this.currentPhase = next;
    this.emit('phase_change', { from: prev, to: next, event });
    return next;
  }

  get phase(): ExperimentPhase { return this.currentPhase; }
  get iteration(): number { return this.currentIteration; }

  // ─── Experiment Lifecycle ───────────────────────────────────

  async initExperiment(): Promise<string> {
    this.transition('experiment_start');
    
    // Create directory structure
    const expDir = path.join(this.experimentsBase, 'experiments');
    const dirs = [
      path.join(expDir, 'configs'),
      path.join(expDir, 'runs'),
    ];
    dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

    // Write config
    const configPath = path.join(expDir, 'configs', `${this.config.name}.yaml`);
    fs.writeFileSync(configPath, this.serializeConfig());
    
    // Snapshot current harness state
    const snapshotDir = path.join(expDir, 'runs', `iteration_000`, 'input');
    fs.mkdirSync(snapshotDir, { recursive: true });
    this.snapshotHarness(snapshotDir);
    
    // Init tracking files
    fs.writeFileSync(path.join(expDir, 'task_history.json'), '[]');
    fs.writeFileSync(path.join(expDir, 'iteration_scores.yaml'), '# AHE Iteration Scores\n');
    fs.writeFileSync(path.join(expDir, 'best_ever.json'), JSON.stringify({
      iteration: 0, passRate: 0, commit: 'initial',
    }, null, 2));

    this.transition('evaluation_complete');
    return expDir;
  }

  async recordIteration(results: TaskResult[], changes: ComponentChange[]): Promise<IterationRecord> {
    this.currentIteration++;
    
    const passRate = this.computePassRate(results);
    const record: IterationRecord = {
      iterationNumber: this.currentIteration,
      timestamp: new Date().toISOString(),
      phase: this.currentPhase,
      harnessSnapshot: 'pending', // will be git commit hash
      results,
      passRate,
      changes,
      verdict: 'keep',
    };

    // Compute change matrix if we have previous iteration
    if (this.iterations.length > 0) {
      const prev = this.iterations[this.iterations.length - 1];
      record.changeMatrix = this.computeChangeMatrix(prev.results, results);
    }

    this.iterations.push(record);

    // Auto-rollback check
    if (this.config.autoRollback && this.iterations.length >= 2) {
      const prevPR = this.iterations[this.iterations.length - 2].passRate;
      if (passRate < prevPR - this.config.rollbackThreshold) {
        record.verdict = 'rollback';
        this.emit('auto_rollback', {
          iteration: this.currentIteration,
          previousPassRate: prevPR,
          currentPassRate: passRate,
          delta: passRate - prevPR,
        });
        this.transition('rollback_triggered');
      }
    }

    // Track best
    this.updateBestEver(record);

    // Persist
    this.persistIteration(record);
    return record;
  }

  // ─── 9-State Change Matrix ──────────────────────────────────

  computeChangeMatrix(previous: TaskResult[], current: TaskResult[]): ChangeMatrixReport {
    const entries: ChangeMatrixEntry[] = [];
    const currentMap = new Map(current.map(t => [t.taskId, t]));
    
    for (const prev of previous) {
      const cur = currentMap.get(prev.taskId);
      if (!cur) continue;
      
      const changeState = this.classifyChange(prev, cur);
      entries.push({
        taskId: prev.taskId,
        taskName: prev.taskName,
        previous: prev,
        current: cur,
        changeState,
        scoreDelta: cur.score - prev.score,
      });
    }

    // Group by state
    const matrix = {} as Record<ChangeState, ChangeMatrixEntry[]>;
    const initMatrix = (s: ChangeState) => { matrix[s] = []; };
    (['flipped', 'regressed', 'stable_pass', 'stable_fail',
      'infra_recovered', 'infra_lost', 'exception_to_fail',
      'fail_to_exception', 'exception_stable'] as ChangeState[]).forEach(initMatrix);
    
    entries.forEach(e => matrix[e.changeState].push(e));

    const prevPass = this.computePassRate(previous);
    const curPass = this.computePassRate(current);

    return {
      iteration: this.currentIteration,
      timestamp: new Date().toISOString(),
      totalTasks: entries.length,
      matrix,
      summary: {
        flipped: matrix.flipped.length,
        regressed: matrix.regressed.length,
        stable_pass: matrix.stable_pass.length,
        stable_fail: matrix.stable_fail.length,
        infra_issues: matrix.infra_recovered.length + matrix.infra_lost.length +
          matrix.exception_to_fail.length + matrix.fail_to_exception.length +
          matrix.exception_stable.length,
        net_improvement: matrix.flipped.length - matrix.regressed.length,
        passRateBefore: prevPass,
        passRateAfter: curPass,
      },
    };
  }

  private classifyChange(prev: TaskResult, cur: TaskResult): ChangeState {
    const ps = prev.status;
    const cs = cur.status;
    
    if (ps === 'fail' && cs === 'pass') return 'flipped';
    if (ps === 'pass' && cs === 'fail') return 'regressed';
    if (ps === 'pass' && cs === 'pass') return 'stable_pass';
    if (ps === 'fail' && cs === 'fail') return 'stable_fail';
    if (ps === 'exception' && cs === 'pass') return 'infra_recovered';
    if (ps === 'pass' && cs === 'exception') return 'infra_lost';
    if (ps === 'exception' && cs === 'fail') return 'exception_to_fail';
    if (ps === 'fail' && cs === 'exception') return 'fail_to_exception';
    return 'exception_stable';
  }

  // ─── Impact Prediction ──────────────────────────────────────

  predictImpact(changes: ComponentChange[], previousResults: TaskResult[]): ImpactPrediction {
    const affectedTasks = [...new Set(changes.flatMap(c => c.affectedTasks))];
    const componentCount = changes.length;
    
    // Simple heuristic: regression risk increases with component count
    const riskLevel = componentCount <= 1 ? 'low' : componentCount <= 3 ? 'medium' : 'high';
    
    return {
      predictedPassRateDelta: 0, // will be refined by LLM
      predictedTokenDelta: 0,
      affectedComponents: changes.map(c => c.component),
      riskLevel,
      reasoning: `Changing ${componentCount} component(s) affecting ${affectedTasks.length} task(s)`,
    };
  }

  // ─── Utilities ──────────────────────────────────────────────

  private computePassRate(results: TaskResult[]): number {
    if (results.length === 0) return 0;
    const passed = results.filter(r => r.status === 'pass').length;
    return passed / results.length;
  }

  private updateBestEver(record: IterationRecord): void {
    const bestPath = path.join(this.experimentsBase, 'experiments', 'best_ever.json');
    let best: any = { iteration: 0, passRate: 0, commit: 'initial' };
    try { best = JSON.parse(fs.readFileSync(bestPath, 'utf-8')); } catch {}
    
    if (record.passRate > best.passRate) {
      best = { iteration: record.iterationNumber, passRate: record.passRate, commit: record.harnessSnapshot };
      fs.writeFileSync(bestPath, JSON.stringify(best, null, 2));
      this.emit('new_best', best);
    }
  }

  private persistIteration(record: IterationRecord): void {
    const runDir = path.join(
      this.experimentsBase, 'experiments', 'runs',
      `iteration_${String(record.iterationNumber).padStart(3, '0')}`
    );
    fs.mkdirSync(runDir, { recursive: true });
    
    // Write eval results
    fs.mkdirSync(path.join(runDir, 'eval'), { recursive: true });
    fs.writeFileSync(path.join(runDir, 'eval', 'results.json'),
      JSON.stringify(record.results, null, 2));
    
    // Write change matrix if present
    if (record.changeMatrix) {
      fs.mkdirSync(path.join(runDir, 'analysis'), { recursive: true });
      fs.writeFileSync(path.join(runDir, 'analysis', 'change_matrix.json'),
        JSON.stringify(record.changeMatrix, null, 2));
    }
    
    // Write changes
    if (record.changes.length > 0) {
      fs.mkdirSync(path.join(runDir, 'evolve'), { recursive: true });
      fs.writeFileSync(path.join(runDir, 'evolve', 'changes.json'),
        JSON.stringify(record.changes, null, 2));
    }

    // Write change evaluation
    fs.writeFileSync(path.join(runDir, 'change_evaluation.json'),
      JSON.stringify({ verdict: record.verdict, passRate: record.passRate }, null, 2));

    // Update iteration scores
    const scoresPath = path.join(this.experimentsBase, 'experiments', 'iteration_scores.yaml');
    const line = `iteration_${record.iterationNumber}: ${record.passRate.toFixed(4)}\n`;
    fs.appendFileSync(scoresPath, line);

    // Update task history
    const historyPath = path.join(this.experimentsBase, 'experiments', 'task_history.json');
    let history: any[] = [];
    try { history = JSON.parse(fs.readFileSync(historyPath, 'utf-8')); } catch {}
    history.push({
      iteration: record.iterationNumber,
      timestamp: record.timestamp,
      results: record.results.map(r => ({ id: r.taskId, status: r.status, score: r.score })),
    });
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  }

  private snapshotHarness(dir: string): void {
    // Copy key components to snapshot directory
    const src = path.join(this.experimentsBase, 'components');
    if (fs.existsSync(src)) {
      const files = fs.readdirSync(src);
      files.forEach(f => {
        const srcPath = path.join(src, f);
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, path.join(dir, f));
        }
      });
    }
    // Copy current SKILL.md
    const skillPath = path.join(this.experimentsBase, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      fs.copyFileSync(skillPath, path.join(dir, 'SKILL.md'));
    }
  }

  private serializeConfig(): string {
    return `# AHE Experiment: ${this.config.name}
name: ${this.config.name}
description: ${this.config.description || ''}
max_iterations: ${this.config.maxIterations}
pass_rate_target: ${this.config.passRateTarget}
rollback_threshold: ${this.config.rollbackThreshold}
auto_rollback: ${this.config.autoRollback}
evolution_strategy: ${this.config.evolutionStrategy}
n_variants: ${this.config.nVariants || 1}

benchmark_tasks:
${(this.config.benchmarkTasks || []).map(t => `  - id: ${t.id}
    name: ${t.name}
    category: ${t.category}`).join('\n')}
`;
  }

  // ─── Accessors ──────────────────────────────────────────────

  getBestEver(): { iteration: number; passRate: number; commit: string } {
    const p = path.join(this.experimentsBase, 'experiments', 'best_ever.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
    catch { return { iteration: 0, passRate: 0, commit: 'initial' }; }
  }

  getIterationHistory(): IterationRecord[] {
    return this.iterations;
  }

  getChangeMatrix(iterationId: number): ChangeMatrixReport | undefined {
    const record = this.iterations.find(i => i.iterationNumber === iterationId);
    return record?.changeMatrix;
  }
}
