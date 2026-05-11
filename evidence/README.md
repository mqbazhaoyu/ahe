# Evidence Directory

This directory stores the **experience observability** data.

## Structure

```
evidence/
├── README.md            ← You are here
├── reports/             ← Individual task analysis reports (YYYY-MM-DD-HH-MM.md)
├── overview.md          ← Aggregated view of all reports
└── patterns.md          ← Identified recurring patterns across tasks
```

## What Goes in Reports

Every time a task fails or produces a suboptimal result, the agent should:

1. Create `reports/YYYY-MM-DD-HH-MM.md` with structured analysis
2. Identify affected component(s)
3. Propose a targeted fix

## What Goes in Overview

A living summary that updates as new reports are added. The weekly review process should:

1. Read all new reports since last review
2. Update `overview.md` with latest statistics
3. Identify emerging patterns to add to `patterns.md`
