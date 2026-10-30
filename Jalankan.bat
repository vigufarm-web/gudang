@echo off
chcp 65001 >nul
title Data Gudang - Ujicoba di komputer
cd /d "%~dp0"

echo.
echo   Data Gudang - PT VIGU FARM INDONESIA
echo   Ujicoba di komputer sendiri (tanpa GitHub)
echo.

rem Halaman ini memuat file JavaScript sebagai modul, jadi TIDAK bisa dibuka
rem dengan klik dua kali index.html - harus lewat alamat http. Script ini
rem menyalakan server kecil bawaan Python di folder ini.

if not exist "data\gudang.json" (
  echo   [!] Belum ada data\gudang.json.
  echo.
  echo   Jalankan dulu ekspor dari database aplikasi desktop:
  echo.
  echo       python tools\ekspor_gudang.py
  echo.
  echo   Script itu mencari gudang.db sendiri dan menulis hasilnya ke data\gudang.json.
  echo.
  pause
  exit /b 1
)

set PY=
where py >nul 2>nul && set PY=py
if "%PY%"=="" where python >nul 2>nul && set PY=python
if "%PY%"=="" (
  echo   [!] Python belum terpasang.
  echo       Download di https://www.python.org/downloads/
  echo       Saat memasang, centang "Add python.exe to PATH".
  echo.
  start "" https://www.python.org/downloads/
  pause
  exit /b 1
)

echo   Membuka http://localhost:8788 di peramban...
echo   Biarkan jendela ini terbuka selama masih dipakai.
echo   Tekan Ctrl+C atau tutup jendela ini untuk berhenti.
echo.
start "" http://localhost:8788/
%PY% -m http.server 8788
pause
