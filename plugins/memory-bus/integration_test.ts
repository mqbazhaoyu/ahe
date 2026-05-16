import { MemoryBus, getMemoryBus } from './index.js';
import { Trajectory } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

function short(s, n) { return String(s).slice(0, n); }
function fix4(n) { return Number(n).toFixed(4); }

async function main() {
  console.log('=== AHE Memory Bus v2.1 - Integration Test ===\n');

  const bus = await getMemoryBus();

  // Step 1: memory_add
  console.log('--- Step 1: Adding session events ---\n');

  const events = [
    { type: 'decision', content: 'Grok 25-round architecture collaboration: Unified Memory Bus + Skill Crystallization + Provenance Linking as top-3 MUST DO items', metadata: { tags: ['architecture', 'grok'], success_count: 5, reuse_count: 2 }, source_type: 'user', confidence: 0.95, provenance_depth: 0 },
    { type: 'decision', content: 'Data contamination defense system designed (Grok R21-R25): 3-layer detection, 3-level quarantine, 4-strategy immune response', metadata: { tags: ['contamination', 'defense'], success_count: 3 }, source_type: 'llm', confidence: 0.85, provenance_depth: 1 },
    { type: 'decision', content: 'Competitive analysis completed: OpenSpace, EvoAgentX, GenericAgent, Hermes â€?AHE unique moat = data contamination defense', metadata: { tags: ['competitive-analysis'], success_count: 2 }, source_type: 'llm', confidence: 0.80, provenance_depth: 1 },
    { type: 'skill', content: 'First skill crystallization: grok-architecture-collaboration.md â€?7 core principles, dialogue template, failure patterns', metadata: { tags: ['crystallization'], success_count: 1 }, source_type: 'system', confidence: 0.90, provenance_depth: 0 },
    { type: 'fact', content: 'Memory Bus implementation complete with LanceDB persistence and contamination scoring', metadata: { tags: ['implementation'], success_count: 5 }, source_type: 'tool', confidence: 0.98, provenance_depth: 0 },
    { type: 'decision', content: 'Context window fix: deepseek-v4 contextWindow 200k -> 1000000, maxTokens 8192 -> 32768', metadata: { tags: ['config'], success_count: 1 }, source_type: 'user', confidence: 0.95, provenance_depth: 0 },
    { type: 'fact', content: 'Grok critical insight: extract algorithms as plugins, do NOT glue desktop apps. This pivot saved the architecture.', metadata: { tags: ['grok', 'pivot'], success_count: 5 }, source_type: 'llm', confidence: 0.90, provenance_depth: 1 },
    { type: 'decision', content: 'Grok should NOT write complete code (buggy TypeScript), ask for design specs and pseudocode instead', metadata: { tags: ['grok', 'lesson'], success_count: 3 }, source_type: 'llm', confidence: 0.85, provenance_depth: 2 },
    // negative
    { type: 'fact', content: 'LanceDB supports full SQL JOIN operations across tables with automatic index optimization', metadata: { tags: ['fake'], success_count: 0 }, source_type: 'llm', confidence: 0.15, provenance_depth: 3 },
  ];

  const addedIds = [];
  for (const ev of events) {
    const result = await bus.memory_add({
      content: ev.content,
      source_type: ev.source_type,
      confidence: ev.confidence,
      provenance_depth: ev.provenance_depth,
      metadata: ev.metadata,
      event_type: ev.type,
    });
    addedIds.push(result.id);
    console.log('  Added: ' + short(result.id, 8) + ' [' + ev.source_type + ', C=' + ev.confidence + ', d=' + ev.provenance_depth + '] -> "' + short(ev.content, 60) + '"');
  }

  // Step 2: memory_query
  console.log('\n--- Step 2: Semantic queries ---\n');

  const queries = [
    'architecture collaboration with external models',
    'data contamination defense',
    'skill crystallization process',
    'context window configuration',
  ];

  for (const q of queries) {
    const results = await bus.memory_query({ query: q, limit: 3 });
    console.log('  Query: "' + q + '"');
    for (const r of results) {
      const c = r.event.contamination;
      const qLevel = c.quarantine_level;
      const emoji = qLevel === 'clean' ? 'ðŸŸ¢' : qLevel === 'suspicious' ? 'ðŸŸ¡' : qLevel === 'isolated' ? 'ðŸŸ ' : 'ðŸ”´';
      console.log('    ' + emoji + ' [S\'(t)=' + fix4(r.score) + ', C=' + fix4(r.contamination_penalty) + ', ' + qLevel + '] "' + short(r.event.content, 80) + '"');
    }
    console.log('');
  }

  // Step 3: Contamination check
  console.log('--- Step 3: Contamination check ---\n');

  const fakeResults = await bus.memory_query({ query: 'LanceDB SQL JOIN optimization', limit: 3, include_isolated: true });
  for (const r of fakeResults) {
    const c = r.event.contamination;
    console.log('  Quarantine: ' + c.quarantine_level + ' | Suspicion: ' + fix4(c.suspicion_score));
    console.log('  Content: "' + short(r.event.content, 80) + '"');
    console.log('  S\'(t)=' + fix4(r.score) + ' (C=' + fix4(r.contamination_penalty) + ')');
  }

  const filtered = await bus.memory_query({ query: 'LanceDB SQL JOIN optimization', limit: 3 });
  console.log('\n  Default query (exclude isolated): ' + filtered.length + ' results (should be 0)');
  console.log('  Full query (include_isolated): ' + fakeResults.length + ' results');

  // Step 4: Crystallize skill
  console.log('\n--- Step 4: Skill crystallization ---\n');

  const trajectory = {
    task_type: 'architecture-review',
    summary: 'Grok 25-round architecture collaboration: from 6 risks to working Memory Bus with contamination defense',
    steps: [
      { description: 'Grok R1: Honest critique â€?6 major architectural risks identified' },
      { description: 'Grok R2: Algorithm extraction strategy â€?confirmed better approach' },
      { description: 'Grok R3-10: Nightly dreaming, decay scoring, plugin skeleton, top-3 items' },
      { description: 'Grok R21-25: Data contamination defense â€?full system designed' },
      { description: 'Competitive analysis: 4 competitors analyzed, unique moat identified' },
      { description: 'AHE v2.0 upgrade: 7 components upgraded, git tagged' },
      { description: 'MemoryBus implemented: LanceDB persistence + contamination scoring' },
      { description: 'First skill crystallization: grok-architecture-collaboration.md' },
    ],
    dependencies: ['Grok', 'DeepSeek v4', 'LanceDB', 'TypeScript'],
    success: true,
  };

  const skill = await bus.crystallize_skill(trajectory, {
    skillName: 'multi-model-architecture-review',
    tags: ['architecture', 'collaboration', 'grok', 'deepseek', 'code-review'],
  });

  console.log('  Skill: ' + skill.meta.name);
  console.log('  Path: ' + skill.meta.path);
  console.log('  Verification: ' + skill.meta.verification_status);
  console.log('  Content: ' + skill.content.length + ' chars');
  console.log('  Summary: ' + short(skill.trajectory_summary, 80));

  // Step 5: Persistence check
  console.log('\n--- Step 5: Persistence verification ---\n');

  const retrieved = await bus.memory_get(addedIds[0]);
  console.log('  memory_get: ' + (retrieved ? 'FOUND' : 'NOT FOUND'));
  if (retrieved) {
    console.log('    Content: "' + short(retrieved.content, 60) + '"');
    console.log('    Contamination: ' + fix4(retrieved.contamination.suspicion_score) + ' (' + retrieved.contamination.quarantine_level + ')');
  }

  const skillFile = path.join(skill.meta.path, 'SKILL.md');
  const exists = fs.existsSync(skillFile);
  console.log('  SKILL.md on disk: ' + (exists ? 'FOUND (' + fs.statSync(skillFile).size + ' bytes)' : 'MISSING'));

  console.log('\n=== Integration test complete ===');

  await bus.shutdown();
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
