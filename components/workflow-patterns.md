# Component: Workflow Patterns

> AHE Component Type: Workflow Patterns
> Principle: Reusable patterns that solve common multi-step problems.

## Purpose

A collection of **battle-tested workflow patterns** — multi-step recipes for common tasks. Instead of figuring out the sequence every time, the agent can reference proven patterns.

## Template Sections

### Pattern Format

```markdown
### Pattern: [Name]
**When**: [What situations trigger this pattern]
**Steps**:
1. Step one
2. Step two
3. Step three
**Known edge cases**: [What can go wrong]
**Fallback**: [If this pattern fails, try X]
**History**: [When was this pattern added/updated?]
```

### Example Patterns

### Pattern: Research & Synthesize

**When**: User asks to research a topic and produce a summary
**Steps**:
1. Search for latest information (web search)
2. Extract key facts from each source
3. Cross-reference for conflicts/consensus
4. Synthesize into structured summary
5. Cite sources
**Known edge cases**: Contradictory sources, paywalled content
**Fallback**: If web search fails, use browser with user's session

### Pattern: Batch File Processing

**When**: Multiple files need the same transformation
**Steps**:
1. List all files matching criteria
2. Check disk space and resource limits
3. Process in batches (N at a time)
4. Report progress per batch
5. Verify output files
**Known edge cases**: Disk full, permissions, filename encoding
**Fallback**: If batch fails, process one by one

### Pattern: Content Translation Pipeline

**When**: Content in language A needs to become language B
**Steps**:
1. Extract source text
2. Divide into segments (paragraph/sentence level)
3. Batch-translate with context window
4. Post-process: fix formatting, handle idioms
5. Quality check: round-trip verify
**Known edge cases**: HTML/markup preservation, technical terminology
**Fallback**: If batch fails, fall back to single-segment translation

### Pattern: Error Diagnosis

**When**: A tool or script returns an error
**Steps**:
1. Capture full error output (not just exit code)
2. Search notes/memory for similar error
3. Try documented workaround
4. If no workaround, try minimal reproduction
5. If persistent, report to AHE evidence for pattern analysis
**Known edge cases**: Intermittent errors, proxy/timeout errors
**Fallback**: Offer user a manual workaround

## Custom Workflows

Add your own patterns as you discover them:

- **[Your pattern name]** — When it applies
- Steps
- Edge cases
- Verified: Yes/No

## Editing Guidelines

- **Add new patterns** when you solve a complex multi-step task cleanly
- **Update patterns** when you find a better approach
- **Mark as "Deprecated"** if a tool change makes a pattern obsolete
