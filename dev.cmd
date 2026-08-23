@echo off
REM One-command local dev for Travelero UI.
REM Works from both cmd.exe and PowerShell:  .\dev.cmd
cd /d "%~dp0"

where pnpm.cmd >nul 2>nul
if errorlevel 1 (
  echo pnpm not found - bootstrapping via corepack...
  call corepack enable
  call corepack prepare pnpm@9.15.9 --activate
)

if not exist node_modules (
  echo Installing dependencies...
  call pnpm.cmd install
)

echo Starting Travelero UI at http://localhost:3000
call pnpm.cmd dev
