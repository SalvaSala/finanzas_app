"""
Runtime hook para PyInstaller: apunta GI_TYPELIB_PATH a los typelibs
incluidos en el bundle (_MEIPASS/girepository-1.0/).
Sin esto, gi.require_version() falla al no encontrar los ficheros .typelib.
"""
import os
import sys

if hasattr(sys, "_MEIPASS"):
    bundled = os.path.join(sys._MEIPASS, "girepository-1.0")
    existing = os.environ.get("GI_TYPELIB_PATH", "")
    os.environ["GI_TYPELIB_PATH"] = (
        bundled + (":" + existing if existing else "")
    )

    # Limitar el escaneo de GStreamer al directorio de plugins real.
    # Sin esto, GStreamer escanea _MEIPASS completo e intenta cargar los
    # .so de Python (PIL, pydantic…) como plugins, generando cientos de
    # warnings y bloqueando la inicialización de WebKit2.
    gst_plugins = os.path.join(sys._MEIPASS, "gst_plugins")
    if os.path.isdir(gst_plugins):
        os.environ.setdefault("GST_PLUGIN_PATH", gst_plugins)
        os.environ.setdefault("GST_PLUGIN_SYSTEM_PATH_1_0", "")
        os.environ.setdefault("GST_REGISTRY_FORK", "no")
