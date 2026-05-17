/**
 * AHE v3.1 — Phoenix Integration Entry Point
 * 
 * Wires together all x-algorithm inspired components:
 *   PhoenixEvaluator → SignalMixer → CandidatePipeline → FirewallAdapter
 * 
 * Usage:
 *   import { AHEPhoenix } from './ahe-phoenix.js';
 *   const phoenix = new AHEPhoenix({ llmCall: myLLMFn });
 *   const result = await phoenix.evolve(candidates);
 */

import { PhoenixEvaluator, LLMCallFn, LanceQueryFn, FirewallEvalFn } from './phoenix-evaluator.js';
import { SignalMixer } from './signal-mixer.js';
import { CandidatePipeline } from './candidate-pipeline.js';
import { FirewallAdapter } from './firewall-adapter.js';
import { ContaminationFirewall } from './contamination-firewall.js';
import {
  MutationCandidate, PhoenixEvaluationResult, PipelineResult,
  PhoenixConfig, MixerConfig, PipelineConfig,
  PredictionOutcomeRecord, PhoenixPerformanceMetrics,
  PhoenixHistoricalCase,
} from './types_phoenix.js';

export interface AHEPhoenixConfig {
  phoenix?: Partial<PhoenixConfig>;
  mixer?: Partial<MixerConfig>;
  pipeline?: Partial<PipelineConfig>;
  llmCall?: LLMCallFn;
  lanceQuery?: LanceQueryFn;
}

export class AHEPhoenix {
  public phoenix: PhoenixEvaluator;
  public mixer: SignalMixer;
  public pipeline: CandidatePipeline;
  public firewallAdapter: FirewallAdapter;

  constructor(config: AHEPhoenixConfig = {}) {
    // Create underlying Firewall
    const firewall = new ContaminationFirewall();
    this.firewallAdapter = new FirewallAdapter(firewall);

    // Create Phoenix with mixer inside
    this.phoenix = new PhoenixEvaluator(config.phoenix);
    this.mixer = this.phoenix.getMixer();

    // Wire up dependencies
    if (config.llmCall) this.phoenix.setLLMCall(config.llmCall);
    if (config.lanceQuery) this.phoenix.setLanceQuery(config.lanceQuery);
    this.phoenix.setFirewallEval(async (m) => this.firewallAdapter.evaluate(m));

    // Create Pipeline
    this.pipeline = new CandidatePipeline(this.phoenix, config.pipeline);
  }

  /**
   * Full evolution cycle: candidates → pipeline → phoenix → results.
   * This is the main entry point for nightly dreaming output.
   */
  async evolve(candidates: MutationCandidate[]): Promise<{
    pipelineResult: PipelineResult;
    evaluations: PhoenixEvaluationResult[];
  }> {
    const pipelineResult = await this.pipeline.process(candidates);

    // Evaluate accepted candidates with Phoenix
    const evaluations = await this.phoenix.evaluateBatch(
      pipelineResult.passedCandidates.map(c => ({
        mutation: c,
        historicalContext: [],
        currentMetrics: {},
        firewallRiskScore: undefined,
      }))
    );

    return { pipelineResult, evaluations };
  }

  /**
   * Record the actual outcome of a mutation.
   * Closes the feedback loop for Phoenix accuracy tracking.
   */
  recordOutcome(mutationId: string, outcome: PredictionOutcomeRecord['actualOutcome']): PredictionOutcomeRecord | null {
    return this.phoenix.recordOutcome(mutationId, outcome);
  }

  /**
   * Get Phoenix performance report.
   */
  getPerformanceReport(): PhoenixPerformanceMetrics {
    return this.phoenix.getPerformanceMetrics();
  }

  /**
   * Export cold-start training data for future model distillation.
   */
  exportTrainingData(): PhoenixHistoricalCase[] {
    return this.phoenix.exportColdStartData();
  }

  /**
   * Get mixer statistics (LLM call ratio, etc.)
   */
  getMixerStats(): { totalCalls: number; llmCalls: number; ratio: number } {
    return this.mixer.getStats();
  }
}

// Re-export key types for consumers
export {
  PhoenixEvaluator, SignalMixer, CandidatePipeline, FirewallAdapter,
  ContaminationFirewall,
};
export type {
  PhoenixConfig, MixerConfig, PipelineConfig,
  MutationCandidate, PhoenixEvaluationResult, PipelineResult,
  PhoenixRecommendation, ChangeImpactVector,
  PredictionOutcomeRecord, PhoenixPerformanceMetrics,
};
