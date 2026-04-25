// autosync.js — 监听 posts/ 变化，自动构建并推送到 GitHub
// 在后台运行：node autosync.js
// 在 Obsidian 里写完保存后，自动完成：build → git add → commit → push

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const postsDir = path.join(__dirname, 'posts');
let timer = null;
let pending = new Set();

console.log('📡 正在监听 posts/ 目录，在 Obsidian 保存后自动同步到 GitHub...');
console.log('   按 Ctrl+C 停止\n');

fs.watch(postsDir, (event, filename) => {
  if (!filename || !filename.endsWith('.md')) return;

  pending.add(filename);
  clearTimeout(timer);

  // 文件保存后等 2 秒（等写入完成），再执行同步
  timer = setTimeout(() => {
    const files = [...pending];
    pending.clear();
    console.log(`📝 检测到变更: ${files.join(', ')}`);
    console.log('🏗️  构建 posts.json...');

    try {
      execSync('node build.js', { cwd: __dirname, stdio: 'pipe' });
      console.log('📤 提交并推送到 GitHub...');
      execSync('git add -A', { cwd: __dirname, stdio: 'pipe' });
      execSync(`git commit -m "auto sync: ${files.join(', ')}"`, {
        cwd: __dirname,
        stdio: 'pipe',
      });
      execSync('git push', { cwd: __dirname, stdio: 'pipe' });
      console.log('✅ 同步完成！稍后刷新博客即可看到更新\n');
    } catch (e) {
      // 没有变更时 git commit 会报错，忽略即可
      if (!e.message.includes('nothing to commit') && !e.message.includes('Everything up-to-date')) {
        console.log('⚠️  同步出错（可忽略）:', e.message.substring(0, 100));
      }
    }
  }, 2000);
});
