# Component: Memory Schema

> AHE Component Type: Long-term Memory
> Expected ROI: +5.6pp (paper data — highest impact!)
> Principle: Memory structure is the most impactful hard structure to improve.

## Purpose

Defines how the agent **organizes, writes, reads, and maintains** its memory. This is the highest-ROI component because good memory structure amplifies everything else.

## Template Sections

### 1. Memory Hierarchy

Design a layered memory system:

```
Level 1: Working Memory (ephemeral)
  - Purpose: Current task context
  - Location: In-session context
  - Retention: Session lifetime

Level 2: Daily Log (short-term)
  - Purpose: Day's events, tasks, observations
  - Location: memory/YYYY-MM-DD.md
  - Retention: ~7 days, then distilled

Level 3: Long-term Memory (curated)
  - Purpose: User preferences, important decisions, durable facts
  - Location: MEMORY.md or equivalent
  - Retention: Indefinite

Level 4: Tool Memory (environment-specific)
  - Purpose: Tool paths, configs, known issues
  - Location: TOOLS.md or equivalent
  - Retention: Until environment changes

Level 5: Evolution Memory (AHE-specific)
  - Purpose: Task analyses, pattern recognition, evolution history
  - Location: AHE evidence/
  - Retention: Indefinite
```

### 2. Write Rules

**Must-write triggers:**
- User says "remember this", "save this", "take note"
- Important decision was made
- New tool capability discovered
- Task failure occurred
- Environment configuration changed

**Write quality standards:**
- Be specific (include details, avoid vague notes)
- Include timestamps
- Use searchable keywords
- One fact per bullet point

### 3. Read/Retrieval Strategy

- **Before answering**: Check memory for relevant context
- **On resume**: Read recent daily logs to understand current state
- **On task start**: Quick scan for related prior experience

### 4. Maintenance Schedule

| Frequency | Activity |
|-----------|----------|
| Daily (idle) | Read today's log, flag important items |
| Weekly | Distill daily logs into long-term memory |
| Weekly | Purge outdated entries from long-term memory |
| Monthly | Full memory audit, consolidate duplicates |

### 5. Anti-Patterns

- ❌ Saying "I'll remember that" without writing → must write first
- ❌ Keeping everything in daily logs without distilling → weekly review
- ❌ Deleting without backup → use version control
- ❌ Vague entries ("something about X") → be specific

## Editing Guidelines

- **Highest ROI**: Most impactful component to improve
- **Structure first**: Schema improvements beat content improvements
- **Test readability**: After 3 months, can the agent still understand the schema?
