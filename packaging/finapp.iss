; finapp.iss — receta de Inno Setup para el instalador de Windows.
;
; Convierte la carpeta que deja PyInstaller (dist\FinApp: el .exe más _internal\)
; en un único FinApp-<version>-setup.exe con asistente, acceso directo en el menú
; Inicio y desinstalador. Es el equivalente en Windows a lo que el AppImage
; resuelve en Linux: que el usuario maneje un solo fichero.
;
; Requisito previo: haber ejecutado build_windows.ps1 antes (genera dist\FinApp).
; Compilar DESDE LA RAÍZ del repositorio:
;     iscc packaging\finapp.iss /DAppVersion=1.0.0
;
; La versión se pasa por línea de órdenes a propósito: el número vive en
; backend\pyproject.toml y no queremos una sexta copia que se quede vieja.

#ifndef AppVersion
  #define AppVersion "0.0.0-dev"
#endif

[Setup]
; AppId identifica la aplicación entre versiones: mientras no cambie, un instalador
; nuevo ACTUALIZA la instalación existente en vez de crear una segunda copia.
; No tocarlo nunca.
AppId={{E4A01FDC-93F2-4A0D-86E8-86212320A9D7}
AppName=FinApp
AppVersion={#AppVersion}
AppVerName=FinApp {#AppVersion}
AppPublisher=SalvaSala
DefaultDirName={autopf}\FinApp
DefaultGroupName=FinApp
DisableProgramGroupPage=yes
; Sin permisos de administrador: {autopf} se resuelve entonces a la carpeta de
; programas del usuario, y así el instalador no lanza el aviso de UAC. La app
; guarda su base de datos en %APPDATA%, no en la carpeta de instalación.
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=FinApp-{#AppVersion}-setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\FinApp.exe

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear un acceso directo en el escritorio"; GroupDescription: "Accesos directos:"

[Files]
; recursesubdirs + createallsubdirs copian _internal\ entero, que es justo lo que
; el usuario no debe separar del ejecutable.
Source: "..\dist\FinApp\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\FinApp"; Filename: "{app}\FinApp.exe"
Name: "{group}\Desinstalar FinApp"; Filename: "{uninstallexe}"
Name: "{autodesktop}\FinApp"; Filename: "{app}\FinApp.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\FinApp.exe"; Description: "Abrir FinApp"; Flags: nowait postinstall skipifsilent
