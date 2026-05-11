# Example: Fixing "Blind File Search" Anti-Pattern

> A real AHE evolution cycle recorded during LobsterAI's daily operations.

## Background

The AI agent (LobsterAI, an OpenClaw-based coding agent running on Windows) was asked by its user to find specific files across the D: drive workspace. This is a common recurring task — the user works with hundreds of files across dozens of subdirectories.

## ❌ The Failure

**Task**: "Search for all Python scripts in the project directories"

**What the agent did**: Used `Get-ChildItem -Recurse` (the PowerShell equivalent of `find`) to scan the entire D: drive.

```powershell
Get-ChildItem D:\ -Recurse -Filter *.py
```

**Result**: The command ran for 120+ seconds before being killed by a timeout. The user waited and got nothing. This happened **multiple times** across different sessions.

## 🔍 AHE Analysis

Following the AHE evolution loop, the agent wrote a structured analysis report:

```markdown
# Task Analysis Report

## Meta
- Time: 2026-05-03 23:30
- Task: Search for Python files on D: drive
- Result: FAILURE

## Failure Analysis
- Observation: Command timed out (>120s), user frustrated
- Root Cause: Full-disk recursive scan is too slow for large drives.
  The agent has access to es.exe (Everything search, indexed file search)
  but the tool-policies.md component didn't document this as the priority tool.
- Component: tool-policies.md

## Lesson
- Indexed search is O(1) for filename queries vs. O(n) for recursive scan
- For file search tasks, the agent should check for indexed search tools first

## Prediction
- If we add "es.exe priority rule" to tool-policies.md,
  all future file search tasks will complete in <1 second.
- Risk: es.exe might not be running; need a fallback path.
```

## 🔧 The Change

The agent identified that this was a `tool-policies.md` component issue. It modified the component file:

**Before** (file search section missing):
```markdown
## File Operations
- Use `Get-ChildItem -Recurse` for file search
```

**After** — added anti-pattern + correct approach:
```markdown
## File Operations

### Indexed Search (Priority)
| Tool | Path | Use Case |
|------|------|----------|
| es.exe | D:\longxiaqiang\tools\skills\es\es.exe | All filename/extension queries (O(1) indexed) |

### Recursive Search (Fallback)
| Tool | Use Case | Warning |
|------|----------|---------|
| Get-ChildItem -Recurse | Small directories only | Never use on D:\ or C:\ root — will timeout on large drives |

### Anti-Pattern
❌ `Get-ChildItem D:\ -Recurse -Filter *.py` — full-drive recursive scan, times out
✅ `es.exe "ext:py"` — indexed search, completes in <1s
```

Logged to `manifest/changes.jsonl`:
```json
{
  "timestamp": "2026-05-03T23:30:00+08:00",
  "iteration": 1,
  "component": "tool-policies",
  "evidence": "evidence/reports/2026-05-03-23-30.md",
  "change": "Added es.exe indexed search priority rule for file search tasks",
  "prediction": {
    "expected_fix": "All file search tasks complete in <1 second",
    "at_risk": "es.exe may not be running; fallback needed"
  }
}
```

## ✅ Verification

**Next similar task** (2026-05-04 10:00): User asked "find all .md files in the project"

Agent immediately used `es.exe "ext:md"` → found 847 files in **0.8 seconds**.

Logged to `manifest/verdicts.jsonl`:
```json
{
  "timestamp": "2026-05-04T10:00:00+08:00",
  "change_timestamp": "2026-05-03T23:30:00+08:00",
  "task": "Search for all .md files",
  "result": "SUCCESS",
  "note": "es.exe completed in 0.8s vs. 120+ seconds with recursive scan"
}
```

## 📊 Impact Summary

| Metric | Before AHE | After AHE | Improvement |
|--------|-----------|-----------|-------------|
| File search time | 120+ seconds (timeout) | <1 second | **120x faster** |
| User complaints | 3+ per week | 0 | **Eliminated** |
| Cross-model transfer | — | New model also uses es.exe first | ✅ Works across models |

## Key Takeaways

1. **The fix was in tool-policies.md, not in prompts.** Rewriting the prompt to say "use es.exe" would have fixed this one case but not generalized. The tool policy fix affected ALL file search tasks.

2. **The change persisted across model swaps.** When the agent switched from deepseek-v4 to another model, the tool-policies.md component carried over and the new model immediately used es.exe.

3. **This matches the paper's key finding.** Tool policies improve pass rates by +3.3pp — more than prompt tweaks (-2.3pp).

## Reproduce This Evolution

To reproduce this evolution cycle in your own AHE deployment:

1. Use an agent that has access to both indexed search (es.exe, Spotlight, mlocate) and recursive scan
2. Start with an empty `tool-policies.md` — no search strategy documented
3. Ask the agent to search for files across the entire filesystem
4. The agent will likely use recursive scan and time out
5. Follow the AHE SKILL.md to write the analysis, identify the component, and apply the fix
6. Verify on the next file search task
