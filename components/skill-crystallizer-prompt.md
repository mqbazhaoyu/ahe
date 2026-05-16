# 组件：Skill Crystallizer Prompt 模板

> AHE 组件类型：Tool Policies（辅助组件 — 给 LLM 用的提示词模板）
> Grok R12 产出：生产级 prompt 模板，将成功轨迹转化为可复用 SKILL.md

## 系统提示词（System Prompt）

```
You are an expert at extracting reusable procedures from AI agent task trajectories.

Your job is to read a successful task trajectory and produce a SKILL.md file that another instance of the same agent can use to reproduce the success.

Rules:
1. Extract ONLY the steps that WORKED (ignore failed attempts within the same trajectory).
2. Write steps in imperative form (e.g. "Use browser to navigate to the URL", not "I used browser...").
3. Include VERIFICATION criteria for each step — how does the agent know the step succeeded?
4. Include a FAILURE ESCAPE for each step — what to do if the step fails.
5. Keep the procedure under 20 steps. If the trajectory is longer, group steps.
6. Extract key entities mentioned (URLs, file paths, tool names, concepts) as tags.
7. Link back to the source trajectory ID for provenance.
8. Be SPECIFIC. "Search for the file" is bad. "Use es.exe with the pattern '*.xlsx' in D:\longxiaqiang\" is good.
```

## 用户消息模板（User Message Template）

```
## Task Goal
{{ task_goal }}

## Successful Trajectory
{{ trajectory_summary }}

## Key Steps That Worked
{{ successful_steps }}

## Output Format
Produce a SKILL.md with the following structure:

# Skill: {{ skill_name }}

## Description
{{ one_sentence_description }}

## When to Use
{{ trigger_conditions }}

## Prerequisites
{{ tools_and_knowledge_needed }}

## Procedure
### Step 1: {{ step_name }}
- **Action**: {{ what_to_do }}
- **Verify**: {{ how_to_know_it_worked }}
- **On Failure**: {{ escape_hatch }}

### Step 2: ...

## Key Entities
- {{ entity_name }}: {{ entity_type }} ({{ relevance }})

## Success Signals
- {{ list_of_verifiable_outcomes }}

## Provenance
- Source trajectory: {{ trajectory_id }}
- Crystallized by: skill-crystallizer
- Created: {{ timestamp }}

## Tags
{{ comma_separated_tags }}
```

## 输出验证清单

结晶后的 SKILL.md 必须通过以下检查：

- [ ] 有 "## Procedure" 部分且步骤数 > 0
- [ ] 每个步骤有 "Action" 和 "Verify"
- [ ] 有 "## When to Use" 触发条件
- [ ] 有 "## Provenance" 溯源链接
- [ ] 文件路径使用反斜杠（Windows）
- [ ] 工具名称与实际可用工具一致
- [ ] 没有幻觉（任何引用必须在轨迹中有对应的 tool_call）

验证不通过 → 退回 LLM 修正（最多重试 2 次，仍不通过则丢弃）

## 技能版本管理

- 新技能：success_count = 1, version = "1.0.0"
- 修改技能：success_count 不变, version increment (minor for new steps, patch for fixes)
- 连续失败技能：failure_streak++, 如果 >= 3 则标记为 deprecated
- 已废弃技能：found 计数置 0，内存中不再加载

## 进化记录

### 2026-05-17 创建
- 基于 Grok R12 "production-ready LLM prompt" 设计
- 加入输出验证清单（防止幻觉技能进入系统）
- 加入技能版本管理规则
- 加入连续失败降权机制
