# Site-wide semantic token migration (UI classes only)
$replacements = @(
  @('focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent', 'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent'),
  @('focus:ring-2 focus:ring-blue-500 focus:border-transparent', 'focus:ring-2 focus:ring-ring focus:border-transparent'),
  @('focus:ring-2 focus:ring-blue-500 focus:border-blue-500', 'focus:ring-2 focus:ring-ring focus:border-ring'),
  @('focus:outline-none focus:ring-2 focus:ring-blue-500', 'focus:outline-none focus:ring-2 focus:ring-ring'),
  @('focus:ring-1 focus:ring-blue-500 focus:border-blue-500', 'focus:ring-1 focus:ring-ring focus:border-ring'),
  @('focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2', 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'),
  @('focus:ring-blue-500 focus:ring-offset-2', 'focus:ring-ring focus:ring-offset-2'),
  @('focus:ring-blue-500 focus:border-transparent', 'focus:ring-ring focus:border-transparent'),
  @('focus:ring-blue-400 focus:border-blue-300', 'focus:ring-ring focus:border-ring'),
  @('text-blue-600 focus:ring-blue-500', 'text-primary focus:ring-ring'),
  @('bg-blue-600 hover:bg-blue-700', 'bg-primary hover:bg-primary/90'),
  @('bg-blue-600 text-white', 'bg-primary text-primary-foreground'),
  @('hover:bg-blue-700', 'hover:bg-primary/90'),
  @('text-blue-600 hover:text-blue-800', 'text-primary hover:text-primary/80'),
  @('text-blue-600 hover:text-blue-700', 'text-primary hover:text-primary/80'),
  @('text-blue-700 hover:text-blue-900', 'text-primary hover:text-primary/80'),
  @('bg-blue-50 border border-blue-200', 'bg-muted/50 border border-border'),
  @('bg-blue-50 border-blue-200', 'bg-muted/50 border-border'),
  @('border-blue-500 bg-blue-50', 'border-primary bg-primary/5'),
  @('hover:bg-blue-50', 'hover:bg-muted/50'),
  @('hover:bg-blue-100', 'hover:bg-muted'),
  @('hover:text-blue-600', 'hover:text-primary'),
  @('hover:text-blue-800', 'hover:text-primary/80'),
  @('ring-blue-200', 'ring-ring/30'),
  @('border-[#0B5FFF]', 'border-booking'),
  @('text-[#0B5FFF]', 'text-booking'),
  @('bg-[#0B5FFF]', 'bg-booking'),
  @('hover:bg-[#0952e0]', 'hover:bg-booking-hover'),
  @('hover:text-[#0B5FFF]', 'hover:text-booking'),
  @('hover:border-[#0B5FFF]/30', 'hover:border-booking/30'),
  @('prose-a:text-[#0B5FFF]', 'prose-a:text-booking'),
  @('from-blue-50 to-indigo-50', 'from-muted/50 to-muted/30'),
  @('from-blue-50 to-blue-100', 'from-muted/50 to-muted'),
  @('from-blue-100 to-purple-100', 'from-muted/50 to-muted'),
  @('border-blue-100', 'border-border/60'),
  @('border-blue-200', 'border-border'),
  @('border-blue-300', 'border-border'),
  @('border-blue-500', 'border-primary'),
  @('text-blue-500', 'text-primary'),
  @('text-blue-700', 'text-primary'),
  @('text-blue-800', 'text-primary'),
  @('text-blue-900', 'text-foreground'),
  @('bg-blue-100 text-blue-800', 'bg-primary/10 text-primary'),
  @('bg-blue-100 text-blue-700', 'bg-primary/10 text-primary'),
  @('min-h-screen bg-gray-50', 'min-h-screen app-page-bg'),
  @('focus:ring-blue-500', 'focus:ring-ring'),
  @('focus:border-blue-500', 'focus:border-ring'),
  @('bg-blue-500 text-white', 'bg-primary text-primary-foreground'),
  @('hover:bg-blue-600', 'hover:bg-primary/90')
)

$root = Join-Path $PSScriptRoot '..'
$files = Get-ChildItem -Path (Join-Path $root 'src') -Recurse -Include *.tsx,*.ts |
  Where-Object { $_.Name -notmatch '\.backup' -and $_.FullName -notmatch 'node_modules' }

$changed = 0
foreach ($file in $files) {
  $content = [System.IO.File]::ReadAllText($file.FullName)
  $original = $content
  foreach ($pair in $replacements) {
    $content = $content.Replace($pair[0], $pair[1])
  }
  if ($content -ne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $content)
    $changed++
  }
}

Write-Host "Updated $changed files"
