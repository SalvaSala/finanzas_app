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
