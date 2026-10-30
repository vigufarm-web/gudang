#!/usr/bin/env python3
# impor_gudang.py — arah sebaliknya dari ekspor: buka data/gudang.json
# (hasil input di situs web) lalu TIMPA isi gudang.db aplikasi desktop.
#
# gudang.db yang lama dicadangkan dulu di sebelahnya
# (gudang.backup-YYYYmmdd-HHMMSS.db) sebelum ditimpa, jadi selalu bisa balik.
#
# Cara pakai:
#     python tools\impor_gudang.py
#     python tools\impor_gudang.py --db "C:\path\ke\gudang.db" --masuk data\gudang.json

import argparse
import getpass
import json
import os
import shutil
import sqlite3
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kunci_py import buka_amplop  # noqa: E402
from ekspor_gudang import TABEL, SETTING_DIBAWA, cari_db  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description='Masukkan isi data/gudang.json ke gudang.db.')
    ap.add_argument('--db', help='Lokasi gudang.db (dicari otomatis kalau kosong).')
    ap.add_argument('--masuk', help='Berkas gudang.json (bawaan: data/gudang.json di folder situs).')
    ap.add_argument('--password', help='Password data (kalau kosong, diminta di layar).')
    arg = ap.parse_args()

    akar_tools = os.path.dirname(os.path.abspath(__file__))
    akar_situs = os.path.dirname(akar_tools)

    path_db = os.path.abspath(arg.db) if arg.db else cari_db(akar_tools)
    if not path_db or not os.path.isfile(path_db):
        print('[!] gudang.db tidak ditemukan. Jalankan dengan --db "C:\\path\\ke\\gudang.db"')
        sys.exit(1)
    path_masuk = os.path.abspath(arg.masuk) if arg.masuk else os.path.join(akar_situs, 'data', 'gudang.json')
    if not os.path.isfile(path_masuk):
        print(f'[!] {path_masuk} tidak ditemukan.')
        sys.exit(1)

    print(f'  Sumber   : {path_masuk}')
    print(f'  Database : {path_db}  (akan DITIMPA, dicadangkan dulu)')
    pw = arg.password or getpass.getpass('  Password data : ')

    with open(path_masuk, encoding='utf-8') as f:
        amplop = json.load(f)
    try:
        data = buka_amplop(amplop, pw)
    except ValueError as e:
        print(f'[!] {e}')
        sys.exit(1)
    if data.get('aplikasi') != 'Gudang':
        print('[!] Berkas itu bukan data gudang.')
        sys.exit(1)

    jawab = input('  Lanjut menimpa isi database? ketik YA: ').strip()
    if jawab.upper() != 'YA':
        print('  Batal. Tidak ada yang diubah.')
        sys.exit(0)

    cadangan = os.path.join(
        os.path.dirname(path_db),
        f"gudang.backup-{datetime.now():%Y%m%d-%H%M%S}.db")
    shutil.copy2(path_db, cadangan)
    print(f'  Cadangan : {cadangan}')

    con = sqlite3.connect(path_db)
    cur = con.cursor()
    cur.execute('PRAGMA foreign_keys = OFF')
    try:
        cur.execute('BEGIN')
        for nama, kolom in TABEL.items():
            baris = (data.get('tabel') or {}).get(nama) or []
            ada = cur.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (nama,)).fetchone()
            if not ada:
                print(f'  [i] Tabel {nama} tidak ada di database ini — dilewati.')
                continue
            cur.execute(f'DELETE FROM {nama}')
            if baris:
                k = [c for c in kolom if c in baris[0] or c == 'id']
                tanda = ','.join('?' * len(k))
                cur.executemany(
                    f"INSERT INTO {nama} ({','.join(k)}) VALUES ({tanda})",
                    [[r.get(c) for c in k] for r in baris])
            # reset AUTOINCREMENT supaya id baru tidak menabrak
            maks = max([int(r.get('id') or 0) for r in baris], default=0)
            try:
                cur.execute('DELETE FROM sqlite_sequence WHERE name=?', (nama,))
                if maks:
                    cur.execute('INSERT INTO sqlite_sequence (name, seq) VALUES (?,?)', (nama, maks))
            except sqlite3.OperationalError:
                pass
            print(f'  {nama}: {len(baris)} baris')
        settings = data.get('settings') or {}
        ada = cur.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='app_settings'").fetchone()
        if ada:
            for kunci in SETTING_DIBAWA:
                if kunci in settings:
                    cur.execute(
                        'INSERT INTO app_settings (key, value) VALUES (?,?) '
                        'ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                        (kunci, settings[kunci]))
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()
    print('  Selesai. Buka aplikasi desktop untuk memastikan datanya benar.')
    print(f'  Kalau ada yang keliru, kembalikan dengan menyalin {os.path.basename(cadangan)} menjadi gudang.db.')


if __name__ == '__main__':
    main()
