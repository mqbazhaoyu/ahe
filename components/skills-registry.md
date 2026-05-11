# Component: Skills Registry

> AHE Component Type: Skills Registry
> Principle: A living directory of what the agent can do and how to trigger each capability.

## Purpose

Catalog all available skills/tools/plugins, their trigger conditions, and usage notes. Helps the agent quickly identify which skill to invoke for a given task.

## Template Sections

### For Each Skill, Document:

1. **Name**: The skill ID or filename
2. **Trigger keywords**: What user phrases or task patterns should activate this skill
3. **Entry point**: How to invoke (CLI command, API call, SKILL.md path)
4. **Dependencies**: What tools/libraries are required
5. **Known limitations**: Edge cases where this skill fails
6. **Example prompts**: Sample user requests that match this skill

### Skills Table Template

| Skill | Keywords | Entry Point | Dependencies | Notes |
|-------|----------|-------------|--------------|-------|
| web-search | "search for", "find online", "latest news" | READ SKILL.md, then use browser | Browser, proxy | Use for real-time queries |
| video-download | "download video", "save from X" | READ SKILL.md, then run script | yt-dlp, ffmpeg | Requires proxy |
| ... | ... | ... | ... | ... |

### Skill Discovery

When a new skill is added:
1. Update this registry immediately
2. Test with a representative task
3. Document any setup steps or configuration

## Editing Guidelines

- **On every new skill**: Add to registry immediately
- **On skill removal**: Remove from registry, note reason
- **On skill update**: Update dependency/limitation notes
