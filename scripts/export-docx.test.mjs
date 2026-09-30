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