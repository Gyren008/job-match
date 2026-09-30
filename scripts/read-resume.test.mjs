import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import { exportReport } from './export-docx.mjs';
import { extractPptx, readResume } from './read-resume.mjs';

test('extracts resume text from a generated DOCX', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'job-match-reader-'));
  try {
    const file = await exportReport({ content: '# 测试简历\n\n负责用户运营', company: '样例公司', score: 80, directory });
    assert.match(await readResume(file), /负责用户运营/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reads text across PPTX slides in slide order', async () => {
  const zip = new JSZip();
  zip.file('ppt/slides/slide2.xml', '<p:sld><a:p><a:r><a:t>技能成果</a:t></a:r></a:p></p:sld>');
  zip.file('ppt/slides/slide1.xml', '<p:sld><a:p><a:r><a:t>工作内容</a:t></a:r></a:p></p:sld>');
  const text = await extractPptx(await zip.generateAsync({ type: 'nodebuffer' }));
  assert.ok(text.indexOf('工作内容') < text.indexOf('技能成果'));
  assert.match(text, /第 2 页/);
});

test('rejects unsupported formats before opening the file', async () => {
  await assert.rejects(readResume('example.pdf'), /只支持/);
});

test('explains how to handle legacy Word when LibreOffice is unavailable', async () => {
  await assert.rejects(readResume('example.doc'), /LibreOffice.*另存为/);
});