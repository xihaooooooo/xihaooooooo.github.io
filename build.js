// build.js — scan posts/**/*.md frontmatter, generate posts.json
// Usage: node build.js
// 不写 frontmatter 也能自动从文件内容和属性生成

const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'posts');
const output = path.join(__dirname, 'posts.json');

/** 递归查找所有 .md 文件 */
function findMdFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMdFiles(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

/** 从正文提取第一个 # 标题 */
function extractTitle(content, fallback) {
  const m = content.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : fallback;
}

/** 从正文提取摘要（前 100 字，去 Markdown 标记） */
function extractSummary(body) {
  const text = body
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/>\s*/g, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/\n/g, ' ')
    .trim();
  return text.length > 100 ? text.substring(0, 100).trim() + '…' : text;
}

/** 获取文件修改日期 YYYY-MM-DD */
function getFileDate(file) {
  const stat = fs.statSync(file);
  return stat.mtime.toISOString().split('T')[0];
}

const files = findMdFiles(postsDir);
const entries = files.map(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const relative = path.relative(postsDir, file).replace(/\.md$/, '').replace(/\\/g, '/');
  const id = relative;
  const dir = id.includes('/') ? id.substring(0, id.lastIndexOf('/')) : '';

  // 提取 frontmatter 和正文
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\n*/);
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;

  // 自动生成默认值
  const defaultTitle = extractTitle(body, id.replace(/.*\//, ''));
  const defaultSummary = extractSummary(body);
  const defaultDate = getFileDate(file);

  let title = defaultTitle, date = defaultDate, tag = '', summary = defaultSummary;

  // frontmatter 中配置的值优先
  if (fmMatch) {
    const fm = fmMatch[1];
    const get = (key) => {
      const r = new RegExp(`^${key}:\\s*(.+)`, 'm');
      const m = fm.match(r);
      return m ? m[1].trim() : '';
    };
    title   = get('title')   || defaultTitle;
    date    = get('date')    || defaultDate;
    tag     = get('tag')     || '';
    summary = get('summary') || defaultSummary;
  }

  return { id, dir, title, date, tag, summary };
});

entries.sort((a, b) => b.date.localeCompare(a.date));
fs.writeFileSync(output, JSON.stringify(entries), 'utf-8');
console.log(`Done. ${entries.length} posts -> posts.json`);
