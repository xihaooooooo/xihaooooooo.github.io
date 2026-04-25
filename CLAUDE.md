# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build

```bash
node build.js          # Scan posts/*.md -> posts.json
```

The build regenerates `posts.json` from all `.md` files in `posts/`. **Frontmatter 是可选的** — 没有 frontmatter 时自动从内容生成标题、日期、摘要。

## Architecture

Static blog ("远山") — no framework, no bundler. Two pages:

- **`index.html`** — Landing page with full-screen mountain landscape animation (SVG mountains, swans, mist). Click anywhere to enter the blog.
- **`posts.html`** — Article list + detail view. Uses `marked.js` CDN to render Markdown in the article view.
- **`posts/`** — Markdown articles with YAML frontmatter. Can be organized in subdirectories (e.g. `posts/旅行/`, `posts/随笔/`).
- **`posts.json`** — Auto-generated index consumed by `posts.html`. Built by `build.js` or `build.ps1`.
- **`build.js`** / **`build.ps1`** — Recursively scan `posts/`, parse frontmatter (title, date, tag, summary), write sorted `posts.json`.
- **`autosync.js`** — Background file watcher: detect `.md` changes → auto build → git commit → git push.

## Post format

Frontmatter 是可选的。有则用它，没有则自动生成：

```markdown
---
title: 文章标题       ← 可选，默认从正文第一个 # 标题取
date: YYYY-MM-DD      ← 可选，默认用文件修改日期
tag: 单字标签         ← 可选，默认空
summary: 摘要         ← 可选，默认取正文前 100 字
---

正文 Markdown 内容...

也可以不写 frontmatter，直接写：

# 文章标题

正文内容...
```
