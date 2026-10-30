#!/usr/bin/env python3
# ekspor_gudang.py — baca gudang.db (SQLite aplikasi desktop) lalu tulis
# data/gudang.json: satu berkas JSON TERENKRIPSI yang dibaca situs web.
#
# Cara pakai (dari folder situs):
#     python tools\ekspor_gudang.py
#     python tools\ekspor_gudang.py --db "C:\path\ke\gudang.db"
#
# Tanpa --db, script mencari gudang.db di tempat-tempat yang lazim
# (folder situs, folder induknya, dist\, dsb). Password diminta dua kali;
# password inilah kunci data — pakai password yang sama setiap ekspor,
# dan password itu pula yang dimasukkan di situs.

import argparse
import getpass
import json
import os
import sqlite3
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kunci_py import kunci_amplop, buka_amplop  # noqa: E402

TABEL = {
    'master_material': ('id', 'nama', 'satuan_default', 'kategori'),
    'master_divisi': ('id', 'nama'),
    'master_kategori': ('id', 'nama'),
    'master_satuan': ('id', 'nama'),
    'master_blok': ('id', 'nama', 'divisi', 'luas_ha'),
    'material_masuk': ('id', 'tanggal', 'material', 'satuan', 'qty', 'divisi', 'sumber', 'sppb_item_id', 'keterangan'),
    'material_keluar': ('id', 'tanggal', 'material', 'satuan', 'qty', 'blok', 'divisi', 'diambil_oleh', 'keterangan'),
    'sppb': ('id', 'no_sppb', 'tanggal', 'divisi_pemohon', 'keterangan'),
    'sppb_items': ('id', 'sppb_id', 'material', 'satuan', 'qty_diminta'),
}

SETTING_DIBAWA = (
    'company_nama', 'company_alamat', 'company_kontak', 'company_logo_base64',
    'default_nama_diperiksa', 'default_nama_disetujui',
)


def cari_db(akar):
    kandidat = [
        os.path.join(akar, 'gudang.db'),
        os.path.join(akar, '..', 'gudang.db'),
        os.path.join(akar, '..', 'dist', 'gudang.db'),
        os.path.join(akar, '..', '..', 'gudang.db'),
        os.path.join(akar, '..', '..', 'dist', 'gudang.db'),
    ]
    for p in kandidat:
        p = os.path.abspath(p)
        if os.path.isfile(p):
            return p
    return None


def baca_db(path_db):
    con = sqlite3.connect(f'file:{path_db}?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    tabel = {}
    for nama, kolom in TABEL.items():
        try:
            rows = con.execute(f'SELECT * FROM {nama}').fetchall()
        except sqlite3.OperationalError:
            tabel[nama] = []     # tabel belum ada di versi db lama
            continue
        tabel[nama] = [{k: r[k] for k in kolom if k in r.keys()} for r in rows]
    settings = {}
    try:
        for r in con.execute('SELECT key, value FROM app_settings'):
            if r['key'] in SETTING_DIBAWA and r['value']:
                settings[r['key']] = r['value']
    except sqlite3.OperationalError:
        pass
    con.close()
    return tabel, settings


def main():
    ap = argparse.ArgumentParser(description='Ekspor gudang.db ke data/gudang.json terenkripsi.')
    ap.add_argument('--db', help='Lokasi gudang.db (opsional, dicari otomatis kalau kosong).')
    ap.add_argument('--keluar', help='Lokasi berkas hasil (bawaan: data/gudang.json di folder situs).')
    ap.add_argument('--password', help='Password data (kalau kosong, diminta di layar — lebih aman).')
    arg = ap.parse_args()

    akar_tools = os.path.dirname(os.path.abspath(__file__))
    akar_situs = os.path.dirname(akar_tools)

    path_db = os.path.abspath(arg.db) if arg.db else cari_db(akar_tools)
    if not path_db or not os.path.isfile(path_db):
        print('[!] gudang.db tidak ditemukan. Jalankan dengan --db "C:\\path\\ke\\gudang.db"')
        sys.exit(1)

    path_keluar = os.path.abspath(arg.keluar) if arg.keluar else os.path.join(akar_situs, 'data', 'gudang.json')

    print(f'  Database : {path_db}')
    print(f'  Hasil    : {path_keluar}')

    if arg.password:
        pw = arg.password
    else:
        pw = getpass.getpass('  Password data : ')
        if not pw:
            print('[!] Password tidak boleh kosong.')
            sys.exit(1)
        pw2 = getpass.getpass('  Ulangi        : ')
        if pw != pw2:
            print('[!] Password tidak sama.')
            sys.exit(1)

    tabel, settings = baca_db(path_db)

    # rev melanjutkan berkas lama (kalau ada & bisa dibuka dengan password ini)
    rev = 0
    web = {}
    if os.path.isfile(path_keluar):
        try:
            with open(path_keluar, encoding='utf-8') as f:
                lama = json.load(f)
            rev = int((lama.get('meta') or {}).get('rev') or 0)
            try:
                isi_lama = buka_amplop(lama, pw)
                web = isi_lama.get('web') or {}
                # pengaturan yang hanya ada di situs (kop surat, logo, nama
                # bawaan) jangan hilang tertimpa ekspor: nilai dari gudang.db
                # menang, sisanya dibawa dari berkas lama.
                for k, v in (isi_lama.get('settings') or {}).items():
                    settings.setdefault(k, v)
                rev = max(rev, int(isi_lama.get('rev') or 0))
                print(f'  Berkas lama terbaca (rev {rev}) — pengaturan web & kop surat ikut dibawa.')
            except ValueError:
                print('  [!] Berkas lama ada tapi password-nya beda — rev diteruskan dari meta.')
        except Exception:
            pass
    rev += 1

    # SPPB yang SUDAH ADA saat batas ini pertama ditetapkan dianggap "lama":
    # tidak perlu di-acc kepala kebun/KTU. Alur persetujuan di situs hanya
    # berlaku untuk pengajuan baru (id di atas batas ini).
    if web.get('accBatasId') is None:
        web['accBatasId'] = max((int(r['id'] or 0) for r in tabel['sppb']), default=0)
        print(f"  Batas SPPB lama ditetapkan: id <= {web['accBatasId']} tidak perlu di-acc.")

    tanggal = sorted(
        [r['tanggal'] for r in tabel['material_masuk'] if r.get('tanggal')]
        + [r['tanggal'] for r in tabel['material_keluar'] if r.get('tanggal')]
    )
    meta = {
        'aplikasi': 'Gudang',
        'label': 'Gudang Material',
        'rev': rev,
        'diperbarui': datetime.now().isoformat(timespec='seconds'),
        'dari': 'Desktop — ekspor gudang.db',
        'jumlah': {
            'material': len(tabel['master_material']),
            'masuk': len(tabel['material_masuk']),
            'keluar': len(tabel['material_keluar']),
            'sppb': len(tabel['sppb']),
        },
        'periode': {'dari': tanggal[0] if tanggal else '', 'sampai': tanggal[-1] if tanggal else ''},
    }
    data = {
        'aplikasi': 'Gudang',
        'rev': rev,
        'dibuat': meta['diperbarui'],
        'dari': meta['dari'],
        'tabel': tabel,
        'settings': settings,
        'web': web,
    }

    amplop = kunci_amplop(data, pw, meta)
    os.makedirs(os.path.dirname(path_keluar), exist_ok=True)
    with open(path_keluar, 'w', encoding='utf-8') as f:
        json.dump(amplop, f, ensure_ascii=False)

    j = meta['jumlah']
    print(f"  Selesai. {j['material']} material, {j['masuk']} masuk, {j['keluar']} keluar, "
          f"{j['sppb']} SPPB -> rev {rev}.")
    print('  Berkas sudah terenkripsi: tanpa password, isinya tidak bisa dibaca siapa pun.')


if __name__ == '__main__':
    main()
