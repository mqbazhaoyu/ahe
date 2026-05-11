# Component: Tool Policies

> AHE Component Type: Tool Policies
> Expected ROI: +3.3pp (paper data)
> Principle: Tool strategies are hard structures — they transfer across models.

## Purpose

Defines **when and how** to use each tool in the agent's toolkit. This is the most frequently updated component as the agent discovers new tool capabilities and edge cases.

## Template Sections

### For Each Tool, Document:

1. **When to use** (ideal scenarios)
2. **When NOT to use** (anti-patterns, known failures)
3. **Fallback strategies** (what to try if this tool fails)
4. **Configuration notes** (paths, auth, environment-specific)

### Tool Categories

#### Web Access Tools
- web_fetch / curl: Static pages, APIs, JSON
- Browser: JavaScript-rendered pages, login-required content
- API wrappers: Platform-specific APIs

#### File Operations
- File search: Fast index vs. recursive scan
- File I/O: Read/write/append patterns
- Project navigation: Standardized entry points

#### Execution Tools
- Shell commands: Long-running vs. quick
- Script execution: Python, Node, PowerShell
- Background processes: Monitoring patterns

#### Delegation Tools
- Sub-agent spawning
- Session management
- Task pipeline orchestration

### Anti-Pattern Table

| Tool | Anti-Pattern | Correct Approach |
|------|-------------|------------------|
| web_fetch | Trying to scrape SPA-rendered pages | Use browser with JS rendering |
| shell find | Full-disk recursive search | Use indexed search (es.exe, Spotlight, mlocate) |
| ... | ... | ... |

## Editing Guidelines

- **Frequent**: Add new experiences as they're discovered
- **Append**: Add anti-patterns below existing content
- **Never remove**: Previous working approaches may be needed in other contexts

## Change Log

```
### YYYY-MM-DD: [Tool] - [New strategy discovered]
- Trigger: [What task revealed this]
- Anti-pattern: [What went wrong]
- Fix: [New approach documented]
- Verified: Yes/No
```
