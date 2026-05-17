/**
 * AHE v3.0 — Signal Mixer
 * 
 * Independent, reusable multi-source signal fusion component.
 * Inspired by x-algorithm's Home Mixer (weighted blending of signals).
 * 
 * Architecture:
 *   Stage 1: Heuristic fast pre-filter (extremely low cost)
 *   Stage 2: LanceDB historical similarity check (low cost)
 *   Stage 3: Firewall specialized risk check (medium cost)
 *   Stage 4: LLM final synthesis (high cost, only when needed)
 * 
 * Goal: 70%+ candidates resolved in stages 1-3, no LLM needed.
 */

import {
  SignalBundle, FusedDecision, MixerConfig, DEFAULT_MIXER_CONFIG,
  ChangeImpactVector, PhoenixRecommendation,
  HeuristicSignal, LanceDBSignal, FirewallSignal, LLMSignal,
} from './types_phoenix.js';

export class SignalMixer {
  private config: MixerConfig;
  private llmCallCount = 0;
  private totalCalls = 0;

  constructor(config?: Partial<MixerConfig>) {
    this.config = {
      ...DEFAULT_MIXER_CONFIG,
      ...config,
      weights: { ...DEFAULT_MIXER_CONFIG.weights, ...config?.weights },
      cascadeThresholds: { ...DEFAULT_MIXER_CONFIG.cascadeThresholds, ...config?.cascadeThresholds },
    };
  }

  // ─── Main Entry Point ──────────────────────────────────────

  /**
   * Fuse multiple signals into a single decision.
   * Implements 4-stage cascade: heuristic → lance → firewall → llm.
   */
  async mix(signals: SignalBundle): Promise<FusedDecision> {
    this.totalCalls++;
    const startTime = Date.now();

    // Stage 1: Heuristic fast pre-filter
    const heuristicResult = this.stage1Heuristic(signals.heuristic);
    if (heuristicResult) {
      return { ...heuristicResult, signalBreakdown: this.computeBreakdown(signals, null) };
    }

    // Stage 2: LanceDB historical similarity
    const lanceResult = this.stage2Lance(signals.lance);
    if (lanceResult && this.config.escalateCondition === 'cascade') {
      return { ...lanceResult, signalBreakdown: this.computeBreakdown(signals, null) };
    }

    // Stage 3: Firewall specialized risk check
    const firewallDecision = this.stage3Firewall(signals.firewall);

    // Stage 4: Conflict detection + optional LLM escalation
    const conflicts = this.detectConflicts(signals);
    const shouldEscalate = this.shouldEscalateToLLM(signals, conflicts, firewallDecision);

    if (shouldEscalate && signals.llm) {
      this.llmCallCount++;
      return this.fuseWithLLM(signals, conflicts);
    }

    // Default: weighted combine without LLM
    return this.weightedCombine(signals, conflicts);
  }

  // ─── Stage 1: Heuristic ───────────────────────────────────

  private stage1Heuristic(h: HeuristicSignal): FusedDecision | null {
    // Hard block: extremely high risk or very low confidence
    if (h.risk > 85 || h.confidence < 0.3) {
      return {
        impact: this.makeImpactFromRisk(h.risk, 0),
        recommendation: 'reject',
        reasoning: `Heuristic block: risk=${h.risk}, confidence=${h.confidence.toFixed(2)}`,
        primarySignal: 'heuristic',
        signalBreakdown: this.computeBreakdown(
          { heuristic: h, lance: this.emptyLance(), firewall: this.emptyFirewall() },
          null
        ),
        conflictDetected: false,
      };
    }

    // Cascade stop: if below threshold, skip further stages
    if (this.config.escalateCondition === 'cascade' && h.risk < this.config.cascadeThresholds.heuristic) {
      return {
        impact: this.makeImpactFromRisk(h.risk, h.confidence),
        recommendation: h.risk < 20 ? 'accept' : 'accept_with_monitoring',
        reasoning: `Heuristic clear: risk=${h.risk} < threshold=${this.config.cascadeThresholds.heuristic}`,
        primarySignal: 'heuristic',
        signalBreakdown: this.computeBreakdown(
          { heuristic: h, lance: this.emptyLance(), firewall: this.emptyFirewall() },
          null
        ),
        conflictDetected: false,
      };
    }

    return null; // continue to next stage
  }

  // ─── Stage 2: LanceDB Historical Similarity ───────────────

  private stage2Lance(l: LanceDBSignal): FusedDecision | null {
    // High failure rate in similar historical cases → caution
    if (l.failureRate > 0.65 && l.confidence > 0.7 && l.matchedCases >= 3) {
      return {
        impact: this.makeImpactFromRisk(50, l.confidence),
        recommendation: 'accept_with_monitoring',
        reasoning: `Historical high failure: ${(l.failureRate * 100).toFixed(0)}% in ${l.matchedCases} similar cases`,
        primarySignal: 'lance',
        signalBreakdown: this.computeBreakdown(
          { heuristic: this.emptyHeuristic(), lance: l, firewall: this.emptyFirewall() },
          null
        ),
        conflictDetected: false,
      };
    }

    // Cascade stop: low failure rate in similar cases
    if (this.config.escalateCondition === 'cascade' &&
        l.failureRate < this.config.cascadeThresholds.lance &&
        l.matchedCases >= 3) {
      return {
        impact: this.makeImpactFromRisk(l.failureRate * 30, l.confidence),
        recommendation: 'accept',
        reasoning: `Historical success: ${l.matchedCases} similar cases, ${(l.failureRate * 100).toFixed(0)}% failure rate`,
        primarySignal: 'lance',
        signalBreakdown: this.computeBreakdown(
          { heuristic: this.emptyHeuristic(), lance: l, firewall: this.emptyFirewall() },
          null
        ),
        conflictDetected: false,
      };
    }

    return null; // continue
  }

  // ─── Stage 3: Firewall ────────────────────────────────────

  private stage3Firewall(f: FirewallSignal): { decision: string; riskScore: number } {
    if (f.decision === 'block') {
      return { decision: 'block', riskScore: f.riskScore };
    }
    if (f.decision === 'warn') {
      return { decision: 'warn', riskScore: f.riskScore };
    }
    return { decision: 'allow', riskScore: f.riskScore };
  }

  // ─── Conflict Detection ───────────────────────────────────

  private detectConflicts(signals: SignalBundle): string[] {
    const conflicts: string[] = [];
    const { heuristic, lance, firewall } = signals;

    // Firewall says safe but LanceDB shows high failure → conflict
    if (firewall.riskScore < 30 && lance.failureRate > 0.6 && lance.matchedCases >= 3) {
      conflicts.push(`Firewall safe (risk=${firewall.riskScore}) vs LanceDB high failure (${(lance.failureRate*100).toFixed(0)}%)`);
    }

    // Heuristic says safe but Firewall says risky → conflict
    if (heuristic.risk < 20 && firewall.riskScore > 50) {
      conflicts.push(`Heuristic safe (risk=${heuristic.risk}) vs Firewall risky (score=${firewall.riskScore})`);
    }

    // LanceDB high confidence says safe but Firewall flags issues → conflict
    if (lance.failureRate < 0.2 && lance.confidence > 0.8 && firewall.decision === 'warn') {
      conflicts.push(`LanceDB safe (failure=${(lance.failureRate*100).toFixed(0)}%) vs Firewall warning`);
    }

    // Calculate overall signal divergence
    const signals_arr = [heuristic.risk, lance.failureRate * 100, firewall.riskScore];
    const mean = signals_arr.reduce((a, b) => a + b, 0) / signals_arr.length;
    const variance = signals_arr.reduce((s, v) => s + (v - mean) ** 2, 0) / signals_arr.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > this.config.conflictThreshold * 100) {
      conflicts.push(`High signal divergence: σ=${stdDev.toFixed(1)}`);
    }

    return conflicts;
  }

  private shouldEscalateToLLM(
    signals: SignalBundle,
    conflicts: string[],
    firewallResult: { decision: string; riskScore: number }
  ): boolean {
    switch (this.config.escalateCondition) {
      case 'always':
        return !!signals.llm;
      case 'conflict_only':
        return conflicts.length > 0 && !!signals.llm;
      case 'high_uncertainty':
        return (conflicts.length > 0 || signals.lance.uncertainty > 0.5) && !!signals.llm;
      case 'cascade':
        // Cascade: LLM only when earlier stages couldn't resolve
        return firewallResult.decision !== 'block' &&
               (conflicts.length > 0 || firewallResult.riskScore > 55) &&
               !!signals.llm;
      default:
        return false;
    }
  }

  // ─── Fusion Methods ───────────────────────────────────────

  private fuseWithLLM(signals: SignalBundle, conflicts: string[]): FusedDecision {
    const llm = signals.llm!;
    
    return {
      impact: llm.impactVector,
      recommendation: this.resolveRecommendation(llm.recommendation, signals.firewall),
      reasoning: `${llm.reasoning}\n\n[Signals fused by LLM. Conflicts: ${conflicts.length > 0 ? conflicts.join('; ') : 'none'}]`,
      primarySignal: 'fused',
      signalBreakdown: this.computeBreakdown(signals, llm),
      conflictDetected: conflicts.length > 0,
      conflictResolution: conflicts.length > 0
        ? `Resolved by LLM synthesis: ${llm.reasoning.slice(0, 200)}`
        : undefined,
    };
  }

  private weightedCombine(signals: SignalBundle, conflicts: string[]): FusedDecision {
    const { heuristic, lance, firewall } = signals;
    const w = this.config.weights;

    // Compute weighted risk
    const combinedRisk = (
      w.heuristic * heuristic.risk +
      w.lance * lance.failureRate * 100 +
      w.firewall * firewall.riskScore +
      w.llm * 0  // no LLM contribution
    ) / (w.heuristic + w.lance + w.firewall);

    // Compute combined confidence
    const combinedConfidence = (
      w.heuristic * heuristic.confidence +
      w.lance * lance.confidence +
      w.firewall * (1 - firewall.riskScore / 100)
    ) / (w.heuristic + w.lance + w.firewall);

    const impact: ChangeImpactVector = {
      efficiency_gain: heuristic.details.historicalSuccessRate * 20 - combinedRisk * 0.3,
      accuracy_delta: (1 - lance.failureRate) * 10 - combinedRisk * 0.2,
      maintainability_score: heuristic.details.isCoreFile ? 60 : 80,
      risk_level: Math.min(100, combinedRisk),
      confidence: combinedConfidence,
    };

    let recommendation: PhoenixRecommendation;
    if (firewall.decision === 'block') {
      recommendation = 'reject';
    } else if (combinedRisk > 65) {
      recommendation = 'reject';
    } else if (combinedRisk > 35 || conflicts.length > 0) {
      recommendation = 'accept_with_monitoring';
    } else if (combinedConfidence > 0.8) {
      recommendation = 'accept';
    } else {
      recommendation = 'accept_with_monitoring';
    }

    const primarySignal = firewall.riskScore > 40 ? 'firewall' :
                          lance.failureRate > 0.4 ? 'lance' : 'heuristic';

    return {
      impact,
      recommendation,
      reasoning: `Weighted combine: risk=${combinedRisk.toFixed(1)}, confidence=${combinedConfidence.toFixed(2)}, firewall=${firewall.decision}`,
      primarySignal,
      signalBreakdown: this.computeBreakdown(signals, null),
      conflictDetected: conflicts.length > 0,
      conflictResolution: conflicts.length > 0 ? `Conservative: accept_with_monitoring due to ${conflicts.length} conflict(s)` : undefined,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private resolveRecommendation(llmRec: PhoenixRecommendation, firewall: FirewallSignal): PhoenixRecommendation {
    // Firewall has veto power
    if (firewall.decision === 'block') return 'reject';
    // If LLM says accept but firewall warns, demote to monitoring
    if (llmRec === 'accept' && firewall.decision === 'warn') return 'accept_with_monitoring';
    return llmRec;
  }

  private computeBreakdown(signals: SignalBundle, llm?: LLMSignal | null): FusedDecision['signalBreakdown'] {
    const w = this.config.weights;
    const total = w.heuristic + w.lance + w.firewall + (llm ? w.llm : 0);
    return {
      heuristicContribution: w.heuristic / total,
      lanceContribution: w.lance / total,
      firewallContribution: w.firewall / total,
      llmContribution: llm ? w.llm / total : 0,
    };
  }

  private makeImpactFromRisk(risk: number, confidence: number): ChangeImpactVector {
    return {
      efficiency_gain: -risk * 0.5,
      accuracy_delta: -risk * 0.3,
      maintainability_score: 100 - risk,
      risk_level: risk,
      confidence,
    };
  }

  private emptyHeuristic(): HeuristicSignal {
    return { risk: 0, confidence: 1, details: { linesChanged: 0, filesAffected: 0, isCoreFile: false, historicalSuccessRate: 1 } };
  }

  private emptyLance(): LanceDBSignal {
    return { similarityScore: 1, failureRate: 0, confidence: 0, uncertainty: 1, matchedCases: 0, similarCaseIds: [] };
  }

  private emptyFirewall(): FirewallSignal {
    return { riskScore: 0, decision: 'allow', reasons: [], details: { sourceTrust: 1, hallucinationRisk: 0, stalenessPenalty: 0, depthPenalty: 0 } };
  }

  // ─── Accessors ────────────────────────────────────────────

  getLLMCallRatio(): number {
    return this.totalCalls > 0 ? this.llmCallCount / this.totalCalls : 0;
  }

  getStats(): { totalCalls: number; llmCalls: number; ratio: number } {
    return {
      totalCalls: this.totalCalls,
      llmCalls: this.llmCallCount,
      ratio: this.getLLMCallRatio(),
    };
  }
}
