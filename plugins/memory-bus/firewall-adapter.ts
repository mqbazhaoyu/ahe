/**
 * AHE v3.0 — Contamination Firewall Dual-Role Adapter
 * 
 * Wraps the existing ContaminationFirewall middleware to provide:
 *   1. evaluateLight(mutation) → fast check for Candidate Pipeline Stage 2
 *   2. evaluate(mutation) → full check for Phoenix/Mixer deep evaluation
 * 
 * This enables Phoenix to call Firewall as a specialized checker,
 * while Firewall retains its existing middleware role on MemoryBus.
 */

import { ContaminationFirewall } from './contamination-firewall.js';
import type { FirewallSignal } from './types_phoenix.js';
import type { MutationCandidate } from './types_phoenix.js';
import { MemoryEvent } from './types.js';

export class FirewallAdapter {
  private firewall: ContaminationFirewall;

  constructor(firewall: ContaminationFirewall) {
    this.firewall = firewall;
  }

  /**
   * Light evaluation for Candidate Pipeline Stage 2.
   * Only runs fast checks: source trust + basic hallucination risk.
   * Returns within ~10ms.
   */
  async evaluateLight(mutation: MutationCandidate): Promise<FirewallSignal> {
    // Create a minimal MemoryEvent for quick scoring
    const mockEvent: Partial<MemoryEvent> = {
      id: `pipeline-${mutation.id}`,
      timestamp: new Date().toISOString(),
      content: mutation.description,
      provenance: {
        source_type: mutation.source.includes('crystallizer') ? 'tool' :
                     mutation.source.includes('dreaming') ? 'system' : 'llm',
        confidence: mutation.priority / 100,
        depth: mutation.scope === 'global' ? 2 : 1,
        source: mutation.source,
        timestamp: mutation.createdAt,
        validated: false,
      },
      contamination: {
        suspicion_score: 0,
        quarantine_level: 'clean',
        source: 'firewall-light',
        detected_at: new Date().toISOString(),
        reason: '',
      },
      metadata: {},
    };

    // Run through firewall intercept to get score
    const scored = await this.firewall.intercept(mockEvent as MemoryEvent);
    const riskScore = scored.contamination.suspicion_score * 100;

    // Light mode: only use source trust and basic hallucination signals
    const sourceTrust = 1 - this.mapSourceRisk(mutation);
    const hallucinationRisk = mutation.type === 'skill_generation' ? 0.4 :
                              mutation.type === 'prompt_modification' ? 0.3 : 0.15;

    return {
      riskScore: Math.round((riskScore * 0.5 + hallucinationRisk * 50)),
      decision: riskScore > 50 ? 'block' : riskScore > 25 ? 'warn' : 'allow',
      reasons: riskScore > 25 ? [`Risk score: ${riskScore.toFixed(1)}/100`] : [],
      details: {
        sourceTrust,
        hallucinationRisk,
        stalenessPenalty: 0, // not checked in light mode
        depthPenalty: mutation.scope === 'global' ? 0.1 : 0,
      },
    };
  }

  /**
   * Full evaluation for Phoenix deep evaluation.
   * Runs all checks: all 4 dimensions + cross-validation if enabled.
   * Returns within ~50ms (without cross-validation) or ~200ms (with).
   */
  async evaluate(mutation: MutationCandidate): Promise<FirewallSignal> {
    const mockEvent: Partial<MemoryEvent> = {
      id: `phoenix-${mutation.id}`,
      timestamp: mutation.createdAt,
      content: `${mutation.description}\n\nDiff:\n${mutation.proposedChange.diff}`,
      provenance: {
        source_type: mutation.source.includes('crystallizer') ? 'tool' :
                     mutation.source.includes('dreaming') ? 'system' : 'llm',
        confidence: mutation.priority / 100,
        depth: mutation.scope === 'global' ? 3 : 1,
        source: mutation.source,
        timestamp: mutation.createdAt,
        validated: false,
      },
      contamination: {
        suspicion_score: 0,
        quarantine_level: 'clean',
        source: 'firewall-full',
        detected_at: new Date().toISOString(),
        reason: '',
      },
      metadata: {
        mutationType: mutation.type,
        affectedFiles: mutation.proposedChange.affectedFiles,
        isGlobal: mutation.scope === 'global',
      },
    };

    // Full firewall intercept
    const scored = await this.firewall.intercept(mockEvent as MemoryEvent);
    const riskScore = scored.contamination.suspicion_score * 100;

    // Compute all 4 dimensions
    const sourceTrust = 1 - this.mapSourceRisk(mutation);
    const hallucinationRisk = this.computeHallucinationRisk(mutation);
    const stalenessPenalty = this.computeStaleness(mutation);
    const depthPenalty = this.computedepthPenalty(mutation);

    return {
      riskScore: Math.round(riskScore),
      decision: riskScore > 50 ? 'block' : riskScore > 25 ? 'warn' : 'allow',
      reasons: this.buildReasons(riskScore, sourceTrust, hallucinationRisk, stalenessPenalty, depthPenalty),
      details: {
        sourceTrust,
        hallucinationRisk,
        stalenessPenalty,
        depthPenalty,
      },
    };
  }

  // ─── Risk Mappings ───────────────────────────────────────

  private mapSourceRisk(mutation: MutationCandidate): number {
    if (mutation.source.includes('crystallizer')) return 0.15; // crystallizer is usually good
    if (mutation.source.includes('dreaming-phase-4')) return 0.2;
    if (mutation.source.includes('dreaming-phase-5')) return 0.25; // pruning can be aggressive
    if (mutation.source.includes('manual')) return 0.1; // human is trusted
    return 0.3;
  }

  private computeHallucinationRisk(mutation: MutationCandidate): number {
    // Skill generation has highest hallucination risk
    if (mutation.type === 'skill_generation') return 0.4;
    if (mutation.type === 'prompt_modification') return 0.3;
    if (mutation.type === 'rule_change') return 0.2;
    if (mutation.type === 'parameter_tuning') return 0.1;
    return 0.15;
  }

  private computeStaleness(mutation: MutationCandidate): number {
    const ageMs = Date.now() - new Date(mutation.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return Math.min(0.3, ageDays / 30); // max 0.3 at 30 days
  }

  private computedepthPenalty(mutation: MutationCandidate): number {
    if (mutation.scope === 'global') return 0.15;
    return mutation.proposedChange.affectedFiles.length > 3 ? 0.1 : 0;
  }

  private buildReasons(
    riskScore: number,
    sourceTrust: number,
    hallucinationRisk: number,
    stalenessPenalty: number,
    depthPenalty: number
  ): string[] {
    const reasons: string[] = [];
    if (riskScore > 40) reasons.push(`Elevated contamination risk: ${riskScore.toFixed(0)}/100`);
    if (sourceTrust < 0.8) reasons.push(`Low source trust: ${sourceTrust.toFixed(2)}`);
    if (hallucinationRisk > 0.3) reasons.push(`Hallucination risk: ${hallucinationRisk.toFixed(2)}`);
    if (stalenessPenalty > 0.1) reasons.push(`Staleness penalty: ${stalenessPenalty.toFixed(2)}`);
    if (depthPenalty > 0.1) reasons.push(`Depth penalty: ${depthPenalty.toFixed(2)} (global change)`);
    return reasons;
  }

  // ─── Accessors ──────────────────────────────────────────

  getFirewall(): ContaminationFirewall {
    return this.firewall;
  }
}
