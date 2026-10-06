import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mammoth from 'mammoth';
import { exportReport, reportFilename } from './export-docx.mjs';

test('uses a safe company name, score, and local date', () => {
  assert.equal(reportFilename('甲/乙:公司', 86, new Date(2026, 8, 30)), '甲乙公司匹配度检测报告-86分-2026-09-30.docx');
  assert.throws(() => reportFilename(' ', 86), /公司名称/);
  assert.throws(() => reportFilename('甲公司', 101), /分数/);
});

test('exports Markdown including headings, bullet lists and tables without overwriting', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'job-match-export-'));
  try {
    const params = {
      company: '样例公司', score: 83, directory, now: new Date(2026, 8, 30),
      content: '# 匹配度报告\n\n## 亮点\n\n- 负责用户运营\n\n| 项目 | 分数 |\n| --- | --- |\n| 职责 | 36 |\n',
    };
    const target = await exportReport(params);
    assert.equal(path.basename(target), '样例公司匹配度检测报告-83分-2026-09-30.docx');
    const bytes = await readFile(target);
    assert.equal(bytes.subarray(0, 2).toString(), 'PK');
    await assert.rejects(exportReport(params), { code: 'EEXIST' });
    assert.deepEqual(await readFile(target), bytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI exports Chinese Markdown from stdin without corrupting text', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'job-match-stdin-'));
  try {
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('./export-docx.mjs', import.meta.url)),
      '--company', '测试公司', '--score', '88', '--directory', directory,
    ], { input: '# 岗位匹配度报告\n\n适合用户运营岗位', encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const extracted = await mammoth.extractRawText({ path: result.stdout.trim() });
    assert.match(extracted.value, /适合用户运营岗位/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('exports a complete report with three introductions and the full interview preparation', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'job-match-interview-'));
  try {
    const sections = [
      ['岗位匹配分析', '职责得分有简历项目依据，最终匹配度 83 分。'],
      ['简历优化建议', '明确个人职责与团队成果的边界。'],
      ['其他注意事项', '加班安排未说明，需核对。'],
      ['需问 HR', '请确认薪酬结构与试用期。'],
      ['公司核查', '未完成核查，不能据此判断公司风险。'],
      ['Boss 招呼语', '您好，我有活动运营经验，希望了解岗位是否仍在招聘。'],
      ['HR 版自我介绍 约 1 分钟', '我从事活动运营，负责过会员转化项目。待补充：应聘动机。'],
      ['业务面试版自我介绍 约 2 分钟', '我负责方案设计和执行复盘，团队完成了项目目标。'],
      ['负责人面试版自我介绍 约 1–2 分钟', '我会先核对业务目标和资源，再安排优先级。'],
    ];
    const questions = [
      ['HR', ['为什么考虑这个岗位？', '如何解释这次职业变化？', '期望薪资是多少？', '何时可以到岗？', '如何选择下一份工作？', '如何看待岗位的资历要求？']],
      ['业务面试官', ['会员转化项目的目标是什么？', '你个人负责哪些工作？', '转化率的分母是什么？', '为什么选择这一活动方案？', '效果不及预期时如何复盘？', '模拟情境：资源减半如何调整活动？']],
      ['负责人', ['如何理解这个岗位的业务价值？', '多个任务冲突时如何排序？', '跨部门分歧如何处理？', '如何分配有限资源？', '入职后先了解哪些信息？', '如何判断自己的工作有效？']],
    ];
    const parts = ['# 完整岗位匹配报告', ...sections.map(([title, body]) => `## ${title}\n\n${body}`)];
    const expected = sections.flat();
    let number = 0;
    for (const [type, titles] of questions) {
      parts.push(`## ${type}重点题`);
      for (const title of titles) {
        number++;
        const question = [
          `### ${number}. ${title}`,
          '**优先级**：必须准备。',
          '**提问依据**：合成岗位资料与会员转化项目；通用招聘主题按性质标明。',
          '**考察意图**：核验事实与判断过程。',
          '**真实素材**：本人负责方案设计；未确认的事实待补充。',
          '**回答思路**：说明事实、个人行动和结果，区分团队贡献。',
          `**可能追问**：第 ${number} 题的比较基准与职责边界是什么？`,
        ].join('\n\n');
        parts.push(question);
        expected.push(title, `第 ${number} 题的比较基准与职责边界是什么？`);
      }
    }
    parts.push('## 扩展问题清单\n\n- HR：还有哪些工作条件需要确认？\n- 业务：方法适用于什么条件？\n- 负责人：怎样识别执行风险？');
    parts.push('## 候选人反问\n\n这份岗位前三个月的成功标准是什么？');
    expected.push('扩展问题清单', '方法适用于什么条件？', '候选人反问', '这份岗位前三个月的成功标准是什么？');
    const target = await exportReport({
      content: parts.join('\n\n'), company: '合成公司', score: 83, directory,
    });
    const { value: extracted } = await mammoth.extractRawText({ path: target });
    for (const snippet of expected) assert.ok(extracted.includes(snippet), `DOCX is missing: ${snippet}`);
    assert.equal(number, 18);
    assert.ok(extracted.indexOf('HR 版自我介绍') < extracted.indexOf('业务面试版自我介绍'));
    assert.ok(extracted.indexOf('业务面试版自我介绍') < extracted.indexOf('负责人面试版自我介绍'));
    assert.ok(extracted.indexOf('负责人面试版自我介绍') < extracted.indexOf('HR重点题'));
    assert.ok(extracted.indexOf('HR重点题') < extracted.indexOf('业务面试官重点题'));
    assert.ok(extracted.indexOf('业务面试官重点题') < extracted.indexOf('负责人重点题'));
    assert.ok(extracted.indexOf('负责人重点题') < extracted.indexOf('候选人反问'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
