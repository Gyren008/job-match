# job-match

使用 Agent 自带的模型，对一份简历和同一岗位的多张招聘截图做匹配分析。先确认必要信息，再输出带依据的整数评分、简历优化建议、需问 HR 的事项、公司核查和三版 Boss 直聘招呼语，并默认附带面试准备：

- 三版自我介绍：HR 版约 1 分钟、业务面试版约 2 分钟、负责人面试版约 1–2 分钟；按对象调整重点，提供可直接练习的口语稿。
- 约 15–20 道重点面试题详解：包含优先级、提问依据、考察意图、真实素材、回答思路和可能追问。
- 按 HR、业务面试官、负责人分类的扩展问题清单，以及候选人反问。分类不代表真实面试轮次，预测不保证穷尽全部问题。

三版自我介绍与题库共用简历、岗位资料及已有回答。缺少离职原因、成果口径等事实时会提示补充，不虚构经历或答案。完整报告末尾会主动提示“是否将以上完整报告导出为 Word 文档？”，同意后确认保存目录，导出包含所有报告模块。

## 从链接安装（Codex / Windows）

需要 Git、Node.js 和 npm。在准备使用 Codex 的项目目录打开 PowerShell，运行：

```powershell
npx --yes skills add https://github.com/Gyren008/job-match --skill job-match --agent codex --copy -y
npm ci --prefix .agents/skills/job-match
```

第一条命令复制 Skill 到当前项目，第二条命令安装读取 Word/PPT 和导出 Word 所需的库；Skills CLI 不会自动执行 `npm ci`。

不使用 Skills CLI 时，也可以把本仓库直接克隆到用户目录下的 `.codex/skills/job-match`：

```powershell
git clone https://github.com/Gyren008/job-match.git "$HOME\.codex\skills\job-match"
npm ci --prefix "$HOME\.codex\skills\job-match"
```

在 Codex 会话中用 `$job-match` 调用，提供一份 `.docx`/`.pptx`（或旧版 `.doc`/`.ppt`）简历，以及同一职位按顺序排列的 PNG/JPG 截图。例如：“用 $job-match 分析这份简历与岗位。”默认会在匹配分析后生成三版自我介绍和完整面试题库，无需再次要求准备面试。

先回答必要问题再生成评分；用户可跳过无法回答的问题，证据不足时不编造分数，面试材料中缺失的事实会标为待补充。旧版 Office 文件需要本机安装 LibreOffice 用于转换；无法读取时可另存为新版格式。简历是图片时请提供清晰截图或文字。

使用本机已有的 Agent 模型，不配置额外模型 API。公司公开信息核查取决于 Agent 是否具有联网能力；无法核实时报告会注明。导出邀请不会自动保存文件；用户同意导出后才确认目录并生成 `.docx`，此前已明确的目录直接使用。文档保留完整面试准备内容与待补充提示，不包含导出邀请。不会自动改写简历或覆盖已有报告。

## 校验

```powershell
npm ci
npm test
```

测试使用合成内容。不要把真实简历、招聘截图、API 密钥或个人报告提交到公开仓库。
