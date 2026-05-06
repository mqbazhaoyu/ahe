# AHE Skill - 自我进化规则

## 概述

AHE（Agentic Harness Engineering）是我的自我进化系统。
它让我能从每次任务中学习，持续改进工作方式。

**这是给我自己用的，不是给用户用的。**

## 触发条件

### 条件1：任务失败后（立即触发）

触发信号：
- 用户说"不对"、"重来"、"我不要这个"
- 工具调用返回错误
- 用户纠正了我的理解
- 任务结果明显不理想

执行步骤：
1. 写分析报告到 `evidence/reports/YYYY-MM-DD-HH-MM.md`
2. 识别涉及的组件（从7类中选）
3. 提出修改方案 + 预测
4. 记录到 `manifest/changes.jsonl`
5. 执行修改（编辑组件文件）
6. git commit

### 条件2：心跳期间（定期触发）

触发信号：
- 心跳轮询，无紧急任务
- 距离上次进化 > 24小时

执行步骤：
1. 读取最近的 `evidence/reports/`（最近7天）
2. 汇总到 `evidence/overview.md`
3. 识别反复出现的模式
4. 如果有模式，提出针对性修改
5. 记录 + 执行

### 条件3：每周审查（cron触发）

触发信号：
- 每周一次定时任务

执行步骤：
1. 读取所有 `evidence/reports/`
2. 更新 `evidence/overview.md` 和 `evidence/patterns.md`
3. 检查 `manifest/changes.jsonl` 中未验证的修改
4. 对未验证的修改，在下次类似任务时主动验证
5. 汇总本周进化成果

## 分析报告模板

文件名：`evidence/reports/YYYY-MM-DD-HH-MM.md`

```markdown
# 任务分析报告

## 基本信息
- 时间：YYYY-MM-DD HH:MM
- 任务描述：[简述]
- 结果：SUCCESS / FAILURE / PARTIAL

## 失败分析（仅FAILURE/PARTIAL）
- 现象：[用户看到了什么问题]
- 根因：[为什么会出问题]
- 涉及组件：[system-rules / tool-policies / environment / skills-registry / delegation-rules / memory-schema / workflow-patterns]

## 经验教训
- 学到了什么：[具体]
- 应该怎么改：[具体]

## 预测
- 如果改了 [X组件]，预期：[效果]
- 风险：[可能的副作用]
```

## 变更记录格式

文件名：`manifest/changes.jsonl`（每行一个JSON）

```json
{
  "timestamp": "2026-05-06T23:30:00+08:00",
  "iteration": 1,
  "component": "tool-policies",
  "evidence": "evidence/reports/2026-05-06-23-25.md",
  "change": "添加了 web_fetch 对 X.com 的替代方案说明",
  "prediction": {
    "expected_fix": "下次抓X帖子时不再尝试直接web_fetch",
    "at_risk": "可能误判某些X页面可直接抓取"
  }
}
```

## 验证记录格式

文件名：`manifest/verdicts.jsonl`（每行一个JSON）

```json
{
  "timestamp": "2026-05-07T10:00:00+08:00",
  "change_timestamp": "2026-05-06T23:30:00+08:00",
  "task": "抓取X帖子内容",
  "result": "SUCCESS",
  "note": "直接跳过web_fetch，用browser，一次成功"
}
```

## 组件修改规则

1. **只改一个组件文件**：每次修改只涉及一个组件，不要跨组件
2. **先读后改**：修改前先读取当前内容，理解上下文
3. **追加为主**：大多数修改是追加新经验，不是重写
4. **保留历史**：git commit 记录所有变更
5. **可回滚**：如果新修改导致问题，git revert

## 进化优先级

按收益排序（论文数据）：
1. **长期记忆结构** (+5.6pp) → `memory-schema.md`
2. **工具使用策略** (+3.3pp) → `tool-policies.md`
3. **中间件/环境** (+2.2pp) → `environment.md`
4. **系统规则** (-2.3pp) → `system-rules.md`（谨慎修改！）

优先改收益高的组件。

## 与现有系统的关系

- **MEMORY.md** → 我的长期记忆，AHE 不直接改它，但会优化记忆结构
- **AGENTS.md** → 我的行为准则，AHE 会提炼其中的规则到 `system-rules.md`
- **TOOLS.md** → 工具笔记，AHE 会提炼到 `tool-policies.md`
- **judge.py** → 自审工具，AHE 会参考它的输出

AHE 不替代这些系统，而是让它们更好用。

## 里程碑

- [ ] 第1周：组件文件初始化，git 仓库建立
- [ ] 第2周：第一次完整的进化循环（失败→分析→修改→验证）
- [ ] 第1个月：积累 10+ 分析报告，识别 3+ 反复模式
- [ ] 第2个月：进化循环自动化，心跳时自动触发
- [ ] 第3个月：跨模型迁移测试（如果换了模型）
