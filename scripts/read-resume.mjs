import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import mammoth from 'mammoth';

function libreOfficeExecutable() {
  const candidates = ['C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return 'soffice';
}

async function convertLegacy(file, extension) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'job-match-resume-'));
  const target = path.join(directory, `${path.parse(file).name}.${extension}`);
  const executable = libreOfficeExecutable();
  const result = spawnSync(executable, ['--headless', '--convert-to', extension, '--outdir', directory, file], {
    encoding: 'utf8', windowsHide: true, timeout: 120000,
  });
  if (result.error || result.status !== 0 || !existsSync(target)) {
    await rm(directory, { recursive: true, force: true });
    const install = '旧版 Office 文件需要 LibreOffice：在 https://www.libreoffice.org/download/download-libreoffice/ 安装后重试，或先手动另存为 .docx/.pptx。';
    throw new Error(result.error?.code === 'ENOENT' ? install : `转换未成功。${install}`);
  }
  return { directory, target };
}

function extractSlideText(slide) {
  const paragraphs = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'a:p') {
        for (const paragraph of Array.isArray(value) ? value : [value]) {
          const parts = [];
          function gather(item) {
            if (Array.isArray(item)) return item.forEach(gather);
            if (!item || typeof item !== 'object') return;
            for (const [tag, text] of Object.entries(item)) {
              if (tag === 'a:t') parts.push(typeof text === 'string' ? text : String(text?.['#text'] ?? ''));
              else gather(text);
            }
          }
          gather(paragraph);
          if (parts.length) paragraphs.push(parts.join(''));
        }
      } else visit(value);
    }
  }
  visit(slide);
  return paragraphs.join('\n');
}

export async function extractPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));
  if (!slides.length) throw new Error('PPTX 中未找到可读取的幻灯片');
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });
  const pages = [];
  for (const [index, slide] of slides.entries()) {
    const xml = await zip.file(slide).async('string');
    pages.push(`第 ${index + 1} 页\n${extractSlideText(parser.parse(xml))}`);
  }
  return pages.join('\n\n');
}

export async function readResume(file) {
  const extension = path.extname(file).toLowerCase();
  if (!['.docx', '.pptx', '.doc', '.ppt'].includes(extension)) throw new Error('只支持 .doc/.docx/.ppt/.pptx 格式');
  let converted;
  try {
    if (extension === '.doc' || extension === '.ppt') {
      converted = await convertLegacy(file, `${extension.slice(1)}x`);
      file = converted.target;
    }
    const text = path.extname(file).toLowerCase() === '.docx'
      ? (await mammoth.extractRawText({ path: file })).value
      : await extractPptx(await readFile(file));
    if (!text.trim()) throw new Error('未提取到文字，可能是扫描版或嵌入图片；请提供清晰截图或文字');
    return text;
  } finally {
    if (converted) await rm(converted.directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  readResume(process.argv[2] ?? '').then(text => process.stdout.write(`${text}\n`)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}