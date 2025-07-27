#!/usr/bin/env powershell

Write-Host "Testing qwen command in different modes..." -ForegroundColor Green

Write-Host "`n1. Testing direct bundle execution:" -ForegroundColor Yellow
node bundle/gemini.js --version

Write-Host "`n2. Testing via npm start:" -ForegroundColor Yellow
npm start -- --version

Write-Host "`n3. Testing CLI package directly:" -ForegroundColor Yellow
node packages/cli --version

Write-Host "`n4. Testing global qwen command:" -ForegroundColor Yellow
qwen --version

Write-Host "`n5. Testing global qwen command from different directory:" -ForegroundColor Yellow
Push-Location $env:USERPROFILE
qwen --version
Pop-Location

Write-Host "`nAll tests completed!" -ForegroundColor Green
