# Construye FinApp para Windows. Ejecutar desde la raíz del repositorio:
#     powershell -ExecutionPolicy Bypass -File packaging\build_windows.ps1
$ErrorActionPreference = "Stop"

Write-Host "==> 1/3  Compilando el frontend (React)"
Push-Location frontend
npm ci
npm run build
Pop-Location

Write-Host "==> 2/3  Preparando el backend"
Push-Location backend
uv sync
uv pip install pyinstaller pywebview
Pop-Location

Write-Host "==> 3/3  Empaquetando con PyInstaller"
Push-Location backend
uv run pyinstaller ..\packaging\finapp.spec --distpath ..\dist --workpath ..\build --noconfirm
Pop-Location

Write-Host "==> Listo. Resultado en dist\FinApp\"
Write-Host "    (Opcional) Crear un instalador con asistente usando Inno Setup."
