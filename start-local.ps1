# Start both backend and frontend locally
Write-Host "Starting T-Shirt Management System locally..." -ForegroundColor Green
Write-Host ""

# Get the project root
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Backend (Flask) in background
Write-Host "Starting Backend (Flask on port 5000)..." -ForegroundColor Yellow
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\backend'; & '$projectRoot\.venv\Scripts\Activate.ps1'; python app.py" -PassThru
Start-Sleep -Seconds 2

# Start Frontend (HTTP Server on port 8000) in background
Write-Host "Starting Frontend (HTTP Server on port 8000)..." -ForegroundColor Yellow
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; python -m http.server 8000" -PassThru
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Services Started Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend PID: $($backendProcess.Id)" -ForegroundColor Gray
Write-Host "Frontend PID: $($frontendProcess.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop services, close the terminal windows or press Ctrl+C" -ForegroundColor Yellow
Write-Host ""

# Keep main script alive
Read-Host "Press Enter to stop all services..."

# Kill processes
Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue

Write-Host "Services stopped." -ForegroundColor Yellow
