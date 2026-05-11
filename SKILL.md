# AHE Skill - Self-Evolution Rules

> This SKILL.md tells your AI agent **how to use AHE**. Read this first.

AHE (Agentic Harness Engineering) is a **self-evolution system** for your AI agent.
It lets the agent learn from every task and continuously improve its working style.

**This is for the agent to read, not for end users.**

## How to Trigger Evolution

### Trigger 1: After Task Failure (Immediate)

Signals to detect:
- User says "wrong", "no", "not what I wanted", "do it again"
- Tool calls return errors
- User corrects your understanding
- Result is clearly suboptimal or wrong
- User expresses frustration

Steps:
1. Write structured analysis report → `evidence/reports/YYYY-MM-DD-HH-MM.md`
2. Identify which component(s) from the 7 types failed
3. Propose specific modification + prediction
4. Log to `manifest/changes.jsonl`
5. Apply the edit
6. `git commit`

### Trigger 2: During Idle Periods (Periodic)

When you have idle time and no urgent tasks:
- If >24h since last evolution:
  1. Read recent reports from `evidence/reports/` (last 7 days)
  2. Aggregate to `evidence/overview.md`
  3. Check for recurring patterns
  4. If pattern found, propose targeted fixes
  5. Log + apply

### Trigger 3: Weekly Review (Cron-scheduled)

Every week:
1. Read all `evidence/reports/`
2. Update `evidence/overview.md` and `evidence/patterns.md`
3. Check `manifest/changes.jsonl` for unverified changes
4. On next similar task, proactively verify pending predictions
5. Summarize week's evolution results

## Analysis Report Template

Save as: `evidence/reports/YYYY-MM-DD-HH-MM.md`

```markdown
# Task Analysis Report

## Meta
- Time: YYYY-MM-DD HH:MM
- Task: [brief description]
- Result: SUCCESS / FAILURE / PARTIAL

## Failure Analysis (FAILURE/PARTIAL only)
- Observation: [What went wrong from user's perspective]
- Root Cause: [Why it happened]
- Component(s): [system-rules / tool-policies / environment / skills-registry / delegation-rules / memory-schema / workflow-patterns]

## Lesson
- What we learned: [specific takeaway]
- Suggested fix: [specific change]

## Prediction
- If we modify [component X], expected: [effect]
- Risk: [potential downside]
```

## Change Log Format

Append one JSON line to `manifest/changes.jsonl`:

```json
{"timestamp":"2026-05-06T23:30:00+08:00","iteration":1,"component":"tool-policies","evidence":"evidence/reports/2026-05-06-23-25.md","change":"Added es.exe priority for file search tasks","prediction":{"expected_fix":"All file search tasks complete quickly","at_risk":"Might miss files that es.exe doesn't index"}}
```

## Verification Log Format

Append one JSON line to `manifest/verdicts.jsonl`:

```json
{"timestamp":"2026-05-07T10:00:00+08:00","change_timestamp":"2026-05-06T23:30:00+08:00","task":"Search for config files","result":"SUCCESS","note":"Used es.exe, found results in <1s"}
```

## Component Edit Rules

1. **One component per change**: Never edit multiple components in one iteration
2. **Read before edit**: Read current content before modifying
3. **Append, don't rewrite**: Most changes add new experience, don't replace existing
4. **Keep history**: `git commit` all changes
5. **Rollback ready**: If new change causes issues, `git revert`

## Evolution Priority

Based on paper data (highest ROI first):
1. **Memory structure** (+5.6pp) → `components/memory-schema.md`
2. **Tool policies** (+3.3pp) → `components/tool-policies.md`
3. **Environment/Middleware** (+2.2pp) → `components/environment.md`
4. **System rules** (-2.3pp) → `components/system-rules.md` (be careful!)

Prioritize high-ROI components first.

## Relation to Other Config Files

- **AGENTS.md / SYSTEM PROMPT** → Core behavioral guidelines, AHE refines into `system-rules.md`
- **TOOLS.md / custom tool notes** → AHE refines into `tool-policies.md`
- **MEMORY.md / long-term memory** → AHE optimizes memory structure in `memory-schema.md`
- **External validation tools** (judge.py etc.) → AHE can trigger pre-output validation

AHE doesn't replace your existing system. It makes it better through structured self-evolution.

## Principles

1. **Change components, not code** — don't modify tool implementations, gateway configs, or system core
2. **Every change has a prediction** — no prediction = blind trial
3. **Invalid changes get reverted** — git is your safety net
4. **Hard structures transfer across models** — tool/memory/policy improvements work on any model; prompt tweaks don't
5. **This is for the agent** — end users don't interact with these files directly
