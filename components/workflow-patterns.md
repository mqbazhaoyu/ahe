# 组件：工作流模板

> AHE 组件类型：Workflow Patterns
> 收益预期：间接（通过减少重复试错）
> 原则：模板是经验的结晶，新任务可以复用

## 模式1：信息研究

```
触发：用户给多个URL或主题，要求研究
步骤：
1. 逐个获取内容（web_fetch / browser）
2. 提取关键信息
3. 交叉分析
4. 汇总报告
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

## 进化记录

<!-- AHE 进化修改在此追加 -->
