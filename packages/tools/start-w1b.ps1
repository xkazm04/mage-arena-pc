$ErrorActionPreference = 'Stop'
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runtime = Join-Path $workspace '.director-runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$process = Start-Process -FilePath 'node' -ArgumentList 'packages/tools/w1b-supervisor.mjs' -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime 'w1b-stdout.log') -RedirectStandardError (Join-Path $runtime 'w1b-stderr.log') -PassThru
$process.Id | Set-Content (Join-Path $runtime 'w1b-pid.txt')
Write-Output "Detached W1b supervisor PID $($process.Id)"
