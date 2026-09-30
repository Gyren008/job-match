# job-match

使用 Agent 自带的模型，对一份简历和同一岗位的多张招聘截图做匹配分析。先向求职者提问，再输出带依据的整数评分、简历优化建议、需问 HR 的事项，以及三版 Boss 直聘招呼语。用户提出导出请求时，可将报告保存为 Word 文档。

## 从链接安装（Codex / Windows）

需要 Git、Node.js 和 npm。在准备使用 Codex 的项目目录打开 PowerShell，运行：

```powershell
npx --yes skills add https://github.com/Gyren008466/job-match --skill job-match --agent codex --copy -y
npm ci --prefix .agents/skills/job-match
```

第一条命令复制 Skill 到当前项目，第二条命令安装读取 Word/PPT 和导出 Word 所需的库；Skills CLI 不会自动执行 `npm ci`。

不使用 Skills CLI 时，也可以把本仓库直接克隆到用户目录下的 `.codex/skills/job-match`：

```powershell
git clone https://github.com/Gyren008466/job-match.git "$HOME\.codex\skills\job-match"
npm ci --prefix "$HOME\.codex\skills\job-match"
```

在 Codex 会话中用 `$job-match` 调用，提供一份 `.docx`/`.pptx`（或旧版 `.doc`/`.ppt`）简历，以及同一职位按顺序排列的 PNG/JPG 截图。回答它的第一轮问题后才会生成评分。旧版 Office 文件需要本机安装 LibreOffice 用于转换；无法读取时可另存为新版格式。简历是图片时请提供清晰截图或文字。

使用本机已有的 Agent 模型，不配置额外模型 API。公司公开信息核查取决于 Agent 是否具有联网能力；无法核实时报告会注明。导出 `.docx` 前会询问保存目录，不会自动改写简历。

## 校验

```powershell
npm ci
npm test
```

测试使用合成内容。不要把真实简历、招聘截图、API 密钥或个人报告提交到公开仓库。