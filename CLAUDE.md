# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build

```bash
node build.js          # Scan posts/*.md frontmatter -> posts.json
powershell -File build.ps1   # Windows equivalent
```

The build regenerates `posts.json` from all `.md` files in `posts/`. Run after adding/editing a post.

## Architecture

Static blog ("远山") — no framework, no bundler. Two pages:

- **`index.html`** — Landing page with full-screen mountain landscape animation (SVG mountains, swans, mist). Click anywhere to enter the blog.
- **`posts.html`** — Article list + detail view. Uses `marked.js` CDN to render Markdown in the article view.
- **`posts/*.md`** — Articles in Markdown with YAML frontmatter.
- **`posts.json`** — Auto-generated index consumed by `posts.html`. Built by `build.js` or `build.ps1`.
- **`build.js`** / **`build.ps1`** — Read all `posts/*.md`, parse frontmatter (title, date, tag, summary), write sorted `posts.json`.

## Post format

Each post requires YAML frontmatter:

```markdown
---
title: 文章标题
date: YYYY-MM-DD
tag: 单字标签 (e.g. 山, 光, 静, 飞, 夜)
summary: 列表页显示的摘要文字
---

正文 Markdown 内容...
```

Filename becomes the post ID (e.g. `dong-ri-shan-gu.md` → `dong-ri-shan-gu`). Use kebab-case.

## Adding a new post

1. Create `posts/<kebab-id>.md` with frontmatter
2. Run `node build.js` to update `posts.json`
3. Open `posts.html` in browser to verify
