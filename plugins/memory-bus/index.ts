/**
 * AHE Memory Bus — Unified Memory Bus Plugin
 * v2.1.0-alpha — Fusion Memory Bus + Data Contamination Defense
 *
 * Core capabilities:
 *   memory_add()  — ingest with provenance tracking + contamination scoring
 *   memory_query() — semantic search with S'(t) decay ranking
 *   memory_get()   — direct retrieval by UUID
 *   crystallize_skill() — trajectory → SKILL.md via LLM
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
} from './types.js';

// ─── Configuration ────────────────────────────────────────────
const DEFAULT_DB_DIR = path.join(process.env.AHE_DATA_DIR || path.join(process.cwd(), 'data'), 'lancedb');
const DEFAULT_SKILL_DIR = path.join(process.env.AHE_SKILL_DIR || process.cwd(), 'plugins', 'memory-bus', 'skills');

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
    const scored: MemoryResult[] = allRows
      .map((row: any) => {
        try {
          const event = JSON.parse(row.data as string) as MemoryEvent;
          // Skip seed rows
          if (event.id === '__seed__') return null;
          // Full-text filter in JS (basic contains match)
          const contentMatch = event.content?.toLowerCase().includes(queryLower);
          const tagMatch = event.metadata?.tags?.some((t: string) => t.toLowerCase().includes(queryLower));
          if (!contentMatch && !tagMatch) return null;
          // Type filter
          if (q.type_filter && event.type !== q.type_filter) return null;
          // Quarantine filter
          if (event.contamination?.quarantine_level === 'isolated' || event.contamination?.quarantine_level === 'purged') return null;
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
    // Since we stored JSON blobs, search and parse
    const results = await eventsTable
      .search(id)
      .limit(10)
      .toArray();
    for (const row of results) {
      try {
        const event = JSON.parse(row.data as string);
        if (event.id === id) return event as MemoryEvent;
      } catch { /* skip malformed */ }
    }
    return null;
  }

  // ─── crystallize_skill ───────────────────────────────────

  async crystallize_skill(trajectory: Trajectory): Promise<SkillDefinition> {
    await this.ensureInitialized();

    const skillId = uuidv4();
    const skillName = this.deriveSkillName(trajectory);

    // Build SKILL.md content from trajectory
    const skillContent = this.buildSkillMarkdown(skillName, trajectory);

    // Write to disk (SKILL.md — human-readable + git-versioned)
    const skillDir = path.join(this.config.skillDir, skillName.toLowerCase().replace(/\s+/g, '-'));
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf-8');

    // Index in LanceDB
    const skillsTable = await this.db.openTable('skills');
    const skillMeta: SkillMeta = {
      id: skillId,
      name: skillName,
      path: skillDir,
      source_trajectory_ids: trajectory.steps.map(s => s.id || ''),
      created_at: new Date().toISOString(),
      success_count: 0,
      failure_count: 0,
      reuse_count: 0,
      last_used: null,
      decay_score: 1.0,
      verification_status: 'pending',
    };
    await skillsTable.add(lancedb.makeArrowTable([{ id: skillId, data: JSON.stringify(skillMeta) }]));

    const skill: SkillDefinition = {
      meta: skillMeta,
      content: skillContent,
      trajectory_summary: trajectory.summary || 'Skill crystallized from successful trajectory',
    };

    return skill;
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

  private buildSkillMarkdown(name: string, trajectory: Trajectory): string {
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
