# EscrowX Dev Server Startup Script
Write-Host "Starting EscrowX development environment..." -ForegroundColor Cyan

# Start Docker services
Write-Host "`n[1/3] Starting Docker containers (PostgreSQL:5433, Redis:6380)..." -ForegroundColor Yellow
docker-compose up -d 2>&1 | Select-String "Started|Running|Created"

Start-Sleep -Seconds 2

# Start API
Write-Host "`n[2/3] Starting NestJS API on http://localhost:4000 ..." -ForegroundColor Yellow
$apiLog = "C:\EscrowX\api.log"
$apiErrLog = "C:\EscrowX\api-error.log"
Set-Location C:\EscrowX\apps\api
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "dist/main.js" `
    -RedirectStandardOutput $apiLog `
    -RedirectStandardError $apiErrLog

Start-Sleep -Seconds 4
$apiLine = Get-Content $apiLog -Tail 2 2>$null
Write-Host "API: $apiLine" -ForegroundColor Green

# Start Frontend
Write-Host "`n[3/3] Starting Next.js frontend on http://localhost:3000 ..." -ForegroundColor Yellow
$webLog = "C:\EscrowX\web.log"
$webErrLog = "C:\EscrowX\web-error.log"
Set-Location C:\EscrowX\apps\web
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "node_modules\next\dist\bin\next","dev","-p","3000" `
    -RedirectStandardOutput $webLog `
    -RedirectStandardError $webErrLog

Write-Host "`nEscrowX is starting up!" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  API:       http://localhost:4000" -ForegroundColor Cyan
Write-Host "  Swagger:   http://localhost:4000/api/docs" -ForegroundColor Cyan
Write-Host "`nLogs: C:\EscrowX\api.log | C:\EscrowX\web.log" -ForegroundColor Gray
