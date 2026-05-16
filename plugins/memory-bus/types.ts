/**
 * Memory Bus Plugin — types.ts
 * Unified Memory Bus type definitions for AHE v2.0
 * Grok R16 production-ready schema
 */

// === Event Types ===

export type MemoryEventType =
  | 'user_input'
  | 'agent_response'
  | 'tool_call'
  | 'tool_result'
  | 'user_feedback'
  | 'skill_execution'
  | 'skill_crystallized'
  | 'system_event';

export interface Entity {
  name: string;
  type: string;
  confidence: number; // 0-1
}

export interface Relation {
  source: string;
  type: string;
  target: string;
  confidence: number; // 0-1
}

export interface Provenance {
  memory_id: string;
  source_event_id?: string;
  parent_skill_id?: string;
}

export interface CompressionInfo {
  light_compressed: boolean;
  deep_compressed: boolean;
  original_tokens?: number;
  compressed_tokens?: number;
}

export interface RoutingHints {
  preferred_layer?: 'vector' | 'facts' | 'compiled' | 'skills';
  query_pattern?: string;
}

export interface MemoryEventMetadata {
  session_id?: string;
  importance?: number; // 0-1, initial guess
  layer: 'vector' | 'facts' | 'compiled' | 'skills';
  tags: string[];
  related_ids: string[];
  [key: string]: any; // extensible for domain-specific fields
}

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
}

// === Query Types ===

export type LayerFilter = 'vector' | 'facts' | 'compiled' | 'skills';

export interface MemoryQueryFilter {
  layer_hints?: LayerFilter[];
  tags?: string[];
  since?: string; // ISO-8601
  until?: string; // ISO-8601
  entity_types?: string[];
  min_importance?: number;
}

export interface MemoryQueryOptions {
  intent: string;
  filters?: MemoryQueryFilter;
  top_k?: number;
}

// === Result Types ===

export interface MemoryResult {
  id: string;
  score: number; // 0-1 relevance
  decay_score?: number; // S(t)
  event: MemoryEvent;
}

// === Skill Types ===

export interface SkillDefinition {
  skill_id: string; // UUID v4
  name: string;
  description: string;
  file_path: string;
  success_count: number;
  failure_streak: number;
  last_used: string; // ISO-8601
  decay_score: number; // 0-1
  created_at: string; // ISO-8601
  provenance: {
    source_trajectory_id: string;
    crystallized_by: string;
  };
  tags: string[];
}

// === Crystallization Types ===

export interface CrystallizationRequest {
  trajectory_id: string;
  task_goal: string;
  override_name?: string;
}

export interface CrystallizationResult {
  skill: SkillDefinition;
  markdown_content: string;
  verified: boolean;
  failure_reason?: string;
}

// === n8n Integration Types ===

export interface N8nWebhookPayload {
  action: 'memory_add' | 'memory_compile' | 'trigger_dreaming';
  event?: MemoryEvent;
  source: string;
  timestamp: string;
}

// === Storage Config ===

export interface StorageConfig {
  lancedb_path: string;       // D:\longxiaqiang\tools\ahe\data\memory-bus.lancedb\
  sqlite_path: string;        // D:\longxiaqiang\tools\ahe\data\facts.db
  skills_disk_path: string;   // D:\longxiaqiang\tools\ahe\plugins\memory-bus\skills\
  vector_dim: number;         // embedding dimension (model-dependent)
}
