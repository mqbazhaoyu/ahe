# Component: Environment Knowledge

> AHE Component Type: Middleware / Environment
> Expected ROI: +2.2pp (paper data)
> Principle: Environment knowledge is hard structure — it transfers across models.

## Purpose

Captures everything the agent needs to know about its **operating environment**: network configuration, file system layout, OS quirks, important paths, and platform-specific gotchas.

## Template Sections

### 1. Network Configuration

- Proxy settings (if any)
- Firewall rules
- Known reachable/unreachable endpoints
- DNS quirks

### 2. File System Layout

- Workspace root
- Important directory aliases
- Standardized paths (tools, data, projects)
- Search tool configuration (indexed search paths)

### 3. OS & Platform Quirks

| OS | Quirk | Workaround |
|----|-------|------------|
| Windows | Path separator is \ | Use raw strings or double-backslash |
| Windows | 260-char path limit | Trim filenames, use short paths |
| Windows | PowerShell vs. CMD semantics | Use PowerShell, avoid cmd /c |
| Linux | Permissions on /tmp | Check sticky bit |
| macOS | SIP protection | /tmp is sandboxed in newer versions |
| ... | ... | ... |

### 4. Common Executable Paths

Maintain a lived-in table of tool locations:

| Tool | Path | Notes |
|------|------|-------|
| es.exe | ... | Windows Everything search |
| ffmpeg | ... | Video/audio processing |
| yt-dlp | ... | Video download |
| Python3 | ... | System or venv |

### 5. Timezone & Locale

- Default timezone
- Locale-specific formatting
- Date/time conventions

## Editing Guidelines

- **As discovered**: Add environment quirks as you encounter them
- **Be specific**: Include exact paths, error messages, and workarounds
- **Update on environment change**: Proxy change? Tool installed at new path? Update immediately
