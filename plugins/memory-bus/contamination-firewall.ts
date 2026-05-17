/**
 * AHE v3.0 — Contamination Firewall Middleware
 * 
 * All MemoryBus reads/writes pass through this middleware.
 * v3.0 enhancements over v2.1:
 *   - Multi-model cross-validation
 *   - Contamination propagation graph
 *   - Verification decay visualization
 *   - Interception layer for all MemoryBus operations
 */

import { MemoryEvent, ContaminationInfo, QuarantineLevel } from './types.js';
import { FirewallConfig, ContaminationPropagation } from './types_v3.js';

const DEFAULT_FIREWALL_CONFIG: FirewallConfig = {
  weights: {
    w1_source: 0.4,
    w2_hallucination: 0.3,
    w3_staleness: 0.15,
    w4_depth: 0.15,
  },
  thresholds: {
    suspicious: 0.2,
    isolated: 0.5,
    purged: 0.8,
  },
  crossValidation: {
    enabled: false,
    minModels: 2,
  },
};

interface CrossValidationFn {
  (event: MemoryEvent): Promise<{ verified: boolean; confidence: number; models: string[] }>;
}

export class ContaminationFirewall {
  private config: FirewallConfig;
  private crossValidator?: CrossValidationFn;
  private propagationGraph: Map<string, string[]> = new Map(); // source → downstreams
  private quarantineLog: Array<{ timestamp: string; eventId: string; from: QuarantineLevel; to: QuarantineLevel; reason: string }> = [];

  constructor(config?: Partial<FirewallConfig>) {
    this.config = {
      ...DEFAULT_FIREWALL_CONFIG,
      ...config,
      weights: { ...DEFAULT_FIREWALL_CONFIG.weights, ...config?.weights },
      thresholds: { ...DEFAULT_FIREWALL_CONFIG.thresholds, ...config?.thresholds },
      crossValidation: { ...DEFAULT_FIREWALL_CONFIG.crossValidation, ...config?.crossValidation },
    };
  }

  setCrossValidator(fn: CrossValidationFn): void {
    this.crossValidator = fn;
  }

  // ─── Main Interception Methods ──────────────────────────────

  /**
   * Intercept an event before it enters MemoryBus.
   * Scores contamination, sets quarantine level.
   */
  async intercept(event: MemoryEvent): Promise<MemoryEvent> {
    // Compute contamination score
    const score = this.computeScore(event);
    event.contamination.suspicion_score = score;

    // Determine quarantine level
    const oldLevel = event.contamination.quarantine_level;
    event.contamination.quarantine_level = this.determineQuarantine(score);

    if (oldLevel !== event.contamination.quarantine_level) {
      this.quarantineLog.push({
        timestamp: new Date().toISOString(),
        eventId: event.id,
        from: oldLevel,
        to: event.contamination.quarantine_level,
        reason: `score=${score.toFixed(3)}`,
      });
    }

    // Run cross-validation if enabled and event is suspicious
    if (this.config.crossValidation.enabled &&
        event.contamination.quarantine_level === 'suspicious' &&
        this.crossValidator) {
      const result = await this.crossValidator(event);
      if (!result.verified) {
        event.contamination.quarantine_level = 'isolated';
        event.contamination.suspicion_score = Math.max(score, 0.55);
        event.contamination.validated_by = result.models;
        this.quarantineLog.push({
          timestamp: new Date().toISOString(),
          eventId: event.id,
          from: 'suspicious',
          to: 'isolated',
          reason: `cross-validation failed: ${result.models.join(', ')}`,
        });
      } else {
        event.contamination.quarantine_level = 'clean';
        event.contamination.suspicion_score = Math.min(score, 0.18);
        event.contamination.validated_by = result.models;
        event.contamination.last_validated = new Date().toISOString();
      }
    }

    return event;
  }

  /**
   * Filter events on read: exclude isolated/purged, apply contamination penalties.
   */
  filterRead(events: MemoryEvent[], includeIsolated = false): MemoryEvent[] {
    return events.filter(e => {
      const q = e.contamination.quarantine_level;
      if (q === 'purged') return false;
      if (q === 'isolated' && !includeIsolated) return false;
      return true;
    });
  }

  /**
   * Compute the contamination penalty for display/ranking.
   */
  computePenalty(event: MemoryEvent): number {
    const score = event.contamination.suspicion_score;
    return 1 - score; // S'(t) = S(t) × (1-C) where C = suspicion_score
  }

  // ─── Propagation Tracking ───────────────────────────────────

  /**
   * Register a dependency: downstreamEventId depends on sourceEventId.
   * If source is contaminated, downstream gets a penalty.
   */
  registerDependency(sourceEventId: string, downstreamEventId: string): void {
    const existing = this.propagationGraph.get(sourceEventId) || [];
    if (!existing.includes(downstreamEventId)) {
      existing.push(downstreamEventId);
      this.propagationGraph.set(sourceEventId, existing);
    }
  }

  /**
   * Propagate contamination from a source event to all dependents.
   */
  propagate(sourceEvent: MemoryEvent, getEvent: (id: string) => MemoryEvent | undefined): ContaminationPropagation {
    const downstream = this.propagationGraph.get(sourceEvent.id) || [];
    const propagation: ContaminationPropagation = {
      sourceEventId: sourceEvent.id,
      sourceScore: sourceEvent.contamination.suspicion_score,
      downstreamEvents: [],
    };

    for (const destId of downstream) {
      const dest = getEvent(destId);
      if (!dest) continue;

      const originalScore = dest.contamination.suspicion_score;
      // Penalty = source score × 0.7 (diminishing factor)
      const penalty = sourceEvent.contamination.suspicion_score * 0.7;
      const newScore = Math.min(1, originalScore + penalty);

      dest.contamination.suspicion_score = newScore;
      dest.contamination.quarantine_level = this.determineQuarantine(newScore);

      propagation.downstreamEvents.push({
        eventId: destId,
        originalScore,
        propagatedPenalty: penalty,
        newScore,
      });
    }

    return propagation;
  }

  getPropagationGraph(): Map<string, string[]> {
    return this.propagationGraph;
  }

  // ─── Quarantine Management ──────────────────────────────────

  getQuarantineLog(): typeof this.quarantineLog {
    return this.quarantineLog;
  }

  getQuarantineStats(events: MemoryEvent[]): Record<QuarantineLevel, number> {
    const stats: Record<QuarantineLevel, number> = { clean: 0, suspicious: 0, isolated: 0, purged: 0 };
    events.forEach(e => stats[e.contamination.quarantine_level]++);
    return stats;
  }

  // ─── Verification Decay ─────────────────────────────────────

  /**
   * Check if an event needs re-validation (based on 7-day half-life).
   */
  needsRevalidation(event: MemoryEvent, currentTime = new Date()): boolean {
    if (!event.contamination.last_validated) return true;
    const validated = new Date(event.contamination.last_validated);
    const daysSince = (currentTime.getTime() - validated.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7; // τ = 7 days
  }

  getVerificationAge(event: MemoryEvent): number {
    if (!event.contamination.last_validated) return Infinity;
    const validated = new Date(event.contamination.last_validated);
    return (Date.now() - validated.getTime()) / (1000 * 60 * 60 * 24);
  }

  // ─── Private Helpers ────────────────────────────────────────

  private computeScore(event: MemoryEvent): number {
    const { w1_source, w2_hallucination, w3_staleness, w4_depth } = this.config.weights;
    
    // Source trustworthiness (from provenance)
    const sourceMap: Record<string, number> = { user: 0.05, system: 0.1, tool: 0.2, llm: 0.4 };
    const sourceTrust = sourceMap[event.provenance.source_type] || 0.3;

    // Hallucination likelihood (derived from confidence)
    const hallucination = 1 - event.provenance.confidence;

    // Staleness (time decay)
    const ageMs = Date.now() - new Date(event.timestamp).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const staleness = Math.min(1, ageDays / 30); // max out at 30 days

    // Depth penalty
    const depth = Math.min(event.provenance.depth / 5, 1); // max out at 5 hops

    return w1_source * sourceTrust + w2_hallucination * hallucination +
           w3_staleness * staleness + w4_depth * depth;
  }

  private determineQuarantine(score: number): QuarantineLevel {
    if (score >= this.config.thresholds.purged) return 'purged';
    if (score >= this.config.thresholds.isolated) return 'isolated';
    if (score >= this.config.thresholds.suspicious) return 'suspicious';
    return 'clean';
  }
}
