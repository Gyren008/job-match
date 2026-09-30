import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt();

export function reportFilename(company, score, now = new Date()) {
  const safeCompany = company.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().replace(/[. ]+$/g, '');
  if (!safeCompany) throw new Error('请提供有效的公司名称');
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('分数必须是 0 到 100 的整数');
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `${safeCompany}匹配度检测报告-${score}分-${date}.docx`;
}

function inlineRuns(token) {
  const runs = [];
  let bold = false;
  let italics = false;
  for (const child of token?.children ?? []) {
    if (child.type === 'strong_open') bold = true;
    if (child.type === 'strong_close') bold = false;
    if (child.type === 'em_open') italics = true;
    if (child.type === 'em_close') italics = false;
    if (['text', 'code_inline', 'html_inline'].includes(child.type)) {
      runs.push(new TextRun({ text: child.content, bold, italics }));
    }
    if (['softbreak', 'hardbreak'].includes(child.type)) runs.push(new TextRun({ break: 1 }));
  }
  return runs;
}

function tableAt(tokens, start) {
  const rows = [];
  let cells = [];
  let inCell = false;
  let cellRuns = [];
  let index = start + 1;
  for (; index < tokens.length && tokens[index].type !== 'table_close'; index++) {
    const token = tokens[index];
    if (token.type === 'tr_open') cells = [];
    if (token.type === 'th_open' || token.type === 'td_open') {
      inCell = true;
      cellRuns = [];
    }
    if (token.type === 'inline' && inCell) cellRuns.push(...inlineRuns(token));
    if (token.type === 'th_close' || token.type === 'td_close') {
      cells.push(new TableCell({ children: [new Paragraph({ children: cellRuns })] }));
      inCell = false;
    }
    if (token.type === 'tr_close') rows.push(new TableRow({ children: cells }));
  }
  return { table: new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }), end: index };
}

export function reportDocument(content) {
  if (!content.trim()) throw new Error('报告内容不能为空');
  const tokens = markdown.parse(content, {});
  const children = [];
  let listDepth = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === 'table_open') {
      const result = tableAt(tokens, index);
      children.push(result.table);
      index = result.end;
    } else if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
      listDepth++;
    } else if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') {
      listDepth--;
    } else if (token.type === 'heading_open') {
      const level = Number(token.tag.slice(1));
      children.push(new Paragraph({
        children: inlineRuns(tokens[index + 1]),
        heading: [null, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][level] ?? HeadingLevel.HEADING_3,
      }));
      index += 2;
    } else if (token.type === 'paragraph_open') {
      children.push(new Paragraph({
        children: inlineRuns(tokens[index + 1]),
        ...(listDepth ? { bullet: { level: Math.min(listDepth - 1, 8) } } : {}),
        spacing: { after: 120 },
      }));
      index += 2;
    }
  }
  return new Document({ sections: [{ children }] });
}

export async function exportReport({ content, company, score, directory, now = new Date() }) {
  if (!directory || !existsSync(directory)) throw new Error('请选择已存在的保存目录');
  const filename = reportFilename(company, score, now);
  const target = path.join(directory, filename);
  const buffer = await Packer.toBuffer(reportDocument(content));
  await writeFile(target, buffer, { flag: 'wx' });
  return target;
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag) => args[args.indexOf(flag) + 1];
  if (args.length !== 6 || !['--company', '--score', '--directory'].every(flag => args.includes(flag))) {
    throw new Error('用法: node scripts/export-docx.mjs --company 公司 --score 整数 --directory 已存在目录 < report.md');
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const target = await exportReport({
    content: Buffer.concat(chunks).toString('utf8'),
    company: value('--company'),
    score: Number(value('--score')),
    directory: value('--directory'),
  });
  console.log(target);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(error => {
    console.error(error.code === 'EEXIST' ? '同名报告已存在，请选择新文件名或明确确认覆盖' : error.message);
    process.exitCode = 1;
  });
}