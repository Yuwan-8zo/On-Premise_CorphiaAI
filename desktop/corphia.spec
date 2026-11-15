# -*- mode: python ; coding: utf-8 -*-
# Build recipe for the Corphia AI desktop app (used by build.bat). Kept in version control:
# the splash size limit below cannot be set from the command line.
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = ['win32timezone']
hiddenimports += collect_submodules('webview.platforms')

a = Analysis(
    ['corphia_desktop.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)
# Startup splash, shown by the bootloader a fraction of a second after the double-click.
# The image is drawn by make_images.py; max_img_size must be at least its size (the default
# limit is 760x480, and a larger image would otherwise be rejected or scaled down).
splash = Splash(
    'splash.png',
    binaries=a.binaries,
    datas=a.datas,
    text_pos=None,
    text_size=12,
    minify_script=True,
    always_on_top=True,
    max_img_size=(1280, 720),
)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    splash,
    splash.binaries,
    [],
    name='Corphia AI',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['corphia.ico'],
    manifest='app.manifest',
)
