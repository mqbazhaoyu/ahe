/**
 * AHE v3.0 — Phoenix / Mixer / Pipeline Type Definitions
 * 
 * x-algorithm inspired types for the AHE evolution engine.
 * Based on 10-round Grok consultation (Round 10-19, 2026-05-18).
 * 
 * Commercialization strategy: designed for multi-user, multi-platform scale.
 */

// ─── Phoenix: Multi-Objective Change Evaluator ───────────────

export interface ChangeImpactVector {
  /** Token reduction or speed improvement, -100 to +100 */
  efficiency_gain: number;
  /** Task success rate change, -100 to +100 */
  accuracy_delta: number;
  /** Code/rule cleanliness and long-term maintainability, 0-100 */
  maintainability_score: number;
  /** Contamination, regression, instability risk, 0-100 */
  risk_level: number;
  /** Model's confidence in this prediction, 0-1 */
  confidence: number;
}

export type PhoenixRecommendation =
  | 'accept'
  | 'accept_with_monitoring'
  | 'reject'
  | 'needs_human_review';

export type MutationType =
  | 'rule_change'          // 修改 .md 规则文件
  | 'skill_generation'     // skill-crystallizer 自动生成新 skill
  | 'parameter_tuning'     // 调整 decay / 阈值等配置参数
  | 'prompt_modification'  // 修改 LLM prompt
  | 'component_refactor';  // 重构组件结构

export type UserType =
  | 'creative_writer'     // 强哥：写剧本/动画
  | 'game_developer'      // 游戏开发
  | 'musician'            // 音乐制作
  | 'programmer'          // 程序员
  | 'trader';             // 炒股/交易

export interface MutationCandidate {
  id: string;
  type: MutationType;
  source: string;           // e.g. "skill-crystallizer", "dreaming-phase-5"
  description: string;
  proposedChange: {
    component: string;       // e.g. "tool-policies", "skill-xxx", "decay-params"
    changeType: 'update' | 'add' | 'delete' | 'modify';
    diff: string;
    affectedFiles: string[];
    affectedTasks?: string[];
    /** Per-user-type impact estimation */
    userTypeImpact?: Partial<Record<UserType, number>>; // -10 to +10
  };
  priority: number;          // 0-100, set by Distillation Scheduler
  createdAt: string;
  /** Scope: global affects all users, per_user affects specific user */
  scope: 'global' | 'per_user';
  targetUsers?: UserType[];
}

export interface PhoenixEvaluationRequest {
  mutation: MutationCandidate;
  /** Historical context: relevant past mutations + outcomes */
  historicalContext: PhoenixHistoricalCase[];
  /** Current system metrics */
  currentMetrics: Record<string, number>;
  /** Firewall pre-check result for context */
  firewallRiskScore?: number;
  /** Whether this is an exploration-budget evaluation */
  explorationMode?: boolean;
}

export interface PhoenixEvaluationResult {
  mutationId: string;
  impact: ChangeImpactVector;
  recommendation: PhoenixRecommendation;
  reasoning: string;
  /** Suggested monitoring duration if accept_with_monitoring */
  suggestedMonitoringDays?: number;
  /** Legacy 9-state mapping for backward compatibility */
  legacyState?: string;
  /** Time taken for evaluation */
  evaluationTimeMs?: number;
  /** LLM cost if applicable */
  tokenCost?: number;
}

export interface PhoenixHistoricalCase {
  mutationType: MutationType;
  description: string;
  impact: ChangeImpactVector;
  recommendation: PhoenixRecommendation;
  actualOutcome?: {
    efficiencyChange: number;
    accuracyChange: number;
    wasRolledBack: boolean;
    finalState: 'verified' | 'rolled_back' | 'rejected';
    monitoringDays?: number;
  };
  verdict: 'successful' | 'failed' | 'mixed' | 'pending';
}

export interface PhoenixConfig {
  mode: 'llm' | 'hybrid' | 'distilled';
  llmCall?: (prompt: string) => Promise<string>;
  /** Explore budget: % of candidates that bypass conservative filtering */
  explorationBudget: number;
  /** Minimum confidence threshold for auto-accept */
  autoAcceptConfidence: number;
  /** Maximum risk level for auto-accept */
  maxAutoAcceptRisk: number;
  /** Cold start: few-shot examples in prompt */
  coldStartExamples: PhoenixHistoricalCase[];
  /** User type weights for impact calculation */
  userTypeWeights?: Partial<Record<UserType, number>>;
  /** Enable legacy 9-state mapping */
  legacyStateMapping: boolean;
}

export const DEFAULT_PHOENIX_CONFIG: PhoenixConfig = {
  mode: 'llm',
  explorationBudget: 0.2,     // 20% of low-confidence candidates get exploration pass
  autoAcceptConfidence: 0.85,
  maxAutoAcceptRisk: 25,
  coldStartExamples: [],
  legacyStateMapping: true,
};

// ─── Signal Mixer: Multi-Source Signal Fusion ─────────────────

export interface SignalBundle {
  heuristic: HeuristicSignal;
  lance: LanceDBSignal;
  firewall: FirewallSignal;
  llm?: LLMSignal;
}

export interface HeuristicSignal {
  risk: number;           // 0-100
  confidence: number;      // 0-1
  details: {
    linesChanged: number;
    filesAffected: number;
    isCoreFile: boolean;
    historicalSuccessRate: number;
  };
}

export interface LanceDBSignal {
  similarityScore: number;      // 0-1, how similar to known patterns
  failureRate: number;          // 0-1, historical failure rate of similar mutations
  confidence: number;           // 0-1, confidence in the match
  uncertainty: number;           // 0-1, how uncertain the match is
  matchedCases: number;         // how many similar cases found
  similarCaseIds: string[];
}

export interface FirewallSignal {
  riskScore: number;           // 0-100
  decision: 'allow' | 'warn' | 'block';
  reasons: string[];
  details: {
    sourceTrust: number;
    hallucinationRisk: number;
    stalenessPenalty: number;
    depthPenalty: number;
  };
}

export interface LLMSignal {
  impactVector: ChangeImpactVector;
  recommendation: PhoenixRecommendation;
  reasoning: string;
  confidence: number;
}

export interface FusedDecision {
  impact: ChangeImpactVector;
  recommendation: PhoenixRecommendation;
  reasoning: string;
  primarySignal: 'heuristic' | 'lance' | 'firewall' | 'llm' | 'fused';
  signalBreakdown: {
    heuristicContribution: number;
    lanceContribution: number;
    firewallContribution: number;
    llmContribution: number;
  };
  conflictDetected: boolean;
  conflictResolution?: string;
}

export interface MixerConfig {
  /** Weights for each signal source (initial manual config) */
  weights: {
    heuristic: number;
    lance: number;
    firewall: number;
    llm: number;
  };
  /** Cascade: stop at stage N if confidence high enough */
  cascadeThresholds: {
    heuristic: number;   // risk below this → stop
    lance: number;        // failure rate below this → stop
    firewall: number;     // risk score below this → stop
  };
  /** When to escalate to LLM */
  escalateCondition: 'always' | 'conflict_only' | 'high_uncertainty' | 'cascade';
  /** Conflict detection threshold */
  conflictThreshold: number; // signal divergence > this → conflict
}

export const DEFAULT_MIXER_CONFIG: MixerConfig = {
  weights: { heuristic: 0.15, lance: 0.2, firewall: 0.35, llm: 0.3 },
  cascadeThresholds: { heuristic: 15, lance: 0.3, firewall: 25 },
  escalateCondition: 'conflict_only',
  conflictThreshold: 0.4,
};

// ─── Candidate Pipeline: Multi-Stage Change Filtering ─────────

export type PipelineStage = 'stage1_fast_filter' | 'stage2_light_eval' | 'stage3_deep_eval';

export interface PipelineConfig {
  /** Enable dynamic skip when candidate count is low */
  dynamicSkip: boolean;
  /** Skip threshold: if candidates <= this, bypass pipeline */
  skipThreshold: number;
  /** Target pass rate per stage */
  stagePassRates: Record<PipelineStage, number>;
  /** Maximum concurrent deep evaluations */
  maxConcurrentDeepEval: number;
  /** Enable conflict detection between candidates */
  conflictDetection: boolean;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  dynamicSkip: true,
  skipThreshold: 3,
  stagePassRates: {
    stage1_fast_filter: 0.65,
    stage2_light_eval: 0.45,
    stage3_deep_eval: 0.25,
  },
  maxConcurrentDeepEval: 5,
  conflictDetection: true,
};

export interface PipelineStageResult {
  stage: PipelineStage;
  inputCount: number;
  outputCount: number;
  passRate: number;
  filteredCandidates: MutationCandidate[];
  rejectedCandidates: Array<{
    candidate: MutationCandidate;
    reason: string;
    stage: PipelineStage;
  }>;
  durationMs: number;
}

export interface CandidateConflict {
  candidateA: MutationCandidate;
  candidateB: MutationCandidate;
  conflictType: 'same_file' | 'same_component' | 'incompatible_types' | 'resource_overlap';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface PipelineResult {
  totalCandidates: number;
  passedCandidates: MutationCandidate[];
  rejectedCandidates: MutationCandidate[];
  stages: PipelineStageResult[];
  conflicts: CandidateConflict[];
  totalDurationMs: number;
  skipped: boolean;
}

// ─── Feedback Loop ───────────────────────────────────────────

export interface PredictionOutcomeRecord {
  mutationId: string;
  phoenixPrediction: ChangeImpactVector;
  phoenixRecommendation: PhoenixRecommendation;
  actualOutcome: {
    efficiencyChange: number;
    accuracyChange: number;
    wasRolledBack: boolean;
    finalState: 'verified' | 'rolled_back' | 'rejected';
    monitoringDays?: number;
  };
  predictionError: {
    efficiencyError: number;
    accuracyError: number;
    riskError: number;
    maintainabilityError: number;
    mae: number; // mean absolute error across dimensions
  };
  userType?: UserType;
  timestamp: string;
}

// ─── Phoenix Performance Tracking ────────────────────────────

export interface PhoenixPerformanceMetrics {
  totalEvaluations: number;
  accuracyTrend: number[];         // recent MAE values
  recentMAE: number;              // last 10 evaluations
  overConservativeRate: number;   // % of rejections that were actually safe
  underConservativeRate: number;   // % of accepts that caused issues
  explorationBudgetUsed: number;   // % of budget consumed this period
  llmCallCount: number;
  totalTokenCost: number;
  lastUpdated: string;
}
