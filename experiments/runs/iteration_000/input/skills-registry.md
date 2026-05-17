# 组件：技能目录 v2.0

> AHE 组件类型：Skills Registry
> v2.0 改进：从静态目录 → 动态技能生命周期管理（创建/发现/执行/衰减/剪枝）
> 收益预期：直接（每次技能复用减少 1/3 token 消耗 + 成功路径保证）

## 技能生命周期

```
发现任务 → LanceDB语义搜索 
    ↓ 有匹配技能
加载 SKILL.md → 按 success_count 排序 → 注入 agent 上下文
    ↓ 执行成功
success_count++ → 更新 LanceDB 索引
    ↓ 执行失败
failure_streak++ → 如果连续3次失败 → 触发 MODIFY_SKILL
    ↓ S(t) < 0.1
自动归档（session 中不再发现） → 可选人工复活
```

## 已安装技能（静态基础）

### 核心技能
- **web-search**：实时网页搜索（用浏览器）
- **playwright**：浏览器自动化
- **skill-creator**：创建/编辑技能

### 文档技能
- **docx**：Word文档处理
- **xlsx**：Excel表格处理
- **pptx**：PPT演示文稿
- **pdf**：PDF处理

### 媒体技能
- **x-video-downloader**：X/Twitter视频下载
- **remotion**：React视频生成

### 系统技能
- **healthcheck**：安全审计
- **node-connect**：设备连接诊断
- **taskflow**：持久任务流
- **skill-vetter**：技能安全审查

### 搜索技能
- **technology-search**：科技新闻搜索

## v2.0 新增：动态技能（由 Skill Crystallizer 生成）

### 技能存储位置
- **磁盘**：`plugins/memory-bus/skills/{uuid}.md`（每个技能一个文件）
- **LanceDB 索引**：`skills_index` 表（text + vector + metadata）

### 技能元数据
```
{
  skill_id: UUID v4,
  name: string,
  description: string,
  file_path: string,           // 磁盘路径
  success_count: number,
  failure_streak: number,
  last_used: ISO-8601,
  decay_score: 0-1,
  created_at: ISO-8601,
  provenance: {
    source_trajectory_id: UUID,
    crystallized_by: "skill-crystallizer"
  },
  tags: string[],
  vector: float[]               // 自动生成 embedding
}
```

### 技能发现（Grok R17详解版）
1. 任务开始时，agent 调用 `memory_query(intent, { layer: "skills", top_k: 3 })`
2. LanceDB 做语义搜索（向量相似度 0-1）
3. 返回 TOP-3 候选技能，按 `success_count × decay_score` 加权排序
4. Agent 从磁盘加载对应的 SKILL.md 全文
5. Agent 在上下文中注入："可用技能：{name} - {description}，步骤：{steps}"

## 触发规则

### 技能选择原则
1. 精确匹配：只加载 1 个最相关的 SKILL.md
2. 多个匹配：按 success_count × decay_score 排序，取 top-1
3. 所有匹配 decay_score < 0.3：不加载任何技能（从头开始）
4. 不要一次读多个技能文件（除非任务明确需要组合）

### 触发关键词（v2.0扩展）
- "搜索"/"search" → web-search 或 technology-search
- "下载视频"/"download video" → x-video-downloader
- "做PPT"/"make slides" → pptx
- "读Excel"/"analyze spreadsheet" → xlsx
- "写文档"/"create document" → docx
- "安全检查"/"security audit" → healthcheck
- "创建技能"/"create skill" → skill-creator
- "分析头条"/"analyze toutiao" → 动态技能（如果存在）
- "生成脚本"/"write script" → 动态技能（如果存在）

## 技能结晶触发条件

### 自动触发
1. 任务成功结束（用户确认满意 / 无任何纠正）
2. 轨迹步骤数 > 3（太短的不值得结晶）
3. 7天内没有类似技能被结晶过（去重）

### 手动触发
- 用户说"记住这个做法"/"这个流程保存下来"

## 技能安装位置

- LobsterAI 技能：`~/AppData/Roaming/LobsterAI/SKILLs/`
- 内置技能：`~/AppData/Local/Programs/LobsterAI/resources/cfmind/skills/`
- AHE 结晶技能：`plugins/memory-bus/skills/`

## 关键指标：Skill Reuse Rate

**定义**（Grok R6）：成功复用已有技能的次数 / 应有技能的任务总数

**目标**：
- Week 1：> 0（至少有一次复用）
- Month 1：> 0.3
- Month 3：> 0.5

**追踪方式**：每次任务结束后在 LanceDB 中记录 `{ task_id, skills_used: [skill_ids], success: boolean }`

## 进化记录

### 2026-05-17 v2.0 升级
- 加入技能生命周期管理（创建/发现/执行/衰减/剪枝）
- 加入动态技能存储（磁盘 + LanceDB 双轨）
- 加入技能发现机制（语义搜索 → top-3 加权排序 → 加载）
- 加入 Skill Reuse Rate 核心指标
- 加入结晶触发条件（自动 + 手动）
- 加入连续失败自动降权（failure_streak >= 3 → 降低 decay_score）
- 加入高成功技能保护（success_count >= 5 → 需人工确认才能修改）

## v2.1 新增结晶技能

### grok-architecture-collaboration
- **文件**：`plugins/memory-bus/skills/grok-architecture-collaboration.md`
- **描述**：与 Grok 进行多轮架构协作的方法论——诚实批判、算法提取、渐进追问、要求具体产出
- **适用场景**：复杂系统架构设计、技术选型、方案审查
- **核心原则**：7 条（诚实批判第一 / 算法提取 > 应用胶合 / 渐进式追问 / 要求具体输出 / 最终决策权在己）
- **对话模板**：第 1 轮批判 → 第 2 轮转向 → 第 3 轮具体化 → 第 4 轮选优 → 第 5 轮代码级 → 第 6 轮排序 → 第 7-10 轮深化
- **踩坑记录**：5 个（不要他写完整代码 / 不要一次问太多 / 不要跳过批判阶段）
- **来源**：2026-05-17 与 Grok 25 轮对话经验（AHE v2.0-v2.1 架构设计全过程）
- **进化记录**：首次结晶（2026-05-17），success_count=0，待首次复用时验证

### 2026-05-17 v3.0 实验管理技能（新增）

**技能名称**：experiment-manager
**文件**：plugins/memory-bus/experiment-manager.ts
**描述**：状态机驱动的 AHE 自进化实验管理，支持 benchmark 评测、9 状态矩阵、自动回滚
**触发条件**：OpenClaw "AHE，跑实验" 或 CLI "ahe evolve"

**技能名称**：trace-analyzer
**文件**：plugins/memory-bus/trace-analyzer.ts
**描述**：轻量轨迹分析器，支持 LLM/规则/混合模式
**触发条件**：任务失败后自动调用

**技能名称**：contamination-firewall-2
**文件**：plugins/memory-bus/contamination-firewall.ts
**描述**：污染防火墙中间件，支持多模型交叉验证、传播追踪、验证衰减
**触发条件**：所有 MemoryBus 读写自动经过

### 2026-05-17 v2.1 技能结晶
