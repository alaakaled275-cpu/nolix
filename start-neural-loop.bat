@echo off
echo ==========================================
echo   NOLIX Phase 2 Neural Decision Loop
echo ==========================================
echo.
where python >nul 2>&1
if %errorlevel% neq 0 (echo [ERROR] Python not found & pause & exit /b 1)
echo [1/3] Installing dependencies...
pip install -r requirements.txt -q
echo       Done.
echo [2/3] Starting AI Brain v3 on port 8000...
start "NOLIX AI Brain v3" cmd /c "python -m uvicorn ai_brain:app --host 127.0.0.1 --port 8000 --log-level warning"
timeout /t 4 /nobreak >nul
echo [3/3] Starting Next.js...
echo.
echo ==========================================
echo   App:       http://localhost:3000
echo   AI Brain:  http://127.0.0.1:8000/docs
echo   Decide:    http://127.0.0.1:8000/decide
echo   Causal:    http://127.0.0.1:8000/causal
echo   Model:     http://127.0.0.1:8000/model
echo ==========================================
echo.
set PYTHON_AI_URL=http://127.0.0.1:8000
npm run dev
