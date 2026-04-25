// build.js — scan posts/**/*.md frontmatter, generate posts.json
// Usage: node build.js

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

const files = findMdFiles(postsDir);
const entries = files.map(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const relative = path.relative(postsDir, file).replace(/\.md$/, '').replace(/\\/g, '/');
  const id = relative;
  const dir = id.includes('/') ? id.substring(0, id.lastIndexOf('/')) : '';
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);

  let title = id, date = '', tag = '', summary = '';

  if (match) {
    const fm = match[1];
    const get = (key) => {
      const r = new RegExp(`^${key}:\\s*(.+)`, 'm');
      const m = fm.match(r);
      return m ? m[1].trim() : '';
    };
    title   = get('title')   || title;
    date    = get('date')    || date;
    tag     = get('tag')     || tag;
    summary = get('summary') || summary;
  }

  return { id, dir, title, date, tag, summary };
});

entries.sort((a, b) => b.date.localeCompare(a.date));
fs.writeFileSync(output, JSON.stringify(entries), 'utf-8');
console.log(`Done. ${entries.length} posts -> posts.json`);
