/**
 * AHE Memory Bus — Type Definitions v2.1.0-alpha
 * Covers: MemoryEvent, Query, Skills, Contamination, KG
 */

// ─── Event Types ────────────────────────────────────────────

export type MemoryEventType = 'fact' | 'decision' | 'error' | 'skill' | 'entity' | 'relation' | 'compression';

export interface MemoryEventMetadata {
  created_at?: string;
  source_agent?: string;
  success_count?: number;
  reuse_count?: number;
  tags?: string[];
  [key: string]: any;
}

export interface Provenance {
  source_event_id?: string;
  source_type: 'user' | 'llm' | 'tool' | 'system';
  confidence: number; // 0-1
  depth: number;
}

export interface CompressionInfo {
  compressed: boolean;
  original_ids?: string[];
  compressed_at?: string;
  method?: string;
}

export interface RoutingHints {
  preferred_layer?: 'vector' | 'facts' | 'compiled' | 'skills';
  query_pattern?: string;
}

// ─── Contamination Types (v2.1 - Grok R21-R25) ──────────────

export type QuarantineLevel = 'clean' | 'suspicious' | 'isolated' | 'purged';
export type ValidationResult = 'verified' | 'contradicted' | 'unverified';

export interface ContaminationInfo {
  suspicion_score: number;               // 0-1, higher = more suspicious
  quarantine_level: QuarantineLevel;
  contamination_source_score?: number;   // 0-1, source trustworthiness (R24: w₁=0.4)
  hallucination_likelihood?: number;     // 0-1, LLM hallucination probability (R24: w₂=0.3)
  provenance_depth: number;              // hops from verified source (R25: +0.2 per hop)
  last_validated?: string;               // ISO-8601 (R24: τ=7 day half-life)
  validated_by?: string[];               // e.g. ["gpt-5", "claude-sonnet-4", "rule:path-check"]
  validation_result?: ValidationResult;
}

// ─── Memory Event ───────────────────────────────────────────

export interface MemoryEvent {
  id: string; // UUID v4
  timestamp: string; // ISO-8601
  type: MemoryEventType;
  content: string;
  embedding?: number[];
  metadata: MemoryEventMetadata;
  entities?: Entity[];
  relations?: Relation[];
  provenance: Provenance;
  compression_info: CompressionInfo;
  routing_hints: RoutingHints;
  contamination: ContaminationInfo; // v2.1: data contamination defense
}

// ─── Knowledge Graph ────────────────────────────────────────

export interface Entity {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, any>;
}

export interface Relation {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  weight?: number;
}

// ─── Query Types ────────────────────────────────────────────

export interface MemoryQuery {
  query: string;
  limit?: number;
  type_filter?: MemoryEventType;
  min_score?: number;
  include_isolated?: boolean;
  embedding?: number[];
}

export interface MemoryResult {
  event: MemoryEvent;
  score: number;
  contamination_penalty: number;
}

// ─── Skill Types ────────────────────────────────────────────

export interface SkillMeta {
  id: string;
  name: string;
  path: string;
  source_trajectory_ids: string[];
  created_at: string;
  success_count: number;
  failure_count: number;
  reuse_count: number;
  last_used: string | null;
  decay_score: number;
  verification_status: 'pending' | 'verified' | 'failed';
  tags?: string[];
}

export interface SkillDefinition {
  meta: SkillMeta;
  content: string; // SKILL.md content
  trajectory_summary: string;
}

// ─── Trajectory (for crystallization) ───────────────────────

export interface TrajectoryStep {
  id?: string;
  description: string;
  tool_call?: string;
  result?: string;
  verification?: string;
}

export interface Trajectory {
  task_type?: string;
  summary?: string;
  steps: TrajectoryStep[];
  dependencies?: string[];
  duration_ms?: number;
  success: boolean;
}

// ─── Crystallization LLM Options ────────────────────────────

export interface CrystallizeOptions {
  /** LLM call function — if provided, uses LLM to generate high-quality SKILL.md */
  llmCall?: (prompt: CrystallizePrompt) => Promise<string>;
  /** Override skill name (default: derived from trajectory) */
  skillName?: string;
  /** Tags to attach */
  tags?: string[];
}

export interface CrystallizePrompt {
  system: string;
  user: string;
}

// ─── Compression ────────────────────────────────────────────

export interface CompressionConfig {
  method: 'light' | 'deep';
  target_comparison_ratio?: number;
  keep_entities?: boolean;
  keep_key_decisions?: boolean;
}
