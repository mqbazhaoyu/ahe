# AHE - Agentic Harness Engineering

**Let your AI Agent auto-evolve its own harness — tools, memory, environment, and workflows — from real task outcomes.**

AHE (Agentic Harness Engineering) is a self-evolution framework for AI coding agents. Instead of manually tweaking prompts, AHE lets the agent **systematically analyze its own successes and failures, then self-improve its structural components** (tool descriptions, memory schemas, environment configs, workflow patterns).

Based on the paper: [*Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses*](https://arxiv.org/abs/2604.25850) (arXiv:2604.25850, Apr 2026, Fudan University / PKU / Qiji Zhifeng).

## Why AHE?

Traditional agent optimization is trial-and-error: humans manually edit prompts and hope for the best.

The paper found:

- **Editing prompts?** → **-2.3pp** (makes things worse!)
- **Editing tool policies?** → **+3.3pp**
- **Editing middleware/environment?** → **+2.2pp**
- **Editing memory structure?** → **+5.6pp** (biggest win!)
- **Cross-model transfer?** → Improved harnesses still give **+5.1 to +10.1pp** on other models

**The insight**: Don't improve the agent by rewriting prompts. Improve the *harness* — the structural components around the agent.

## How It Works

AHE decomposes the agent's "harness" into **7 independently editable component files**:

```
ahe/
├── components/
│   ├── system-rules.md         # Core behavioral rules
│   ├── tool-policies.md        # Tool usage strategies (when to use what)
│   ├── environment.md          # Environment knowledge (proxies, paths, OS quirks)
│   ├── skills-registry.md      # Skill directory and trigger logic
│   ├── delegation-rules.md     # Sub-agent delegation rules
│   ├── memory-schema.md        # Memory structure and review cycles
│   └── workflow-patterns.md    # Reusable workflow templates
├── evidence/
│   ├── reports/                # Task analysis reports (timestamps)
│   ├── overview.md             # Pattern aggregation
│   └── patterns.md             # Identified recurring patterns
├── manifest/
│   ├── changes.jsonl           # Every change + prediction
│   └── verdicts.jsonl          # Verification results
├── SKILL.md                    # The agent's instructions for using AHE
└── CHANGELOG.md                # Evolution iteration history
```

## Core Loop (Algorithm 1)

```
1. Execute task (naturally during daily work)
2. On task completion, evaluate result
3. If failure or suboptimal:
   a. Write structured analysis → evidence/reports/
   b. Identify which component(s) are involved
   c. Propose change + prediction → manifest/changes.jsonl
   d. Apply change (git commit)
4. On next similar task, verify prediction:
   a. Success → record in manifest/verdicts.jsonl
   b. Failure → rollback (git revert)
5. Periodic aggregation → evidence/overview.md
```

## Three Pillars of Observability

### 1. Component Observability
Each editable component is a separate file. Change one without affecting others. Rollback individually.

### 2. Experience Observability
Every task failure produces a structured analysis report: what happened, root cause, which components involved.

### 3. Decision Observability
Every component change is logged with: what changed, why, expected effect, risk. Verified later.

## Getting Started

### Prerequisites
- An AI coding agent (Claude Code, Codex, OpenClaw, etc.)
- Git for version control
- Basic scripting capability in the agent's environment

### Quick Setup

1. **Copy the AHE structure** into your agent's workspace:
   ```bash
   git clone https://github.com/your-org/ahe.git
   # or copy manually
   ```

2. **Tell your agent** to read `SKILL.md`:
   ```
   Go read ahe/SKILL.md and start the AHE evolution loop.
   ```

3. **First evolution** happens naturally when the agent encounters its first task failure. The agent will:
   - Write a structured report to `evidence/reports/`
   - Identify affected components
   - Propose and apply a change
   - Commit to git

4. **Periodic reviews**: Set up a weekly cron task for the agent to review accumulated evidence and validate pending predictions.

### Customization

- **Modify component files** to match your environment (your proxies, paths, tools)
- **Adjust SKILL.md** trigger conditions for your agent's task patterns
- **Extend report templates** in SKILL.md for domain-specific analysis

## Example: First Evolution

**Scenario**: Agent is asked to search for files and uses `find / -name` on a machine with 500GB data. Times out. User gets frustrated.

**AHE activates**:
1. Writes report → `evidence/reports/2026-05-06-23-25.md`
2. Identifies component: `tool-policies.md` (no mention of `es.exe` / Everything search)
3. Logs change: "Added `es.exe` priority rule for file search tasks" → `manifest/changes.jsonl`
4. Edits `tool-policies.md` — adds file search strategy
5. Next file search task → uses `es.exe` → succeeds in milliseconds

## How to Contribute

1. **Use AHE with your own agent** and report what works
2. **Share your evidence/patterns.md** — what recurring patterns did you discover?
3. **Open issues** for component templates that could be better
4. **PRs welcome** for new workflow patterns, environment configs, or skill registry examples

## Paper Citation

```bibtex
@misc{lin2026ahe,
  title={Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses},
  author={Jiahang Lin and Shichun Liu and Chengjun Pan and et al.},
  year={2026},
  eprint={2604.25850},
  archivePrefix={arXiv},
  primaryClass={cs.AI},
  url={https://arxiv.org/abs/2604.25850}
}
```

## License

MIT
