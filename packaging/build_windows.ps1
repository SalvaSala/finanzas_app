# Construye FinApp para Windows. Ejecutar desde la raíz del repositorio:
#     powershell -ExecutionPolicy Bypass -File packaging\build_windows.ps1
$ErrorActionPreference = "Stop"

Write-Host "==> 1/4  Compilando el frontend (React)"
Push-Location frontend
npm ci
npm run build
Pop-Location

Write-Host "==> 2/4  Preparando el backend"
Push-Location backend
# El grupo `packaging` trae PyInstaller. PyGObject queda fuera en Windows (lo marca
# `sys_platform == 'linux'` en pyproject.toml): aquí pywebview usa EdgeChromium.
uv sync --group packaging
Pop-Location

Write-Host "==> 3/4  Empaquetando con PyInstaller"
Push-Location backend
uv run pyinstaller ..\packaging\finapp.spec --distpath ..\dist --workpath ..\build --noconfirm
Pop-Location

Write-Host "==> 4/4  Construyendo el instalador (Inno Setup)"
# La versión se lee de pyproject.toml: es la única fuente del número.
$v = (Get-Content backend/pyproject.toml |
      Select-String -Pattern '^version = "(.*)"' |
      Select-Object -First 1).Matches.Groups[1].Value

$iscc = (Get-Command iscc -ErrorAction SilentlyContinue).Source
if (-not $iscc) {
    $iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
              "$env:ProgramFiles\Inno Setup 6\ISCC.exe") |
            Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $iscc) {
    Write-Host "AVISO: Inno Setup no está instalado, se omite el instalador."
    Write-Host "       Descárgalo de https://jrsoftware.org/isdl.php o: choco install innosetup"
    Write-Host "==> Listo. Resultado en dist\FinApp\ (sin instalador)."
    exit 0
}

& $iscc packaging\finapp.iss /DAppVersion=$v
if ($LASTEXITCODE -ne 0) { throw "ISCC falló con código $LASTEXITCODE" }

Write-Host "==> Listo."
Write-Host "    Carpeta:     dist\FinApp\"
Write-Host "    Instalador:  dist\FinApp-$v-setup.exe"
