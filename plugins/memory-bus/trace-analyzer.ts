/**
 * AHE v3.0 — Trace Analyzer (Pluggable Backend)
 * 
 * Lightweight replica of official Agent Debugger (which is partially closed-source).
 * Supports: LLM mode, rule-based mode, hybrid mode.
 * Output: structured report (root cause + affected components + fix + confidence + evidence).
 */

import { MemoryEvent, ContaminationInfo, QuarantineLevel } from './types.js';
import { TraceAnalysisReport, AnalyzerConfig } from './types_v3.js';

const RULE_PATTERNS: Array<{
  pattern: RegExp;
  errorCategory: TraceAnalysisReport['errorCategory'];
  component: string;
}> = [
  { pattern: /cannot find module|MODULE_NOT_FOUND|no such file|ENOENT/i, errorCategory: 'path_error', component: 'environment.md' },
  { pattern: /permission denied|EACCES|not authorized|401|403/i, errorCategory: 'config_error', component: 'system-rules.md' },
  { pattern: /timeout|timed out|ETIMEDOUT|ECONNREFUSED/i, errorCategory: 'external_error', component: 'tool-policies.md' },
  { pattern: /undefined is not|TypeError|ReferenceError|unexpected token/i, errorCategory: 'logic_error', component: 'tool-policies.md' },
  { pattern: /memory|out of memory|heap|OOM/i, errorCategory: 'config_error', component: 'memory-schema.md' },
  { pattern: /rate limit|too many requests|429/i, errorCategory: 'external_error', component: 'tool-policies.md' },
];

export class TraceAnalyzer {
  private config: AnalyzerConfig;

  constructor(config: AnalyzerConfig) {
    this.config = {
      mode: config.mode || 'hybrid',
      llmBackend: config.llmBackend || 'deepseek',
      llmCall: config.llmCall,
      rulesPath: config.rulesPath,
    };
  }

  async analyze(
    taskId: string,
    events: MemoryEvent[],
    sessionTrace?: string
  ): Promise<TraceAnalysisReport> {
    // Step 1: Rule-based analysis (always runs as baseline)
    const ruleReport = this.ruleBasedAnalysis(taskId, events);

    // Step 2: LLM enhancement if available and mode != 'rule'
    if (this.config.mode !== 'rule' && this.config.llmCall) {
      try {
        const llmReport = await this.llmAnalysis(taskId, events, sessionTrace);
        return this.mergeReports(ruleReport, llmReport);
      } catch {
        // LLM failed, fall back to rule-based
        // Don't auto-merge — just return rule report + note
        ruleReport.rootCause = `[LLM analysis failed, rule-based result] ${ruleReport.rootCause}`;
      }
    }

    return ruleReport;
  }

  // ─── Rule-Based Analysis ────────────────────────────────────

  private ruleBasedAnalysis(taskId: string, events: MemoryEvent[]): TraceAnalysisReport {
    const errorEvents = events.filter(e => e.type === 'error');
    const evidence: string[] = [];
    let rootCause = 'No specific root cause identified';
    let affectedComponents: string[] = [];
    let errorCategory: TraceAnalysisReport['errorCategory'] = 'unknown';
    let confidence = 0.3;

    // Match error events against rule patterns
    for (const event of errorEvents) {
      for (const rule of RULE_PATTERNS) {
        if (rule.pattern.test(event.content)) {
          evidence.push(event.content.slice(0, 200));
          affectedComponents.push(rule.component);
          errorCategory = rule.errorCategory;
          confidence = 0.6;
        }
      }
    }

    // Deduplicate components
    affectedComponents = [...new Set(affectedComponents)];

    // Derive root cause from the first matched error
    if (evidence.length > 0) {
      rootCause = this.deriveRootCause(errorCategory, evidence[0]);
    }

    // Determine suggested fix
    const suggestedFix = this.suggestFix(errorCategory, affectedComponents);

    // Contamination assessment
    const contamination: ContaminationInfo = {
      suspicion_score: confidence < 0.5 ? 0.4 : 0.15,
      quarantine_level: confidence < 0.5 ? 'suspicious' : 'clean',
      provenance_depth: 2,
      last_validated: new Date().toISOString(),
      validated_by: ['rule:pattern-match'],
    };

    return {
      taskId,
      analyzedAt: new Date().toISOString(),
      rootCause,
      affectedComponents: affectedComponents.length > 0 ? affectedComponents : ['unknown'],
      suggestedFix,
      confidence,
      evidence: evidence.slice(0, 5),
      contaminationAssessment: contamination,
      errorCategory,
    };
  }

  // ─── LLM Analysis ───────────────────────────────────────────

  private async llmAnalysis(
    taskId: string,
    events: MemoryEvent[],
    sessionTrace?: string
  ): Promise<TraceAnalysisReport> {
    if (!this.config.llmCall) {
      throw new Error('LLM call function not configured');
    }

    const errorEvents = events.filter(e => e.type === 'error');
    const traceSnippet = sessionTrace?.slice(0, 2000) || events.map(e => e.content).join('\n').slice(0, 2000);

    const prompt = `Analyze this task failure trace and produce a structured report:

Task ID: ${taskId}
Trace excerpt:
${traceSnippet}

Error events:
${errorEvents.map(e => `- ${e.content.slice(0, 300)}`).join('\n') || 'No error events'}

Output JSON with these fields:
{
  "root_cause": "one sentence explaining the root cause",
  "affected_components": ["component names from: environment, tool-policies, memory-schema, system-rules, workflow-patterns, skill-crystallizer-prompt, skills-registry, delegation-rules"],
  "suggested_fix": "concrete fix suggestion",
  "confidence": 0.0-1.0,
  "error_category": "path_error|tool_error|logic_error|config_error|external_error|unknown",
  "evidence": ["key evidence snippets from trace"]
}`;

    const response = await this.config.llmCall(prompt);
    
    try {
      const parsed = JSON.parse(response);
      return {
        taskId,
        analyzedAt: new Date().toISOString(),
        rootCause: parsed.root_cause || 'LLM analysis incomplete',
        affectedComponents: parsed.affected_components || [],
        suggestedFix: parsed.suggested_fix || 'No suggestion',
        confidence: parsed.confidence || 0.5,
        evidence: parsed.evidence || [],
        contaminationAssessment: {
          suspicion_score: 0.15,
          quarantine_level: 'clean',
          provenance_depth: 3,
          last_validated: new Date().toISOString(),
          validated_by: [this.config.llmBackend || 'llm'],
        },
        errorCategory: parsed.error_category || 'unknown',
      };
    } catch {
      throw new Error('Failed to parse LLM analysis response');
    }
  }

  // ─── Merge ───────────────────────────────────────────────────

  private mergeReports(rule: TraceAnalysisReport, llm: TraceAnalysisReport): TraceAnalysisReport {
    return {
      taskId: rule.taskId,
      analyzedAt: new Date().toISOString(),
      rootCause: llm.confidence > rule.confidence ? llm.rootCause : rule.rootCause,
      affectedComponents: [...new Set([...rule.affectedComponents, ...llm.affectedComponents])],
      suggestedFix: llm.confidence > 0.5 ? llm.suggestedFix : rule.suggestedFix,
      confidence: Math.max(rule.confidence, llm.confidence),
      evidence: [...rule.evidence, ...llm.evidence].slice(0, 5),
      contaminationAssessment: llm.confidence > 0.7 ? llm.contaminationAssessment : rule.contaminationAssessment,
      errorCategory: llm.confidence > rule.confidence ? llm.errorCategory : rule.errorCategory,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private deriveRootCause(category: TraceAnalysisReport['errorCategory'], evidence: string): string {
    switch (category) {
      case 'path_error': return `Path resolution error: ${evidence.slice(0, 100)}`;
      case 'config_error': return `Configuration error detected: ${evidence.slice(0, 100)}`;
      case 'external_error': return `External service error: ${evidence.slice(0, 100)}`;
      case 'logic_error': return `Code logic error: ${evidence.slice(0, 100)}`;
      case 'tool_error': return `Tool execution error: ${evidence.slice(0, 100)}`;
      default: return `Unclassified error: ${evidence.slice(0, 100)}`;
    }
  }

  private suggestFix(category: TraceAnalysisReport['errorCategory'], components: string[]): string {
    const componentHint = components.length > 0 ? ` in ${components.join(', ')}` : '';
    switch (category) {
      case 'path_error': return `Update path references${componentHint}. Ensure all file paths use correct disk letter (D:\\) and exist.`;
      case 'config_error': return `Review configuration${componentHint}. Check permission settings and memory limits.`;
      case 'external_error': return `Add retry logic and exponential backoff${componentHint}. Verify network connectivity.`;
      case 'logic_error': return `Fix the identified error${componentHint}. Add input validation and error handling.`;
      case 'tool_error': return `Review tool policies${componentHint}. Update tool calling patterns.`;
      default: return `Manual investigation needed${componentHint}. Review the full trace.`;
    }
  }
}

// ─── Incremental Analyzer ─────────────────────────────────────

export class IncrementalAnalyzer {
  private analyzer: TraceAnalyzer;
  private lastAnalysisTime: string | null = null;

  constructor(config: AnalyzerConfig) {
    this.analyzer = new TraceAnalyzer(config);
  }

  async analyzeNewEvents(
    taskId: string,
    allEvents: MemoryEvent[],
    sessionTrace?: string
  ): Promise<TraceAnalysisReport> {
    // Only analyze events since last analysis
    const newEvents = this.lastAnalysisTime
      ? allEvents.filter(e => e.timestamp > this.lastAnalysisTime!)
      : allEvents;

    const report = await this.analyzer.analyze(taskId, newEvents, sessionTrace);
    this.lastAnalysisTime = new Date().toISOString();
    return report;
  }

  reset(): void {
    this.lastAnalysisTime = null;
  }
}
