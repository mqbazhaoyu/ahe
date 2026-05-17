/**
 * AHE v3.0 — Phoenix Evaluator
 * 
 * Multi-objective change impact evaluator inspired by x-algorithm's Phoenix.
 * Upgrades AHE's binary pass/fail verdict to a 4-dimensional ChangeImpactVector.
 * 
 * Key features:
 *   - Multi-dimensional impact prediction (efficiency, accuracy, maintainability, risk)
 *   - 4-tier recommendation (accept / accept_with_monitoring / reject / human_review)
 *   - User-type-aware evaluation (commerce: game dev vs musician vs programmer vs trader)
 *   - Feedback loop: tracks prediction vs actual outcome
 *   - Legacy 9-state ChangeMatrix mapping for backward compatibility
 *   - Exploration budget: 15-25% of candidates get exploratory passes
 * 
 * Depends on: SignalMixer, ContaminationFirewall (via firewall-adapter)
 */

import {
  ChangeImpactVector, PhoenixRecommendation, MutationCandidate,
  PhoenixEvaluationRequest, PhoenixEvaluationResult,
  PhoenixHistoricalCase, PhoenixConfig, DEFAULT_PHOENIX_CONFIG,
  PredictionOutcomeRecord, PhoenixPerformanceMetrics,
  UserType, MutationType,
} from './types_phoenix.js';
import { SignalMixer } from './signal-mixer.js';
import type { HeuristicSignal, LanceDBSignal, FirewallSignal, LLMSignal, SignalBundle } from './types_phoenix.js';

/** Function signature for external LLM calls */
export type LLMCallFn = (prompt: string) => Promise<string>;

/** Function signature for LanceDB similarity queries */
export type LanceQueryFn = (mutation: MutationCandidate) => Promise<LanceDBSignal>;

/** Function signature for Firewall evaluation */
export type FirewallEvalFn = (mutation: MutationCandidate) => Promise<FirewallSignal>;

export class PhoenixEvaluator {
  private config: PhoenixConfig;
  private mixer: SignalMixer;
  private llmCall: LLMCallFn | null = null;
  private lanceQuery: LanceQueryFn | null = null;
  private firewallEval: FirewallEvalFn | null = null;

  // Tracking
  private evaluationHistory: PhoenixEvaluationResult[] = [];
  private predictionOutcomes: PredictionOutcomeRecord[] = [];
  private explorationUsed = 0;
  private explorationTotal = 0;

  constructor(config?: Partial<PhoenixConfig>) {
    this.config = {
      ...DEFAULT_PHOENIX_CONFIG,
      ...config,
      coldStartExamples: config?.coldStartExamples || [],
    };
    this.mixer = new SignalMixer();
  }

  setLLMCall(fn: LLMCallFn): void { this.llmCall = fn; }
  setLanceQuery(fn: LanceQueryFn): void { this.lanceQuery = fn; }
  setFirewallEval(fn: FirewallEvalFn): void { this.firewallEval = fn; }

  // ─── Main Evaluation Entry Point ──────────────────────────

  async evaluate(request: PhoenixEvaluationRequest): Promise<PhoenixEvaluationResult> {
    const startTime = Date.now();
    let tokenCost = 0;

    // 1. Build signals
    const heuristic = this.computeHeuristic(request.mutation);
    const lance = this.lanceQuery ? await this.lanceQuery(request.mutation) : this.emptyLance();
    const firewall = this.firewallEval ? await this.firewallEval(request.mutation) : this.emptyFirewall();

    // 2. Determine if LLM call is needed
    let llmSignal: LLMSignal | undefined;
    const needsLLM = this.needsLLMEvaluation(heuristic, lance, firewall, request);

    if (needsLLM && this.llmCall) {
      const prompt = this.buildEvaluationPrompt(request, heuristic, lance, firewall);
      const response = await this.llmCall(prompt);
      llmSignal = this.parseLLMResponse(response, request.mutation);
      tokenCost = this.estimateTokens(prompt);
    }

    // 3. Fuse signals through Mixer
    const signalBundle: SignalBundle = { heuristic, lance, firewall, llm: llmSignal };
    const fused = await this.mixer.mix(signalBundle);

    // 4. Apply exploration budget
    let recommendation = fused.recommendation;
    if (this.shouldExplore(fused.recommendation, fused.impact)) {
      recommendation = 'accept_with_monitoring';
      fused.impact.confidence *= 0.7; // reduced confidence for exploration
      this.explorationUsed++;
    }
    this.explorationTotal++;

    // 5. Build result
    const result: PhoenixEvaluationResult = {
      mutationId: request.mutation.id,
      impact: fused.impact,
      recommendation,
      reasoning: fused.reasoning +
        (recommendation !== fused.recommendation ? ` [Exploration: conservatively approved despite original ${fused.recommendation}]` : ''),
      suggestedMonitoringDays: recommendation === 'accept_with_monitoring'
        ? this.suggestMonitoringDays(fused.impact.risk_level)
        : undefined,
      legacyState: this.config.legacyStateMapping
        ? this.mapToLegacyState(fused.impact, recommendation)
        : undefined,
      evaluationTimeMs: Date.now() - startTime,
      tokenCost,
    };

    this.evaluationHistory.push(result);
    return result;
  }

  /**
   * Batch evaluation for multiple candidates (used by Candidate Pipeline).
   */
  async evaluateBatch(requests: PhoenixEvaluationRequest[]): Promise<PhoenixEvaluationResult[]> {
    const results: PhoenixEvaluationResult[] = [];
    for (const req of requests) {
      results.push(await this.evaluate(req));
    }
    return results;
  }

  // ─── Feedback Loop ────────────────────────────────────────

  /**
   * Record the actual outcome of a Phoenix-evaluated mutation.
   * This closes the feedback loop: prediction → actual → stored → future calibration.
   */
  recordOutcome(mutationId: string, actualOutcome: PredictionOutcomeRecord['actualOutcome']): PredictionOutcomeRecord | null {
    const prediction = this.evaluationHistory.find(e => e.mutationId === mutationId);
    if (!prediction) return null;

    const record: PredictionOutcomeRecord = {
      mutationId,
      phoenixPrediction: prediction.impact,
      phoenixRecommendation: prediction.recommendation,
      actualOutcome,
      predictionError: {
        efficiencyError: Math.abs(prediction.impact.efficiency_gain - actualOutcome.efficiencyChange),
        accuracyError: Math.abs(prediction.impact.accuracy_delta - actualOutcome.accuracyChange),
        riskError: Math.abs(prediction.impact.risk_level - (actualOutcome.wasRolledBack ? 100 : 0)),
        maintainabilityError: 0, // hard to measure short-term
        mae: 0, // computed below
      },
      timestamp: new Date().toISOString(),
    };

    record.predictionError.mae = (
      record.predictionError.efficiencyError +
      record.predictionError.accuracyError +
      record.predictionError.riskError +
      record.predictionError.maintainabilityError
    ) / 4;

    this.predictionOutcomes.push(record);
    return record;
  }

  // ─── Performance Metrics ──────────────────────────────────

  getPerformanceMetrics(): PhoenixPerformanceMetrics {
    const recent = this.predictionOutcomes.slice(-10);
    const recentMAE = recent.length > 0
      ? recent.reduce((s, r) => s + r.predictionError.mae, 0) / recent.length
      : 0;

    const overConservative = this.predictionOutcomes.filter(
      r => r.phoenixRecommendation === 'reject' && !r.actualOutcome.wasRolledBack
    ).length;
    const underConservative = this.predictionOutcomes.filter(
      r => (r.phoenixRecommendation === 'accept' || r.phoenixRecommendation === 'accept_with_monitoring') &&
           r.actualOutcome.wasRolledBack
    ).length;

    return {
      totalEvaluations: this.evaluationHistory.length,
      accuracyTrend: this.predictionOutcomes.map(r => r.predictionError.mae),
      recentMAE,
      overConservativeRate: this.evaluationHistory.length > 0
        ? overConservative / this.evaluationHistory.length : 0,
      underConservativeRate: this.evaluationHistory.length > 0
        ? underConservative / this.evaluationHistory.length : 0,
      explorationBudgetUsed: this.explorationTotal > 0
        ? this.explorationUsed / this.explorationTotal : 0,
      llmCallCount: this.mixer.getStats().llmCalls,
      totalTokenCost: this.evaluationHistory.reduce((s, e) => s + (e.tokenCost || 0), 0),
      lastUpdated: new Date().toISOString(),
    };
  }

  // ─── Signal Computation (Heuristic) ───────────────────────

  private computeHeuristic(mutation: MutationCandidate): HeuristicSignal {
    const diffLines = mutation.proposedChange.diff.split('\n').length;
    const fileCount = mutation.proposedChange.affectedFiles.length;
    const isCoreFile = mutation.proposedChange.affectedFiles.some(
      f => f.includes('SKILL.md') || f.includes('system-rules') || f.includes('tool-policies')
    );

    // Historical success rate by mutation type (rough baseline)
    const typeSuccessRates: Record<MutationType, number> = {
      rule_change: 0.6,
      skill_generation: 0.55,
      parameter_tuning: 0.5,
      prompt_modification: 0.45,
      component_refactor: 0.35,
    };

    const successRate = typeSuccessRates[mutation.type] || 0.5;

    // Risk heuristic
    let risk = 0;
    risk += Math.min(30, diffLines * 3);     // more lines = more risk
    risk += fileCount > 2 ? 15 : fileCount * 5; // more files = more risk
    risk += isCoreFile ? 25 : 0;             // core files = high risk
    risk -= successRate * 20;                // known-successful type = less risk
    risk += mutation.scope === 'global' ? 15 : 0; // global changes are riskier

    return {
      risk: Math.max(0, Math.min(100, risk)),
      confidence: 0.5 + successRate * 0.3,
      details: {
        linesChanged: diffLines,
        filesAffected: fileCount,
        isCoreFile,
        historicalSuccessRate: successRate,
      },
    };
  }

  // ─── LLM Integration ──────────────────────────────────────

  private needsLLMEvaluation(
    heuristic: HeuristicSignal,
    lance: LanceDBSignal,
    firewall: FirewallSignal,
    request: PhoenixEvaluationRequest
  ): boolean {
    // Always call LLM in LLM mode
    if (this.config.mode === 'llm') return true;
    // Hybrid: call LLM when uncertainty is high
    if (this.config.mode === 'hybrid') {
      if (firewall.decision === 'block') return false; // firewall blocks → no LLM needed
      if (heuristic.confidence < 0.5) return true;
      if (lance.uncertainty > 0.5) return true;
      if (heuristic.risk > 50) return true;
      if (firewall.riskScore > 45) return true;
      if (request.explorationMode) return false; // exploration → skip LLM
      return false;
    }
    // Distilled mode: no LLM
    return false;
  }

  private buildEvaluationPrompt(
    request: PhoenixEvaluationRequest,
    heuristic: HeuristicSignal,
    lance: LanceDBSignal,
    firewall: FirewallSignal
  ): string {
    const m = request.mutation;

    // Cold start examples
    const examplesBlock = this.config.coldStartExamples.length > 0
      ? `\n【参考案例】\n${this.config.coldStartExamples.map(ex =>
          `- 类型:${ex.mutationType} | 预测:efficiency=${ex.impact.efficiency_gain}, accuracy=${ex.impact.accuracy_delta}, risk=${ex.impact.risk_level} | 推荐:${ex.recommendation} | 实际:${ex.actualOutcome?.finalState || 'pending'}`
        ).join('\n')}`
      : '';

    // User type context (commerce)
    const userTypeBlock = m.targetUsers && m.targetUsers.length > 0
      ? `\n目标用户类型：${m.targetUsers.join('、')}。请考虑不同用户类型对变更的敏感度差异。`
      : '';

    return `你是 AHE 系统变更影响评估专家（Phoenix Evaluator）。

当前要评估的 mutation 类型：${m.type}
变更范围：${m.scope}${userTypeBlock}

【变更内容】
${m.description}

【修改详情】
- 组件：${m.proposedChange.component}
- 修改类型：${m.proposedChange.changeType}
- 影响文件：${m.proposedChange.affectedFiles.join(', ')}
- Diff 行数：${heuristic.details.linesChanged}

【快速评估信号】
- 启发式风险：${heuristic.risk}/100（置信度 ${heuristic.confidence.toFixed(2)}）
- 历史相似案例失败率：${(lance.failureRate * 100).toFixed(0)}%（${lance.matchedCases} 个案例）
- 污染防火墙风险：${firewall.riskScore}/100（判定：${firewall.decision}）
- 防火墙详情：来源可信度=${firewall.details.sourceTrust}，幻觉风险=${firewall.details.hallucinationRisk}

${examplesBlock}

请输出 JSON 格式的评估结果（不要输出其他内容）：
{
  "impact": {
    "efficiency_gain": <数字, -100到+100, token消耗或速度变化>,
    "accuracy_delta": <数字, -100到+100, 任务成功率变化>,
    "maintainability_score": <数字, 0到100, 代码可维护性>,
    "risk_level": <数字, 0到100, 综合风险>,
    "confidence": <数字, 0到1, 对预测的置信度>
  },
  "recommendation": "accept|accept_with_monitoring|reject|needs_human_review",
  "reasoning": "<中文理由，100字以内>",
  "suggested_monitoring_days": <数字, 仅accept_with_monitoring时需要, 建议3-14天>
}

评估注意事项：
- rule_change：重视规则冲突和影响范围
- skill_generation：重视幻觉和可验证性
- parameter_tuning：重视长期副作用和稳定性
- global 范围的变更需要更高风险预估
- 目标用户类型会影响影响评估权重`;
  }

  private parseLLMResponse(response: string, mutation: MutationCandidate): LLMSignal {
    try {
      // Extract JSON from response (may have markdown wrapping)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and sanitize
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

      return {
        impactVector: {
          efficiency_gain: clamp(parsed.impact?.efficiency_gain ?? 0, -100, 100),
          accuracy_delta: clamp(parsed.impact?.accuracy_delta ?? 0, -100, 100),
          maintainability_score: clamp(parsed.impact?.maintainability_score ?? 50, 0, 100),
          risk_level: clamp(parsed.impact?.risk_level ?? 50, 0, 100),
          confidence: clamp(parsed.impact?.confidence ?? 0.7, 0, 1),
        },
        recommendation: this.validateRecommendation(parsed.recommendation),
        reasoning: parsed.reasoning || 'No reasoning provided',
        confidence: clamp(parsed.impact?.confidence ?? 0.7, 0, 1),
      };
    } catch (e) {
      // Fallback: conservative default
      return {
        impactVector: {
          efficiency_gain: 0,
          accuracy_delta: 0,
          maintainability_score: 50,
          risk_level: 60,
          confidence: 0.3,
        },
        recommendation: 'accept_with_monitoring',
        reasoning: `LLM response parse failed: ${e}. Defaulting to conservative.`,
        confidence: 0.3,
      };
    }
  }

  // ─── Exploration Budget ───────────────────────────────────

  private shouldExplore(originalRecommendation: PhoenixRecommendation, impact: ChangeImpactVector): boolean {
    // Only explore rejections or low-confidence accepts
    if (originalRecommendation === 'reject' && impact.risk_level < 70) {
      const budgetRatio = this.explorationTotal > 0
        ? this.explorationUsed / this.explorationTotal
        : 0;
      // Keep within budget
      return budgetRatio < this.config.explorationBudget;
    }
    return false;
  }

  // ─── Legacy Mapping ───────────────────────────────────────

  private mapToLegacyState(impact: ChangeImpactVector, recommendation: PhoenixRecommendation): string {
    if (recommendation === 'reject') return 'regressed';
    if (impact.accuracy_delta > 10 && impact.risk_level < 30) return 'flipped';
    if (impact.accuracy_delta < -5) return 'regressed';
    if (impact.risk_level > 60) return 'stable_fail';
    if (recommendation === 'accept_with_monitoring') return 'flipped'; // optimistic
    return 'stable_pass';
  }

  // ─── Helpers ──────────────────────────────────────────────

  private suggestMonitoringDays(riskLevel: number): number {
    if (riskLevel > 60) return 14;
    if (riskLevel > 40) return 7;
    if (riskLevel > 25) return 5;
    return 3;
  }

  private validateRecommendation(rec: string): PhoenixRecommendation {
    const valid: PhoenixRecommendation[] = ['accept', 'accept_with_monitoring', 'reject', 'needs_human_review'];
    return valid.includes(rec as PhoenixRecommendation) ? rec as PhoenixRecommendation : 'accept_with_monitoring';
  }

  private estimateTokens(prompt: string): number {
    return Math.ceil(prompt.length / 3.5); // rough estimation: ~3.5 chars per token
  }

  private emptyLance(): LanceDBSignal {
    return { similarityScore: 1, failureRate: 0, confidence: 0, uncertainty: 1, matchedCases: 0, similarCaseIds: [] };
  }

  private emptyFirewall(): FirewallSignal {
    return { riskScore: 0, decision: 'allow', reasons: [], details: { sourceTrust: 1, hallucinationRisk: 0, stalenessPenalty: 0, depthPenalty: 0 } };
  }

  // ─── Accessors ────────────────────────────────────────────

  getHistory(): PhoenixEvaluationResult[] { return this.evaluationHistory; }
  getOutcomes(): PredictionOutcomeRecord[] { return this.predictionOutcomes; }
  getMixer(): SignalMixer { return this.mixer; }

  /**
   * Export cold-start training data from outcomes.
   * Can be used to build better few-shot examples or distill a model.
   */
  exportColdStartData(): PhoenixHistoricalCase[] {
    return this.predictionOutcomes.map(outcome => {
      const evaluation = this.evaluationHistory.find(e => e.mutationId === outcome.mutationId);
      return {
        mutationType: 'parameter_tuning', // approximate, could be better
        description: `Mutation ${outcome.mutationId}`,
        impact: outcome.phoenixPrediction,
        recommendation: outcome.phoenixRecommendation,
        actualOutcome: outcome.actualOutcome,
        verdict: outcome.actualOutcome.wasRolledBack ? 'failed' :
                 outcome.actualOutcome.finalState === 'verified' ? 'successful' : 'mixed',
      };
    });
  }
}
