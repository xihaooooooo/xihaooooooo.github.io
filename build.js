// build.js — scan posts/*.md frontmatter, generate posts.json
// Usage: node build.js

const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'posts');
const output = path.join(__dirname, 'posts.json');

const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
const entries = files.map(file => {
  const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
  const id = path.basename(file, '.md');
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

  return { id, title, date, tag, summary };
});

entries.sort((a, b) => b.date.localeCompare(a.date));
fs.writeFileSync(output, JSON.stringify(entries), 'utf-8');
console.log(`Done. ${entries.length} posts -> posts.json`);
