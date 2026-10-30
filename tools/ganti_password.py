#!/usr/bin/env python3
# ganti_password.py — ganti password berkas data/gudang.json TANPA kehilangan
# apa pun (acc SPPB, ttd, ceklis order, kop surat — semua ikut).
#
#     python tools\ganti_password.py
#
# Diminta password lama, lalu password baru dua kali. Jalankan ini SEBELUM
# upload ke GitHub kalau berkasnya masih memakai password contoh.

import getpass
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kunci_py import buka_amplop, kunci_amplop  # noqa: E402

path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'gudang.json')
if len(sys.argv) > 1:
    path = os.path.abspath(sys.argv[1])
if not os.path.isfile(path):
    print(f'[!] {path} tidak ditemukan.')
    sys.exit(1)

print(f'  Berkas : {path}')
lama = getpass.getpass('  Password lama : ')
with open(path, encoding='utf-8') as f:
    amplop = json.load(f)
try:
    data = buka_amplop(amplop, lama)
except ValueError as e:
    print(f'[!] {e}')
    sys.exit(1)

baru = getpass.getpass('  Password BARU : ')
if not baru:
    print('[!] Password baru tidak boleh kosong.')
    sys.exit(1)
if getpass.getpass('  Ulangi        : ') != baru:
    print('[!] Password tidak sama.')
    sys.exit(1)

cadangan = path + f'.backup-{datetime.now():%Y%m%d-%H%M%S}'
os.replace(path, cadangan)
meta = dict(amplop.get('meta') or {})
with open(path, 'w', encoding='utf-8') as f:
    json.dump(kunci_amplop(data, baru, meta), f, ensure_ascii=False)
print(f'  Selesai. Password diganti; isi data utuh. Cadangan lama: {os.path.basename(cadangan)}')
print('  Cadangan itu masih memakai password lama — hapus kalau sudah yakin.')
