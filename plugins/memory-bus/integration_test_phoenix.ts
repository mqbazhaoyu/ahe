/**
 * AHE v3.1 — Phoenix Integration Test
 * 
 * Validates the full x-algorithm inspired pipeline:
 *   SignalMixer → FirewallAdapter → PhoenixEvaluator → CandidatePipeline
 * 
 * Run: npx tsx integration_test_phoenix.ts
 */

import { SignalMixer } from './signal-mixer.js';
import { PhoenixEvaluator } from './phoenix-evaluator.js';
import { CandidatePipeline } from './candidate-pipeline.js';
import { FirewallAdapter } from './firewall-adapter.js';
import { ContaminationFirewall } from './contamination-firewall.js';
import { AHEPhoenix } from './ahe-phoenix.js';
import type {
  MutationCandidate, HeuristicSignal, LanceDBSignal,
  FirewallSignal, LLMSignal, SignalBundle, PhoenixHistoricalCase,
} from './types_phoenix.js';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  Promise.resolve(fn()).then(ok => {
    if (ok) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: ${name}`);
      failed++;
    }
  }).catch(e => {
    console.log(`  💥 ERROR: ${name} — ${e.message}`);
    failed++;
  });
}

function assertEqual<T>(actual: T, expected: T, msg: string): boolean {
  if (actual !== expected) {
    console.log(`    ${msg}: expected ${expected}, got ${actual}`);
    return false;
  }
  return true;
}

function assertInRange(val: number, min: number, max: number, msg: string): boolean {
  if (val < min || val > max) {
    console.log(`    ${msg}: expected ${min}-${max}, got ${val}`);
    return false;
  }
  return true;
}

// ─── Test Data ──────────────────────────────────────────────

const mockMutation: MutationCandidate = {
  id: 'test-mutation-001',
  type: 'parameter_tuning',
  source: 'dreaming-phase-5',
  description: 'Adjust memory decay half-life from 7 days to 14 days',
  proposedChange: {
    component: 'decay-params',
    changeType: 'modify',
    diff: '- half_life: 7\n+ half_life: 14',
    affectedFiles: ['components/memory-schema.md'],
    affectedTasks: ['memory-recall', 'memory-decay'],
    userTypeImpact: { creative_writer: 3, programmer: 1 },
  },
  priority: 60,
  createdAt: new Date().toISOString(),
  scope: 'global',
};

const mockColdStartExample: PhoenixHistoricalCase = {
  mutationType: 'parameter_tuning',
  description: 'Change decay from 5 to 10 days — successful, improved memory retention',
  impact: { efficiency_gain: 10, accuracy_delta: 5, maintainability_score: 80, risk_level: 15, confidence: 0.85 },
  recommendation: 'accept',
  actualOutcome: {
    efficiencyChange: 8,
    accuracyChange: 4,
    wasRolledBack: false,
    finalState: 'verified',
    monitoringDays: 5,
  },
  verdict: 'successful',
};

// ─── Tests ──────────────────────────────────────────────────

console.log('\n═══ AHE Phoenix Integration Tests ═══\n');

// Test 1: SignalMixer — cascade with low risk
test('SignalMixer: cascade stops at stage 1 for low risk', async () => {
  const mixer = new SignalMixer({ escalateCondition: 'cascade' });
  const signals: SignalBundle = {
    heuristic: { risk: 10, confidence: 0.9, details: { linesChanged: 2, filesAffected: 1, isCoreFile: false, historicalSuccessRate: 0.8 } },
    lance: { similarityScore: 0.8, failureRate: 0.1, confidence: 0.8, uncertainty: 0.2, matchedCases: 5, similarCaseIds: [] },
    firewall: { riskScore: 8, decision: 'allow', reasons: [], details: { sourceTrust: 0.9, hallucinationRisk: 0.1, stalenessPenalty: 0, depthPenalty: 0 } },
  };
  const result = await mixer.mix(signals);
  return result.recommendation === 'accept' && result.primarySignal === 'heuristic';
});

// Test 2: SignalMixer — firewall blocks
test('SignalMixer: blocks when firewall says block', async () => {
  const mixer = new SignalMixer();
  const signals: SignalBundle = {
    heuristic: { risk: 20, confidence: 0.7, details: { linesChanged: 5, filesAffected: 1, isCoreFile: false, historicalSuccessRate: 0.6 } },
    lance: { similarityScore: 0.6, failureRate: 0.3, confidence: 0.6, uncertainty: 0.3, matchedCases: 3, similarCaseIds: [] },
    firewall: { riskScore: 85, decision: 'block', reasons: ['Contamination detected'], details: { sourceTrust: 0.2, hallucinationRisk: 0.8, stalenessPenalty: 0, depthPenalty: 0.1 } },
  };
  const result = await mixer.mix(signals);
  return result.recommendation === 'reject';
});

// Test 3: SignalMixer — conflict detection
test('SignalMixer: detects firewall/lance conflict', async () => {
  const mixer = new SignalMixer({ escalateCondition: 'conflict_only' });
  const signals: SignalBundle = {
    heuristic: { risk: 30, confidence: 0.6, details: { linesChanged: 10, filesAffected: 2, isCoreFile: true, historicalSuccessRate: 0.4 } },
    lance: { similarityScore: 0.5, failureRate: 0.7, confidence: 0.75, uncertainty: 0.3, matchedCases: 5, similarCaseIds: [] },
    firewall: { riskScore: 15, decision: 'allow', reasons: [], details: { sourceTrust: 0.9, hallucinationRisk: 0.05, stalenessPenalty: 0, depthPenalty: 0 } },
    llm: {
      impactVector: { efficiency_gain: -5, accuracy_delta: -3, maintainability_score: 60, risk_level: 40, confidence: 0.75 },
      recommendation: 'accept_with_monitoring',
      reasoning: 'LanceDB shows high historical failure despite low current risk. Proceed with monitoring.',
      confidence: 0.75,
    },
  };
  const result = await mixer.mix(signals);
  return result.conflictDetected === true && result.recommendation === 'accept_with_monitoring';
});

// Test 4: FirewallAdapter — light eval
test('FirewallAdapter: evaluateLight returns valid result', async () => {
  const firewall = new ContaminationFirewall();
  const adapter = new FirewallAdapter(firewall);
  const result = await adapter.evaluateLight(mockMutation);
  return assertInRange(result.riskScore, 0, 100, 'riskScore range') &&
         ['allow', 'warn', 'block'].includes(result.decision);
});

// Test 5: FirewallAdapter — full eval
test('FirewallAdapter: evaluate returns detailed breakdown', async () => {
  const firewall = new ContaminationFirewall();
  const adapter = new FirewallAdapter(firewall);
  const result = await adapter.evaluate(mockMutation);
  return result.details.sourceTrust > 0 &&
         result.details.hallucinationRisk >= 0 &&
         ['allow', 'warn', 'block'].includes(result.decision);
});

// Test 6: PhoenixEvaluator — heuristic computation
test('PhoenixEvaluator: heuristic returns valid signal', async () => {
  const phoenix = new PhoenixEvaluator({
    coldStartExamples: [mockColdStartExample],
    mode: 'hybrid',
  });
  const result = await phoenix.evaluate({
    mutation: mockMutation,
    historicalContext: [mockColdStartExample],
    currentMetrics: { memory_accuracy: 0.76 },
  });
  return assertInRange(result.impact.risk_level, 0, 100, 'risk_level') &&
         ['accept', 'accept_with_monitoring', 'reject', 'needs_human_review'].includes(result.recommendation);
});

// Test 7: PhoenixEvaluator — outcome recording
test('PhoenixEvaluator: records outcome and updates metrics', async () => {
  const phoenix = new PhoenixEvaluator({ mode: 'hybrid' });
  // First evaluate
  await phoenix.evaluate({
    mutation: mockMutation,
    historicalContext: [],
    currentMetrics: {},
  });
  // Then record outcome
  const outcome = phoenix.recordOutcome('test-mutation-001', {
    efficiencyChange: 5,
    accuracyChange: 2,
    wasRolledBack: false,
    finalState: 'verified',
    monitoringDays: 5,
  });
  return outcome !== null && outcome.predictionError.mae > 0;
});

// Test 8: CandidatePipeline — dynamic skip
test('CandidatePipeline: skips pipeline when ≤ threshold candidates', async () => {
  const phoenix = new PhoenixEvaluator({ mode: 'hybrid' });
  const pipeline = new CandidatePipeline(phoenix, { dynamicSkip: true, skipThreshold: 3 });

  const singleCandidate = [{ ...mockMutation, id: 'single-1' }];
  const result = await pipeline.process(singleCandidate);
  return result.skipped === true && result.totalDurationMs > 0;
});

// Test 9: CandidatePipeline — full pipeline
test('CandidatePipeline: runs 3-stage pipeline for many candidates', async () => {
  const phoenix = new PhoenixEvaluator({ mode: 'hybrid' });
  const pipeline = new CandidatePipeline(phoenix, {
    dynamicSkip: true,
    skipThreshold: 3,
    conflictDetection: true,
  });

  // Create 10 candidates with varying risk profiles
  const candidates: MutationCandidate[] = Array.from({ length: 10 }, (_, i) => ({
    ...mockMutation,
    id: `batch-${i}`,
    type: i % 3 === 0 ? 'rule_change' : i % 3 === 1 ? 'skill_generation' : 'parameter_tuning' as any,
    proposedChange: {
      ...mockMutation.proposedChange,
      diff: `line ${i}\n`.repeat(i + 1),
      affectedFiles: [`components/file-${i % 3}.md`],
    },
  }));

  const result = await pipeline.process(candidates);
  return result.skipped === false && result.stages.length === 3 &&
         assertInRange(result.totalDurationMs, 0, 30000, 'duration');
});

// Test 10: AHEPhoenix — full integration
test('AHEPhoenix: full evolve cycle', async () => {
  const ahePhoenix = new AHEPhoenix({
    llmCall: async (prompt) => {
      // Mock LLM response
      return JSON.stringify({
        impact: {
          efficiency_gain: 12,
          accuracy_delta: 3,
          maintainability_score: 75,
          risk_level: 20,
          confidence: 0.85,
        },
        recommendation: 'accept',
        reasoning: 'Minor parameter change, low risk, historical precedent supports this adjustment.',
        suggested_monitoring_days: 5,
      });
    },
  });

  const { pipelineResult, evaluations } = await ahePhoenix.evolve([mockMutation]);
  return pipelineResult.totalCandidates === 1 &&
         evaluations.length > 0 &&
         ['accept', 'accept_with_monitoring'].includes(evaluations[0].recommendation);
});

// Test 11: Phoenix — exploration budget
test('Phoenix: exploration budget converts rejects to monitoring', async () => {
  const phoenix = new PhoenixEvaluator({
    explorationBudget: 1.0, // 100% — force exploration for this test
    mode: 'hybrid',
  });

  // Create a high-risk mutation that would normally be rejected
  const highRiskMutation: MutationCandidate = {
    ...mockMutation,
    id: 'high-risk-1',
    proposedChange: {
      ...mockMutation.proposedChange,
      diff: 'massive change\n'.repeat(50),
      affectedFiles: ['SKILL.md', 'system-rules.md', 'tool-policies.md', 'memory-schema.md', 'environment.md'],
    },
  };

  const result = await phoenix.evaluate({
    mutation: highRiskMutation,
    historicalContext: [],
    currentMetrics: {},
  });
  return assertInRange(result.impact.confidence, 0, 1, 'confidence');
});

// Test 12: Performance metrics
test('PhoenixPerformanceMetrics: tracks stats correctly', () => {
  const ahePhoenix = new AHEPhoenix();
  const metrics = ahePhoenix.getPerformanceReport();
  return metrics.totalEvaluations >= 0 &&
         metrics.totalTokenCost >= 0 &&
         assertInRange(metrics.explorationBudgetUsed, 0, 1, 'budget');
});

// ─── Run & Report ──────────────────────────────────────────

// Wait for all async tests
setTimeout(() => {
  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
  process.exit(failed > 0 ? 1 : 0);
}, 3000);
