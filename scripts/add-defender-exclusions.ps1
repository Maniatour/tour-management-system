#Requires -RunAsAdministrator
<#
  Windows Defender 실시간 스캔 제외 — Next.js dev 캐시·프로젝트 I/O 가속.
  관리자 PowerShell:
    cd C:\Users\Chad-Office\tour-management-system
    npm run defender:exclude

  0x800106ba: Defender가 꺼져 있거나, 다른 백신이 대신 쓰이는 PC에서는 PowerShell API가 동작하지 않음.
  이 경우 아래 MANUAL UI 안내로 직접 제외 경로를 추가하세요.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$paths = @(
  $root,
  (Join-Path $root 'node_modules\.cache\tms-next-dev')
)

function Write-ManualUiHelp {
  param([string[]] $TargetPaths)
  Write-Host ''
  Write-Host '=== 수동 제외 (Windows 보안 UI) ===' -ForegroundColor Yellow
  Write-Host '1. 시작 > "Windows 보안" 검색 > 열기'
  Write-Host '2. 바이러스 및 위협 방지 > "바이러스 및 위협 방지" 설정 관리'
  Write-Host '3. 제외 항목 > 제외 추가 또는 제거 > 제외 추가 > 폴더'
  Write-Host '4. 아래 폴더를 각각 추가:'
  foreach ($p in $TargetPaths) {
    Write-Host "   - $p"
  }
  Write-Host ''
  Write-Host '다른 백신(McAfee, Norton, Avast 등)을 쓰는 경우:'
  Write-Host '  해당 백신 설정에서 위 폴더를 "검사 제외"로 추가하세요.'
  Write-Host ''
}

function Test-DefenderAvailable {
  if (-not (Get-Command Get-MpPreference -ErrorAction SilentlyContinue)) {
    return $false, 'Defender PowerShell cmdlet(ConfigDefender)을 찾을 수 없습니다.'
  }
  $svc = Get-Service -Name WinDefend -ErrorAction SilentlyContinue
  if (-not $svc) {
    return $false, 'WinDefend 서비스가 없습니다. (Defender 미설치 또는 다른 백신 사용)'
  }
  if ($svc.Status -ne 'Running') {
    return $false, "WinDefend 서비스가 실행 중이 아닙니다. (Status: $($svc.Status))"
  }
  try {
    $null = Get-MpComputerStatus -ErrorAction Stop
    return $true, ''
  } catch {
    return $false, "Get-MpComputerStatus 실패: $($_.Exception.Message)"
  }
}

$resolvedPaths = @()
foreach ($target in $paths) {
  if (-not (Test-Path -LiteralPath $target)) {
    New-Item -ItemType Directory -Path $target -Force | Out-Null
  }
  $resolvedPaths += (Resolve-Path -LiteralPath $target).Path
}

$available, $reason = Test-DefenderAvailable
if (-not $available) {
  Write-Host "[warn] Windows Defender PowerShell API 사용 불가." -ForegroundColor Yellow
  Write-Host "       $reason"
  Write-ManualUiHelp -TargetPaths $resolvedPaths
  exit 2
}

try {
  $existing = @()
  $pref = Get-MpPreference -ErrorAction Stop
  if ($pref.ExclusionPath) {
    $existing = @($pref.ExclusionPath)
  }
} catch {
  Write-Host "[warn] Get-MpPreference 실패 (0x800106ba 등): $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host '       Defender가 비활성화되었거나, 그룹 정책/다른 백신이 관리 중일 수 있습니다.'
  Write-ManualUiHelp -TargetPaths $resolvedPaths
  exit 2
}

$added = 0
foreach ($resolved in $resolvedPaths) {
  if ($existing -contains $resolved) {
    Write-Host "[skip] already excluded: $resolved"
    continue
  }
  try {
    Add-MpPreference -ExclusionPath $resolved -ErrorAction Stop
    Write-Host "[ok]   excluded: $resolved"
    $added++
  } catch {
    Write-Host "[fail] $resolved — $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host ''
if ($added -gt 0) {
  Write-Host 'Defender exclusions applied. Restart npm run dev if it is already running.'
} else {
  Write-Host 'No new exclusions added (already present or failed).'
}
