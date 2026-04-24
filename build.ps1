# build.ps1 - scan posts/*.md frontmatter, generate posts.json
# Usage: powershell -File build.ps1

$postsDir = Join-Path $PSScriptRoot "posts"
$output = Join-Path $PSScriptRoot "posts.json"
$entries = @()

Get-ChildItem "$postsDir\*.md" | ForEach-Object {
  $content = Get-Content $_.FullName -Raw -Encoding utf8
  if ($content -match '^---\s*\n(.+?)\n---') {
    $fm = $matches[1]
    $id = $_.BaseName

    $title   = if ($fm -match 'title:\s*(.+)')   { $matches[1].Trim() } else { $_.BaseName }
    $date    = if ($fm -match 'date:\s*(.+)')    { $matches[1].Trim() } else { "" }
    $tag     = if ($fm -match 'tag:\s*(.+)')     { $matches[1].Trim() } else { "" }
    $summary = if ($fm -match 'summary:\s*(.+)') { $matches[1].Trim() } else { "" }

    $entries += @{
      id      = $id
      title   = $title
      date    = $date
      tag     = $tag
      summary = $summary
    }
  }
}

$entries = $entries | Sort-Object date -Descending
$entries | ConvertTo-Json -Compress | Out-File $output -Encoding utf8
Write-Host ("Done. " + $entries.Count + " posts -> posts.json")
