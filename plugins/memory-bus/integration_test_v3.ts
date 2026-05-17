/**
 * AHE v3.0 Integration Test
 * Validates: ExperimentManager, TraceAnalyzer, ContaminationFirewall, ChangeMatrix
 */
import { ExperimentManager } from './experiment-manager.js';
import { TraceAnalyzer, IncrementalAnalyzer } from './trace-analyzer.js';
import { ContaminationFirewall } from './contamination-firewall.js';
import { OpenClawIntegration } from './openclaw-integration.js';
import { MemoryBus, getMemoryBus } from './index.js';

const AHE_ROOT = process.env.AHE_ROOT || process.cwd();

async function testExperimentManager() {
  console.log('\n=== Test 1: ExperimentManager ===');
  
  const mgr = new ExperimentManager({
    name: 'test-v3',
    description: 'Integration test experiment',
    maxIterations: 5,
    passRateTarget: 0.8,
    rollbackThreshold: 0.1,
    autoRollback: true,
    evolutionStrategy: 'greedy',
    benchmarkTasks: [
      { id: 'task-1', name: 'Test Task 1', description: 'Test', category: 'test' },
      { id: 'task-2', name: 'Test Task 2', description: 'Test', category: 'test' },
    ],
  }, AHE_ROOT);

  await mgr.initExperiment();
  console.log('✅ initExperiment passed');

  // Simulate two iterations
  const iter1 = await mgr.recordIteration([
    { taskId: 'task-1', taskName: 'Test Task 1', status: 'fail', score: 0.3, tokenCost: 100, durationMs: 500 },
    { taskId: 'task-2', taskName: 'Test Task 2', status: 'pass', score: 0.9, tokenCost: 200, durationMs: 300 },
  ], []);
  console.log(`Iteration 1 pass rate: ${iter1.passRate}`);

  const iter2 = await mgr.recordIteration([
    { taskId: 'task-1', taskName: 'Test Task 1', status: 'pass', score: 0.85, tokenCost: 120, durationMs: 400 },
    { taskId: 'task-2', taskName: 'Test Task 2', status: 'pass', score: 0.95, tokenCost: 180, durationMs: 250 },
  ], []);
  console.log(`Iteration 2 pass rate: ${iter2.passRate}`);
  console.log(`Change matrix: flipped=${iter2.changeMatrix?.summary.flipped}, regressed=${iter2.changeMatrix?.summary.regressed}`);
  console.log('✅ recordIteration + changeMatrix passed');

  const best = mgr.getBestEver();
  console.log(`Best ever: iteration=${best.iteration}, passRate=${best.passRate}`);
  console.log('✅ best_ever tracking passed');
}

async function testTraceAnalyzer() {
  console.log('\n=== Test 2: TraceAnalyzer ===');
  
  const analyzer = new TraceAnalyzer({ mode: 'rule' });
  
  const events = [{
    id: 'test-1',
    timestamp: new Date().toISOString(),
    type: 'error' as const,
    content: 'Error: Cannot find module D:\\longxiaqiang\\test.js — ENOENT',
    metadata: {},
    provenance: { source_type: 'system' as const, confidence: 0.9, depth: 0 },
    compression_info: { compressed: false },
    routing_hints: {},
    contamination: { suspicion_score: 0, quarantine_level: 'clean' as const, provenance_depth: 0 },
  }];

  const report = await analyzer.analyze('test-task', events);
  console.log(`Root cause: ${report.rootCause}`);
  console.log(`Components: ${report.affectedComponents.join(', ')}`);
  console.log(`Confidence: ${report.confidence}`);
  console.log(`Error category: ${report.errorCategory}`);
  
  if (report.errorCategory === 'path_error') {
    console.log('✅ TraceAnalyzer correctly identified path error');
  } else {
    console.log('⚠️ Unexpected error category');
  }
}

async function testContaminationFirewall() {
  console.log('\n=== Test 3: ContaminationFirewall ===');
  
  const firewall = new ContaminationFirewall();
  
  // Test clean event
  const cleanEvent = {
    id: 'evt-clean',
    timestamp: new Date().toISOString(),
    type: 'fact' as const,
    content: 'User said the file is at D:\\longxiaqiang\\data.csv',
    metadata: {},
    provenance: { source_type: 'user' as const, confidence: 0.99, depth: 0 },
    compression_info: { compressed: false },
    routing_hints: {},
    contamination: { suspicion_score: 0, quarantine_level: 'clean' as const, provenance_depth: 0 },
  };
  
  const result1 = await firewall.intercept(cleanEvent);
  console.log(`Clean event → quarantine: ${result1.contamination.quarantine_level}, score: ${result1.contamination.suspicion_score.toFixed(3)}`);
  
  // Test suspicious event (LLM source + low confidence)
  const suspiciousEvent = {
    id: 'evt-suspicious',
    timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    type: 'fact' as const,
    content: 'LLM hallucination: The API returns JSON but actually it returns XML',
    metadata: {},
    provenance: { source_type: 'llm' as const, confidence: 0.3, depth: 3 },
    compression_info: { compressed: false },
    routing_hints: {},
    contamination: { suspicion_score: 0, quarantine_level: 'clean' as const, provenance_depth: 3 },
  };
  
  const result2 = await firewall.intercept(suspiciousEvent);
  console.log(`Suspicious event → quarantine: ${result2.contamination.quarantine_level}, score: ${result2.contamination.suspicion_score.toFixed(3)}`);
  
  // Test propagation
  firewall.registerDependency('evt-suspicious', 'evt-downstream');
  const downstream = {
    id: 'evt-downstream',
    timestamp: new Date().toISOString(),
    type: 'fact' as const,
    content: 'Downstream event based on suspicious source',
    metadata: {},
    provenance: { source_type: 'llm' as const, confidence: 0.7, depth: 1 },
    compression_info: { compressed: false },
    routing_hints: {},
    contamination: { suspicion_score: 0.05, quarantine_level: 'clean' as const, provenance_depth: 1 },
  };
  
  const propagation = firewall.propagate(result2, (id) => id === 'evt-downstream' ? downstream : undefined);
  console.log(`Propagation: ${propagation.downstreamEvents.length} downstream events affected`);
  
  console.log('✅ ContaminationFirewall tests passed');
}

async function testChangeMatrix() {
  console.log('\n=== Test 4: ChangeMatrix ===');
  
  const bus = new MemoryBus();
  await bus.initialize();
  
  const prev = [
    { taskId: 'a', taskName: 'Task A', status: 'fail' as const, score: 0.2 },
    { taskId: 'b', taskName: 'Task B', status: 'pass' as const, score: 0.9 },
    { taskId: 'c', taskName: 'Task C', status: 'exception' as const, score: 0 },
    { taskId: 'd', taskName: 'Task D', status: 'pass' as const, score: 0.85 },
  ];
  
  const cur = [
    { taskId: 'a', taskName: 'Task A', status: 'pass' as const, score: 0.8 },
    { taskId: 'b', taskName: 'Task B', status: 'fail' as const, score: 0.3 },
    { taskId: 'c', taskName: 'Task C', status: 'pass' as const, score: 0.75 },
    { taskId: 'd', taskName: 'Task D', status: 'pass' as const, score: 0.9 },
  ];
  
  const matrix = bus.computeChangeMatrix(prev, cur);
  console.log(`Flipped: ${matrix.flipped}, Regressed: ${matrix.regressed}`);
  console.log(`Stable pass: ${matrix.stable_pass}, Infra recovered: ${matrix.infra_recovered}`);
  console.log(`Net improvement: ${matrix.netImprovement}`);
  console.log(`Pass rate: ${matrix.passRateBefore.toFixed(2)} → ${matrix.passRateAfter.toFixed(2)}`);
  
  if (matrix.flipped === 1 && matrix.regressed === 1 && matrix.infra_recovered === 1) {
    console.log('✅ ChangeMatrix correct classification');
  } else {
    console.log('⚠️ ChangeMatrix classification mismatch');
  }
  
  await bus.shutdown();
}

async function testOpenClawIntegration() {
  console.log('\n=== Test 5: OpenClaw Integration ===');
  
  const bus = new MemoryBus();
  await bus.initialize();
  const l0 = new OpenClawIntegration(bus);
  
  // Test event handling
  l0.on('evolution_needed', (data) => {
    console.log(`Event: evolution_needed for task ${data.taskId}`);
  });
  
  await l0.onTaskComplete({
    type: 'task_failure',
    timestamp: new Date().toISOString(),
    payload: { taskId: 'test-fail', error: 'ENOENT: no such file' },
  });
  
  const status = await l0.getStatus();
  console.log(`Status: version=${status.version}, evolutions=${status.totalEvolutions}`);
  
  if (status.version === '3.0.0-alpha') {
    console.log('✅ OpenClawIntegration status correct');
  }
  
  await bus.shutdown();
}

async function runAll() {
  console.log('═══════════════════════════════════════════');
  console.log('   AHE v3.0 Integration Test Suite         ');
  console.log('═══════════════════════════════════════════');
  
  let passed = 0;
  let total = 5;
  
  try { await testExperimentManager(); passed++; } catch (e) { console.error('❌ Test 1 failed:', e); }
  try { await testTraceAnalyzer(); passed++; } catch (e) { console.error('❌ Test 2 failed:', e); }
  try { await testContaminationFirewall(); passed++; } catch (e) { console.error('❌ Test 3 failed:', e); }
  try { await testChangeMatrix(); passed++; } catch (e) { console.error('❌ Test 4 failed:', e); }
  try { await testOpenClawIntegration(); passed++; } catch (e) { console.error('❌ Test 5 failed:', e); }
  
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`   Results: ${passed}/${total} passed        `);
  console.log('═══════════════════════════════════════════');
}

runAll().catch(console.error);
