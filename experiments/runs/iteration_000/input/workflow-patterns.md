# 组件：工作流模板 v2.0

> AHE 组件类型：Workflow Patterns
> 收益预期：间接（通过减少重复试错）
> v2.0 改进：加入 AI 漫剧制作模式 + Memory Bus 写入模式 + 夜间做梦定时任务 + 技能结晶模式
> 原则：模板是经验的结晶，新任务可以复用

## 模式1：信息研究

```
触发：用户给多个URL或主题，要求研究
步骤：
1. 逐个获取内容（web_fetch / browser）
2. 提取关键信息
3. 交叉分析
4. 汇总报告
5. memory_add(type="skill_execution", entities=[...])
```

### X/Twitter 研究子模式
```
1. 用 vxtwitter API 获取帖子正文和媒体URL
2. 需要看图片/评论 → browser + profile="user"
3. 需要看文章 → browser（web_fetch 对 X 文章页无效）
4. 批量帖子 → 并行 web_fetch（API无速率限制）
```

## 模式2：文档生成

```
触发：用户要求写文档/报告/方案
步骤：
1. 确认需求和格式
2. 收集素材
3. 用对应技能（docx/pptx/xlsx）
4. 自审（judge.py，如果 >500字）
5. 交付
6. memory_add(type="skill_execution")
```

## 模式3：定时任务

```
触发：用户要求定时提醒/定期检查
步骤：
1. 确认时间和频率
2. 用 cron(action="add") 创建
3. sessionTarget="isolated" + delivery 配置
4. 不用 wrapper payload
```

## 模式4：视频/动画生成

```
触发：用户要求生成视频或动画
步骤：
1. 确认内容和风格
2. 选择工具：
   - Remotion (React视频) → 读 remotion skill
   - Phantom Motion (HTML5/WebGL动画) → 参考 GitHub
   - video_generate (AI生成) → 直接调用
3. 生成 → 预览 → 调整 → 交付
```

## 模式5：文件搜索

```
触发：用户要求找文件
步骤：
1. es.exe 先搜（Everything必须运行）
2. 找不到 → 扩大搜索范围
3. 还找不到 → ask用户更多信息
```

## 模式6：网页交互

```
触发：需要登录态/SPA渲染的网页操作
步骤：
1. 判断是否需要登录态
2. 需要 → browser + profile="user" + target="host"
3. 不需要 → 默认沙盒浏览器
4. 操作完成 → 关闭页面
```

## 模式7：v2.0 新增 — AI 漫剧制作（Grok R15 产出）

```
触发：用户要求写剧本/生成动画/角色设计
步骤：
1. memory_query(intent="角色设定", 查询已有角色档案)
2. memory_query(intent="桥段结构", 查询已结晶的叙事模式技能)
3. 加载相关技能 SKILL.md → 注入上下文
4. 按技能步骤执行（脚本 → 故事板 → 动画 → 配音）
5. 每完成一个阶段 → memory_add(type="skill_execution", entities=[
   {name: "角色名", type: "character"},
   {name: "弧线类型", type: "narrative_pattern"}
])
6. 用户认可后 → 触发 crystallize_skill（结晶新桥段模式）
7. 飞轮效应：
   写剧本 → 捕获角色/桥段 → 下次更快 → 积累更多模式 → Skill Reuse Rate ↑
```

### 核心捕获字段（Grok R15）
- 角色口气规则（character_voice）：说话风格、常用词、情绪表达
- 战斗升级模式（combat_progression）：从试探到决战的结构
- 情感节奏（emotional_beats）：高潮/低谷/转场的频率和位置
- 弧线模板（arc_template）：每段弧线的结构骨架

## 模式8：v2.0 新增 — Memory Bus 写入

```
触发：每个任务结束后（自动）
步骤：
1. 汇总轨迹摘要（key steps, entities, outcome）
2. memory_add({
     type: "skill_execution" | "user_feedback",
     content: 轨迹摘要文本,
     entities: 从任务中提取的实体列表,
     provenance: { source_event_id: 上一个事件的ID }
   })
3. 如果成功 → 触发 crystallize_skill
4. 如果失败 → 写分析报告 → 选择 AHE 操作符
```

## 模式9：v2.0 新增 — 夜间做梦定时任务

```
触发：n8n cron（每天 02:00 CST）或 heartbeat 空闲检测 > 8h
步骤：
1. snapshot: 获取上次 dreaming 之后的所有新事件
2. light_compress: 对未压缩事件做同步压缩
3. entity_extract: LLM 提取实体/关系 → 更新 kg_nodes + kg_edges
4. cluster: 加载 KG 到内存 → Louvain 聚类 → 盲点检测 → wiki 编译
5. crystallize_batch: 批量审查成功轨迹，自动结晶新技能
6. prune: 计算所有记忆 S(t)，剪枝 S(t) < 0.1 的事件
7. index: 重建向量索引 + 缓存预计算
8. lint: 断链检测、盲点标记、生成健康报告
9. notify: 输出 dreaming 完成通知（包含：结晶技能数、剪枝事件数、KG 节点增减）
```

## 模式10：v2.0 新增 — 技能结晶

```
触发：任务成功 + 步骤 > 3 + 7天内无类似技能
步骤：
1. 从 Memory Bus 加载 trajectory_id 对应的事件
2. 提取成功步骤（只取 type="tool_call" 且无后续失败反馈的步骤）
3. 运行 LLM prompt（skill-crystallizer-prompt.md 中的模板）
4. 验证输出 SKILL.md 模板完整性（检查清单见 prompt 文件）
5. 存盘到 plugins/memory-bus/skills/{uuid}.md
6. LanceDB 索引 skills_index 表
7. 更新 skills-registry.md 的动态技能列表
8. git add + commit（message: "CREATE_SKILL: {skill_name} from {trajectory_id}"）
9. 记录到 changes.jsonl（operator: CREATE_SKILL）
```

## 进化记录

### 2026-05-17 v3.0 升级
- 加入 9 状态交叉迭代分析模式（模式11）— 从官方 AHE 移植
- 加入实验管理流程（模式12）— 状态机驱动的实验生命周期
- 加入污染防火墙拦截流程（模式13）— 中间件式读写拦截

### 2026-05-17 v2.0 升级
- 加入 AI 漫剧制作模式（模式7）— Grok R15 飞轮效应分析
- 加入 Memory Bus 写入模式（模式8）— 每个任务必做
- 加入夜间做梦定时任务（模式9）— Phase 0-7 全流程
- 加入技能结晶模式（模式10）— trajectory → SKILL.md end-to-end
- 加入核心捕获字段（角色/战斗/情感/弧线模板）— 漫剧专用

## 模式11：9 状态交叉迭代分析

每次迭代后自动计算，移植自官方 AHE。
核心指标：net_improvement = flipped - regressed

状态分类：flipped(fail→pass) | regressed(pass→fail) | stable_pass | stable_fail | infra_recovered(exception→pass) | infra_lost(pass→exception) | exception_to_fail | fail_to_exception | exception_stable

输出：ChangeMatrixReport → runs/iteration_NNN/analysis/change_matrix.json

## 模式12：实验管理生命周期

状态机：idle → evaluating → analyzing → evolving → verifying → idle
触发：OpenClaw "AHE，跑实验" 或 CLI "ahe evolve"
自动回滚：pass rate 下降 > 阈值 → 回到上一版本

## 模式13：污染防火墙拦截

写入拦截：新事件 → 4维评分 → 隔离级别 → 交叉验证 → 写入
读取拦截：查询结果 → 排除 isolated/purged → S'(t) 排序 → 返回
传播追踪：上游污染 → 注册依赖 → 下游自动降权
