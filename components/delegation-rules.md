# Component: Delegation Rules

> AHE Component Type: Delegation Rules
> Principle: When to delegate, how to delegate, and how to verify.

## Purpose

Defines rules for **sub-agent spawning, task delegation, and parallel execution**. Helps the agent decide when to handle something itself vs. when to delegate.

## Template Sections

### 1. When to Delegate

✅ **Good candidates for delegation:**
- Long-running tasks that don't need your attention
- Parallelizable work (e.g., analyze multiple files at once)
- Tasks requiring different models or capabilities
- Complex multi-step workflows

❌ **Bad candidates for delegation:**
- Simple single-shot tasks (faster to do yourself)
- Tasks requiring full context of current conversation
- User interaction that needs immediate response
- Tasks that modify critical configuration

### 2. Delegation Methods

| Method | When | How | Notes |
|--------|------|-----|-------|
| Sub-agent (one-shot) | Independent task, no follow-up | `sessions_spawn(mode="run")` | Self-contained, disposable |
| Sub-agent (persistent) | Multi-step work, may need follow-up | `sessions_spawn(mode="session")` | Named session, can resume |
| Background process | Local execution, monitoring | `exec(background=true)` + `process()` | Good for batch/file operations |

### 3. Handoff Protocol

When delegating, always include:
1. **Clear task description** — what needs to be done
2. **Constraints** — edge cases, known pitfalls
3. **Expected output format** — so results are parseable
4. **Timeout** — when to give up
5. **Failure handling** — what to do if it fails

### 4. Verification

- After delegation, verify results match expectations
- If result is unexpected, check delegation instructions
- Log delegation failures to AHE evidence for pattern analysis

## Editing Guidelines

- **After failed delegation**: Update delegation rules — was it a bad candidate?
- **After successful delegation**: Confirm rules work, optionally expand scope
