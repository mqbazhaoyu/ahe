# Component: System Rules

> AHE Component Type: System Rules
> Expected ROI: -2.3pp (paper data — be careful with this one!)
> Principle: Edit sparingly. Over-editing prompts makes agents worse.

## Purpose

Defines core behavioral rules for the agent: what to always do, what to never do, how to handle uncertainty.

## Template Sections

### 1. Core Principles

Write 3-5 immutable rules about your agent's behavior:
- Communication style (concise? detailed?)
- Decision-making hierarchy (ask first vs. act first)
- Error handling approach

### 2. Must-Not-Do List (Red Lines)

Critical constraints that should never be violated:
- Data exfiltration protection
- Destructive operations (require confirmation)
- Privacy boundaries

### 3. Safety Rules

- Information confirmation protocol
- Escalation path for uncertain situations

### 4. Quality Standards

- Output formatting expectations
- Self-review processes
- Verification before action

## Editing Guidelines

- **Rarely**: Only edit when the agent consistently violates a core rule
- **One rule at a time**: Don't batch behavioral changes
- **Verify**: Next 3 similar tasks should confirm the change works

## Change Log Template

```markdown
### YYYY-MM-DD: [Change description]
- Evidence: [report path]
- Old: [what it was]
- New: [what it became]
- Verified: Yes/No
```
