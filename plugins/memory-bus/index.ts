/**
 * AHE Memory Bus — Unified Memory Bus Plugin
 * v3.0.0-alpha — Experiment Manager + 9-State Matrix + Contamination Firewall
 *
 * Core capabilities:
 *   memory_add()  — ingest with provenance tracking + contamination scoring
 *   memory_query() — semantic search with S'(t) decay ranking
 *   memory_get()   — direct retrieval by UUID
 *   crystallize_skill() — trajectory → SKILL.md via LLM
 *   computeChangeMatrix() — 9-state cross-iteration analysis (from official AHE)
 */

import * as lancedb from '@lancedb/lancedb';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import {
  MemoryEvent,
  MemoryQuery,
  MemoryResult,
  MemoryEventType,
  QuarantineLevel,
  ContaminationInfo,
  SkillDefinition,
  SkillMeta,
  Trajectory,
  CrystallizeOptions,
  CrystallizePrompt,
} from './types.js';

// ─── Configuration ────────────────────────────────────────────
// Resolve AHE root: go up from plugins/memory-bus to the ahe repo root
const AHE_ROOT = process.env.AHE_ROOT || path.resolve(process.cwd(), '..', '..');
const DEFAULT_DB_DIR = path.join(process.env.AHE_DATA_DIR || AHE_ROOT, 'data', 'lancedb');
const DEFAULT_SKILL_DIR = path.join(process.env.AHE_SKILL_DIR || AHE_ROOT, 'plugins', 'memory-bus', 'skills');

// Contamination formula weights (Grok R24 default)
const C_WEIGHTS = {
  w1_source: 0.4,
  w2_hallucination: 0.3,
  w3_staleness: 0.15,
  w4_depth: 0.15,
  tau_days: 7, // verification half-life
};

// Decay scoring constants
const DECAY = {
  alpha: 0.01,  // recency decay per day
  utility_bonus: 0.1,
  streak_factor: 0.15,
  graph_boost: 0.05,
};

// ─── Database Layer ──────────────────────────────────────────

interface MemoryBusConfig {
  dbDir?: string;
  skillDir?: string;
  contaminationWeights?: Partial<typeof C_WEIGHTS>;
}

class MemoryBus {
  private db!: lancedb.Connection;
  private config: Required<MemoryBusConfig>;
  private initialized = false;

  constructor(config: MemoryBusConfig = {}) {
    this.config = {
      dbDir: config.dbDir || DEFAULT_DB_DIR,
      skillDir: config.skillDir || DEFAULT_SKILL_DIR,
      contaminationWeights: {
        w1_source: config.contaminationWeights?.w1_source ?? C_WEIGHTS.w1_source,
        w2_hallucination: config.contaminationWeights?.w2_hallucination ?? C_WEIGHTS.w2_hallucination,
        w3_staleness: config.contaminationWeights?.w3_staleness ?? C_WEIGHTS.w3_staleness,
        w4_depth: config.contaminationWeights?.w4_depth ?? C_WEIGHTS.w4_depth,
        tau_days: config.contaminationWeights?.tau_days ?? C_WEIGHTS.tau_days,
      },
    };
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    fs.mkdirSync(this.config.dbDir, { recursive: true });
    fs.mkdirSync(this.config.skillDir, { recursive: true });

    this.db = await lancedb.connect(this.config.dbDir);

    // Create tables with schema enforcement
    await this.ensureTables();

    this.initialized = true;
    console.log('[MemoryBus] Initialized at', this.config.dbDir);
  }

  private async ensureTables(): Promise<void> {
    const tableNames = await this.db.tableNames();
    const { makeArrowTable } = lancedb;

    // Schema seed: JSON blobs stored as string columns for flexibility
    const seedRow = { id: '__seed__', data: '{}' };

    // events table — the core memory store
    if (!tableNames.includes('events')) {
      const eventsInitial = makeArrowTable([seedRow]);
      await this.db.createTable('events', eventsInitial);
      console.log('[MemoryBus] Created events table');
    }

    // skills table — skill-to-event linkage
    if (!tableNames.includes('skills')) {
      const skillsInitial = makeArrowTable([seedRow]);
      await this.db.createTable('skills', skillsInitial);
      console.log('[MemoryBus] Created skills table');
    }

    // kg_nodes and kg_edges for knowledge graph
    if (!tableNames.includes('kg_nodes')) {
      const kgNodesInitial = makeArrowTable([seedRow]);
      await this.db.createTable('kg_nodes', kgNodesInitial);
    }
    if (!tableNames.includes('kg_edges')) {
      const kgEdgesInitial = makeArrowTable([seedRow]);
      await this.db.createTable('kg_edges', kgEdgesInitial);
    }
  }

  // ─── memory_add ──────────────────────────────────────────

  async memory_add(event: Omit<MemoryEvent, 'id' | 'timestamp' | 'provenance' | 'contamination'> & {
    source_event_id?: string;
    source_type?: 'user' | 'llm' | 'tool' | 'system';
    confidence?: number;
  }): Promise<MemoryEvent> {
    await this.ensureInitialized();

    const id = uuidv4();
    const now = new Date().toISOString();

    // Compute provenance depth (Grok R25: best ROI defense)
    let provenanceDepth = 0;
    if (event.source_event_id) {
      try {
        const source = await this.memory_get(event.source_event_id);
        provenanceDepth = (source?.contamination?.provenance_depth ?? 0) + 1;
      } catch { /* source not found, depth stays 0 */ }
    }

    // Compute contamination scores (Grok R24 formula)
    const contamination = this.computeContamination({
      source_type: event.source_type || 'llm',
      confidence: event.confidence ?? 0.7,
      provenance_depth: provenanceDepth,
    });

    const fullEvent: MemoryEvent = {
      id,
      timestamp: now,
      type: event.type || 'fact',
      content: event.content,
      metadata: {
        ...event.metadata,
        created_at: now,
      },
      provenance: {
        source_event_id: event.source_event_id,
        source_type: event.source_type || 'llm',
        confidence: event.confidence ?? 0.7,
        depth: provenanceDepth,
      },
      contamination,
      compression_info: { compressed: false },
      routing_hints: {
        preferred_layer: event.type === 'skill' ? 'skills' :
                        event.type === 'entity' ? 'compiled' : 'vector',
      },
    };

    // Write to LanceDB — use makeArrowTable to build Arrow-compatible data
    const eventsTable = await this.db.openTable('events');
    const arrowData = lancedb.makeArrowTable([{ id, data: JSON.stringify(fullEvent) }]);
    await eventsTable.add(arrowData);

    // Light sync validation: quarantine check
    if (contamination.suspicion_score >= 0.5) {
      console.warn(`[MemoryBus] Event ${id} quarantined (suspicion=${contamination.suspicion_score.toFixed(2)})`);
    }

    return fullEvent;
  }

  // ─── memory_query ────────────────────────────────────────

  async memory_query(q: MemoryQuery): Promise<MemoryResult[]> {
    await this.ensureInitialized();

    const eventsTable = await this.db.openTable('events');
    const limit = q.limit || 10;

    // LanceDB query: fetch all rows, filter in JS (works without embedding/index)
    // For production, create an INVERTED index for FTS or use embedding-based search
    const allRows = await eventsTable.query().limit(Math.max(limit * 10, 100)).toArray();

    // Parse JSON blobs, filter by text match, compute S'(t), rank
    const queryLower = q.query.toLowerCase();
    // Split into keywords for broader matching
    const keywords = queryLower.split(/\s+/).filter((k: string) => k.length > 2);
    const scored: MemoryResult[] = allRows
      .map((row: any) => {
        try {
          const event = JSON.parse(row.data as string) as MemoryEvent;
          // Skip seed rows
          if (event.id === '__seed__') return null;
          // Full-text filter: match any keyword in content or tags
          const contentLower = event.content?.toLowerCase() || '';
          const tagLower = (event.metadata?.tags || []).join(' ').toLowerCase();
          const combined = contentLower + ' ' + tagLower;
          const contentMatch = combined.includes(queryLower);
          const keywordMatch = keywords.some((kw: string) => combined.includes(kw));
          if (!contentMatch && !keywordMatch) return null;
          // Type filter
          if (q.type_filter && event.type !== q.type_filter) return null;
          // Quarantine filter — skip isolated/purged unless explicitly included
          if (!q.include_isolated) {
            const qLevel = event.contamination?.quarantine_level;
            if (qLevel === 'isolated' || qLevel === 'purged') return null;
          }
          const effectiveScore = this.computeEffectiveScore(event);
          return {
            event,
            score: effectiveScore,
            contamination_penalty: event.contamination?.suspicion_score || 0,
          } satisfies MemoryResult;
        } catch { return null; }
      })
      .filter((r): r is MemoryResult => r !== null && (!q.min_score || r.score >= q.min_score))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }

  // ─── memory_get ──────────────────────────────────────────

  async memory_get(id: string): Promise<MemoryEvent | null> {
    await this.ensureInitialized();
    const eventsTable = await this.db.openTable('events');
    // Use query() scan — .search() requires INVERTED index
    const results = await eventsTable
      .query()
      .limit(500)
      .toArray();
    for (const row of results) {
      try {
        const event = JSON.parse(row.data as string) as MemoryEvent;
        if (event.id === id) return event;
      } catch { /* skip malformed */ }
    }
    return null;
  }

  // ─── crystallize_skill ───────────────────────────────────

  /**
   * Crystallize a successful trajectory into a reusable SKILL.md.
   *
   * Two modes:
   * 1. With `llmCall` — uses LLM via skill-crystallizer-prompt to generate production-quality SKILL.md
   * 2. Without `llmCall` — uses template-based markdown generation (fast, but less refined)
   */
  async crystallize_skill(trajectory: Trajectory, options?: CrystallizeOptions): Promise<SkillDefinition> {
    await this.ensureInitialized();

    const skillId = uuidv4();
    const skillName = options?.skillName || this.deriveSkillName(trajectory);

    // Generate SKILL.md content (LLM or template)
    let skillContent: string;
    if (options?.llmCall) {
      const prompt = this.buildCrystallizerPrompt(trajectory, skillName);
      console.log('[MemoryBus] Calling LLM for skill crystallization...');
      skillContent = await options.llmCall(prompt);
      console.log(`[MemoryBus] LLM returned ${skillContent.length} chars`);
    } else {
      console.log('[MemoryBus] Using template-based crystallization (no LLM)');
      skillContent = this.buildSkillMarkdown(skillName, trajectory, options?.tags);
    }

    // Write to disk (SKILL.md — human-readable + git-versioned)
    const safeDirName = skillName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-\u4e00-\u9fff]/g, '');
    const skillDir = path.join(this.config.skillDir, safeDirName);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf-8');

    // Index in LanceDB
    const skillsTable = await this.db.openTable('skills');
    const skillMeta: SkillMeta = {
      id: skillId,
      name: skillName,
      path: skillDir,
      source_trajectory_ids: trajectory.steps.map(s => s.id || uuidv4()),
      created_at: new Date().toISOString(),
      success_count: 0,
      failure_count: 0,
      reuse_count: 0,
      last_used: null,
      decay_score: 1.0,
      verification_status: 'pending',
      tags: options?.tags,
    };
    await skillsTable.add(lancedb.makeArrowTable([{ id: skillId, data: JSON.stringify(skillMeta) }]));

    const skill: SkillDefinition = {
      meta: skillMeta,
      content: skillContent,
      trajectory_summary: trajectory.summary || 'Skill crystallized from successful trajectory',
    };

    return skill;
  }

  /** Build LLM prompt for skill crystallization (Grok R12 template) */
  private buildCrystallizerPrompt(trajectory: Trajectory, skillName: string): CrystallizePrompt {
    const successfulSteps = trajectory.steps.map((s, i) => {
      let text = `Step ${i + 1}: ${s.description}`;
      if (s.tool_call) text += `\n  Tool: ${s.tool_call}`;
      if (s.result) text += `\n  Result: ${s.result}`;
      if (s.verification) text += `\n  Verification: ${s.verification}`;
      return text;
    }).join('\n\n');

    return {
      system: `You are an expert at extracting reusable procedures from AI agent task trajectories.\n\nYour job is to read a successful task trajectory and produce a SKILL.md file that another instance of the same agent can use to reproduce the success.\n\nRules:\n1. Extract ONLY the steps that WORKED (ignore failed attempts within the same trajectory).\n2. Write steps in imperative form (e.g. "Use browser to navigate to the URL", not "I used browser...").\n3. Include VERIFICATION criteria for each step — how does the agent know the step succeeded?\n4. Include a FAILURE ESCAPE for each step — what to do if the step fails.\n5. Keep the procedure under 20 steps. If the trajectory is longer, group steps.\n6. Extract key entities mentioned (URLs, file paths, tool names, concepts) as tags.\n7. Link back to the source trajectory ID for provenance.\n8. Be SPECIFIC. "Search for the file" is bad. "Use es.exe with the pattern '*.xlsx' in D:\\longxiaqiang\\" is good.`,

      user: `## Task Goal\n${trajectory.summary || trajectory.task_type || 'Unknown task'}\n\n## Successful Trajectory\n${successfulSteps}\n\n## Output Format\nProduce a SKILL.md with the following structure:\n\n# Skill: ${skillName}\n\n## Description\n{{ one_sentence_description }}\n\n## When to Use\n{{ trigger_conditions }}\n\n## Prerequisites\n{{ tools_and_knowledge_needed }}\n\n## Procedure\n### Step 1: {{ step_name }}\n- **Action**: {{ what_to_do }}\n- **Verify**: {{ how_to_know_it_worked }}\n- **On Failure**: {{ escape_hatch }}\n\n### Step 2: ...\n\n## Key Entities\n- {{ entity_name }}: {{ entity_type }} ({{ relevance }})\n\n## Success Signals\n- {{ list_of_verifiable_outcomes }}\n\n## Provenance\n- Source trajectory: ${trajectory.steps[0]?.id || 'auto-generated'}\n- Crystallized by: AHE Memory Bus v2.1\n- Created: ${new Date().toISOString()}\n\n## Tags\n{{ comma_separated_tags }}`,
    };
  }

  // ─── Contamination Scoring (Grok R24) ───────────────────

  private computeContamination(input: {
    source_type: string;
    confidence: number;
    provenance_depth: number;
  }): ContaminationInfo {
    const source_score_map: Record<string, number> = {
      user: 0.0,
      tool: 0.1,
      system: 0.2,
      llm: 0.3,
    };
    const sourceScore = source_score_map[input.source_type] ?? 0.3;

    // hallucination_likelihood = 1 - confidence
    const hallucinationLikelihood = Math.max(0, 1 - input.confidence);

    // Depth penalty: +0.2 per hop beyond the first (Grok R25)
    const depthScore = Math.min(1, input.provenance_depth * 0.2);

    const suspicion =
      this.getWeight('w1_source') * sourceScore +
      this.getWeight('w2_hallucination') * hallucinationLikelihood +
      this.getWeight('w4_depth') * depthScore;
    // Note: w3 (staleness) is computed at query time, not ingest time

    const quarantineLevel = suspicion >= 0.8 ? 'purged' :
                            suspicion >= 0.5 ? 'isolated' :
                            suspicion >= 0.2 ? 'suspicious' : 'clean';

    return {
      suspicion_score: Math.min(1, Math.max(0, suspicion)),
      quarantine_level: quarantineLevel as QuarantineLevel,
      contamination_source_score: sourceScore,
      hallucination_likelihood: hallucinationLikelihood,
      provenance_depth: input.provenance_depth,
      validation_result: 'unverified',
    };
  }

  private computeContaminationScore(event: MemoryEvent): number {
    const c = event.contamination;
    if (!c) return 0;

    // Staleness: days since last validation (Grok R24: τ=7 days)
    let stalenessScore = 0;
    if (c.last_validated) {
      const daysSinceValidation =
        (Date.now() - new Date(c.last_validated).getTime()) / (1000 * 60 * 60 * 24);
      stalenessScore = 1 - Math.exp(-daysSinceValidation / this.getWeight('tau_days'));
    } else {
      // Never validated → max staleness
      stalenessScore = 1;
    }

    const totalC =
      this.getWeight('w1_source') * (c.contamination_source_score || 0) +
      this.getWeight('w2_hallucination') * (c.hallucination_likelihood || 0) +
      this.getWeight('w3_staleness') * stalenessScore +
      this.getWeight('w4_depth') * Math.min(1, (c.provenance_depth || 0) * 0.2);

    return Math.min(1, Math.max(0, totalC));
  }

  // ─── Decay Scoring S(t) ─────────────────────────────────

  private computeEffectiveScore(event: MemoryEvent): number {
    // Base decay S(t)
    const daysSinceCreation =
      (Date.now() - new Date(event.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const recencyDecay = Math.exp(-DECAY.alpha * daysSinceCreation);

    const successCount = event.metadata?.success_count ?? 0;
    const reuseCount = event.metadata?.reuse_count ?? 0;

    // Utility = base from success, boosted by streak
    const utility = Math.min(1, successCount * DECAY.utility_bonus);
    const streak = reuseCount > 0 ? Math.min(1, reuseCount * DECAY.streak_factor) : 0;

    // S(t) — raw decay score before contamination penalty
    const st = recencyDecay * (0.5 + utility + streak + DECAY.graph_boost);

    // C — contamination penalty
    const c = this.computeContaminationScore(event);

    // S'(t) = S(t) × (1 - C)
    const effectiveScore = st * (1 - c);

    return Math.min(1, Math.max(0, effectiveScore));
  }

  // ─── Skill Helpers ──────────────────────────────────────

  private deriveSkillName(trajectory: Trajectory): string {
    if (trajectory.task_type) return trajectory.task_type;
    if (trajectory.summary) {
      // Take first 50 chars as name hint
      return trajectory.summary.slice(0, 50).replace(/[^a-zA-Z0-9\s\u4e00-\u9fff-]/g, '');
    }
    return `skill-${Date.now()}`;
  }

  private buildSkillMarkdown(name: string, trajectory: Trajectory, tags?: string[]): string {
    const lines: string[] = [
      `# ${name}`,
      '',
      `> Auto-generated by AHE Memory Bus v2.1 — ${new Date().toISOString()}`,
      '',
      '## Summary',
      '',
      trajectory.summary || 'Crystallized from execution trajectory.',
      '',
      '## Steps',
      '',
    ];

    for (const step of trajectory.steps) {
      lines.push(`### ${step.description || 'Step'}`);
      if (step.tool_call) lines.push(`- Tool: \`${step.tool_call}\``);
      if (step.result) lines.push(`- Result: ${step.result}`);
      if (step.verification) lines.push(`- Verification: ${step.verification}`);
      lines.push('');
    }

    if (trajectory.dependencies?.length) {
      lines.push('## Dependencies');
      lines.push('');
      for (const dep of trajectory.dependencies) {
        lines.push(`- ${dep}`);
      }
      lines.push('');
    }

    lines.push('## Verification Checklist');
    lines.push('');
    lines.push('- [ ] All steps verified against execution trace');
    lines.push('- [ ] File paths match current environment');
    lines.push('- [ ] Tool names confirmed in current registry');
    lines.push('- [ ] Output matches expected format');
    lines.push('');

    return lines.join('\n');
  }

  // ─── Nightly Dreaming Helpers ──────────────────────────

  async getUnverifiedSkills(): Promise<SkillDefinition[]> {
    await this.ensureInitialized();
    const skillsTable = await this.db.openTable('skills');
    const results = await skillsTable
      .search('pending')
      .limit(100)
      .toArray();
    return results
      .map((row: any) => {
        try {
          const parsed = JSON.parse(row.data as string);
          if (parsed.verification_status === 'pending') {
            return { meta: parsed as SkillMeta, content: '', trajectory_summary: '' };
          }
        } catch { /* skip */ }
        return null;
      })
      .filter((r: any): r is SkillDefinition => r !== null);
  }

  async getSuspiciousEvents(minScore: number = 0.3): Promise<MemoryEvent[]> {
    await this.ensureInitialized();
    const eventsTable = await this.db.openTable('events');
    const results = await eventsTable
      .search('')
      .limit(500)
      .toArray();
    return results
      .map((row: any) => {
        try {
          const event = JSON.parse(row.data as string) as MemoryEvent;
          if ((event.contamination?.suspicion_score || 0) >= minScore) return event;
        } catch { /* skip */ }
        return null;
      })
      .filter((r: any): r is MemoryEvent => r !== null);
  }

  private getWeight(key: keyof typeof C_WEIGHTS): number {
    return this.config.contaminationWeights[key] ?? C_WEIGHTS[key];
  }

  // ─── v3.0 Extension: Change Matrix ───────────────────────

  /**
   * Compute 9-state change matrix between two sets of task results.
   * Directly adapted from official AHE's evolve.py change tracking.
   */
  computeChangeMatrix(
    previous: Array<{ taskId: string; taskName: string; status: 'pass' | 'fail' | 'exception'; score: number }>,
    current: Array<{ taskId: string; taskName: string; status: 'pass' | 'fail' | 'exception'; score: number }>
  ): {
    flipped: number;
    regressed: number;
    stable_pass: number;
    stable_fail: number;
    infra_recovered: number;
    infra_lost: number;
    exception_to_fail: number;
    fail_to_exception: number;
    exception_stable: number;
    netImprovement: number;
    passRateBefore: number;
    passRateAfter: number;
    details: Array<{ taskId: string; taskName: string; from: string; to: string; state: string; scoreDelta: number }>;
  } {
    const currentMap = new Map(current.map(t => [t.taskId, t]));
    const details: any[] = [];
    const counts = {
      flipped: 0, regressed: 0, stable_pass: 0, stable_fail: 0,
      infra_recovered: 0, infra_lost: 0, exception_to_fail: 0,
      fail_to_exception: 0, exception_stable: 0,
    };

    for (const prev of previous) {
      const cur = currentMap.get(prev.taskId);
      if (!cur) continue;

      const ps = prev.status;
      const cs = cur.status;
      let state: string;

      if (ps === 'fail' && cs === 'pass') state = 'flipped';
      else if (ps === 'pass' && cs === 'fail') state = 'regressed';
      else if (ps === 'pass' && cs === 'pass') state = 'stable_pass';
      else if (ps === 'fail' && cs === 'fail') state = 'stable_fail';
      else if (ps === 'exception' && cs === 'pass') state = 'infra_recovered';
      else if (ps === 'pass' && cs === 'exception') state = 'infra_lost';
      else if (ps === 'exception' && cs === 'fail') state = 'exception_to_fail';
      else if (ps === 'fail' && cs === 'exception') state = 'fail_to_exception';
      else state = 'exception_stable';

      (counts as any)[state]++;
      details.push({
        taskId: prev.taskId,
        taskName: prev.taskName,
        from: ps,
        to: cs,
        state,
        scoreDelta: cur.score - prev.score,
      });
    }

    const passBefore = previous.filter(t => t.status === 'pass').length / previous.length;
    const passAfter = current.filter(t => t.status === 'pass').length / current.length;

    return {
      ...counts,
      netImprovement: counts.flipped - counts.regressed,
      passRateBefore: passBefore,
      passRateAfter: passAfter,
      details,
    };
  }

  // ─── Internal ───────────────────────────────────────────

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }

  async shutdown(): Promise<void> {
    // LanceDB closes on scope exit
    this.initialized = false;
    console.log('[MemoryBus] Shutdown complete');
  }
}

// ─── Exports ──────────────────────────────────────────────

export { MemoryBus, MemoryBusConfig, C_WEIGHTS, DECAY };

// Plugin entry for OpenClaw plugin system
export async function plugin_init(config?: MemoryBusConfig): Promise<MemoryBus> {
  const bus = new MemoryBus(config);
  await bus.initialize();
  return bus;
}

// Default singleton
let _defaultBus: MemoryBus | null = null;

export async function getMemoryBus(config?: MemoryBusConfig): Promise<MemoryBus> {
  if (!_defaultBus) {
    _defaultBus = new MemoryBus(config);
    await _defaultBus.initialize();
  }
  return _defaultBus;
}
