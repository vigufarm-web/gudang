# kunci_py.py — padanan Python dari js/kunci.js: membuka & mengunci amplop
# data terenkripsi. Formatnya HARUS sama persis dengan sisi peramban:
#   PBKDF2-SHA256 (200.000 iterasi, 64 byte) -> 32 byte kunci AES + 32 byte kunci HMAC
#   isi: JSON -> gzip -> AES-256-CTR (counter = nonce 8 byte + penghitung 64-bit)
#   keaslian: HMAC-SHA256 atas salt || nonce || ciphertext (encrypt-then-MAC)
#
# AES memakai pustaka `cryptography` bila terpasang (cepat); kalau tidak ada,
# jatuh ke implementasi AES murni-Python di bawah (lebih lambat, tapi tanpa
# instalasi apa pun). Keduanya menghasilkan byte yang identik.

import base64
import gzip
import hashlib
import hmac
import json
import os

VERSI = 1
ITERASI = 200_000


# --------------------------------------------------------------- AES inti
def _aes_ctr_cryptography(key, counter0, data):
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    enc = Cipher(algorithms.AES(key), modes.CTR(counter0)).encryptor()
    return enc.update(data) + enc.finalize()


# ---- AES-256 murni Python (fallback). Hanya butuh enkripsi blok (CTR). ----
_SBOX = None


def _buat_sbox():
    global _SBOX
    if _SBOX is not None:
        return _SBOX
    p = q = 1
    sbox = [0] * 256
    while True:
        # p adalah generator perkalian di GF(2^8)
        p = p ^ ((p << 1) & 0xFF) ^ (0x1B if p & 0x80 else 0)
        # q adalah inversnya
        q ^= q << 1
        q ^= q << 2
        q ^= q << 4
        q &= 0xFF
        if q & 0x80:
            q ^= 0x09
        x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) \
            ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4))
        sbox[p] = (x ^ 0x63) & 0xFF
        if p == 1:
            break
    sbox[0] = 0x63
    _SBOX = sbox
    return sbox


def _ekspansi_kunci_256(key):
    sbox = _buat_sbox()
    nk, nr = 8, 14
    w = [list(key[4 * i:4 * i + 4]) for i in range(nk)]
    rcon = 1
    for i in range(nk, 4 * (nr + 1)):
        t = list(w[i - 1])
        if i % nk == 0:
            t = t[1:] + t[:1]
            t = [sbox[b] for b in t]
            t[0] ^= rcon
            rcon = ((rcon << 1) ^ 0x11B) & 0xFF if rcon & 0x80 else rcon << 1
        elif i % nk == 4:
            t = [sbox[b] for b in t]
        w.append([w[i - nk][j] ^ t[j] for j in range(4)])
    return w, nr


def _xtime(a):
    a <<= 1
    return (a ^ 0x1B) & 0xFF if a & 0x100 else a


def _enkripsi_blok(w, nr, blok):
    sbox = _buat_sbox()
    s = [list(blok[i::4]) for i in range(4)]   # state[kolom? baris] — pakai baris
    # state disusun kolom-demi-kolom: s[baris][kolom] = blok[kolom*4 + baris]

    def tambah_kunci(ronde):
        for c in range(4):
            for r in range(4):
                s[r][c] ^= w[ronde * 4 + c][r]

    tambah_kunci(0)
    for ronde in range(1, nr + 1):
        for r in range(4):
            for c in range(4):
                s[r][c] = sbox[s[r][c]]
        for r in range(1, 4):
            s[r] = s[r][r:] + s[r][:r]
        if ronde != nr:
            for c in range(4):
                a = [s[r][c] for r in range(4)]
                t = a[0] ^ a[1] ^ a[2] ^ a[3]
                s[0][c] = a[0] ^ t ^ _xtime(a[0] ^ a[1])
                s[1][c] = a[1] ^ t ^ _xtime(a[1] ^ a[2])
                s[2][c] = a[2] ^ t ^ _xtime(a[2] ^ a[3])
                s[3][c] = a[3] ^ t ^ _xtime(a[3] ^ a[0])
        tambah_kunci(ronde)
    keluar = bytearray(16)
    for c in range(4):
        for r in range(4):
            keluar[c * 4 + r] = s[r][c]
    return bytes(keluar)


def _aes_ctr_murni(key, counter0, data):
    w, nr = _ekspansi_kunci_256(key)
    n = int.from_bytes(counter0, 'big')
    keluar = bytearray(len(data))
    for i in range(0, len(data), 16):
        aliran = _enkripsi_blok(w, nr, n.to_bytes(16, 'big'))
        n += 1
        potongan = data[i:i + 16]
        for j, b in enumerate(potongan):
            keluar[i + j] = b ^ aliran[j]
    return bytes(keluar)


def _aes_ctr(key, nonce8, data):
    counter0 = nonce8 + b'\x00' * 8
    try:
        return _aes_ctr_cryptography(key, counter0, data)
    except ImportError:
        return _aes_ctr_murni(key, counter0, data)


# ------------------------------------------------------------- amplop
def _kunci_turunan(password, salt, iterasi=ITERASI):
    raw = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterasi, dklen=64)
    return raw[:32], raw[32:]


def kunci_amplop(data_obj, password, meta=None, iterasi=ITERASI):
    """Objek data -> amplop dict siap ditulis sebagai JSON."""
    mentah = json.dumps(data_obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    padat = gzip.compress(mentah)
    salt = os.urandom(16)
    nonce = os.urandom(8)
    k_aes, k_mac = _kunci_turunan(password, salt, iterasi)
    sandi = _aes_ctr(k_aes, nonce, padat)
    tag = hmac.new(k_mac, salt + nonce + sandi, hashlib.sha256).digest()
    b64 = lambda b: base64.b64encode(b).decode('ascii')
    return {
        'v': VERSI,
        'alg': 'AES-256-CTR+HMAC-SHA256',
        'kdf': 'PBKDF2-SHA256',
        'iter': iterasi,
        'salt': b64(salt),
        'nonce': b64(nonce),
        'mac': b64(tag),
        'data': b64(sandi),
        'meta': meta or {},
    }


def buka_amplop(amplop, password):
    """Amplop dict -> objek data. Password salah -> ValueError."""
    if int(amplop.get('v', 0)) != VERSI:
        raise ValueError('Versi amplop tidak dikenal.')
    b64 = base64.b64decode
    salt = b64(amplop['salt'])
    nonce = b64(amplop['nonce'])
    sandi = b64(amplop['data'])
    iterasi = int(amplop.get('iter') or ITERASI)
    k_aes, k_mac = _kunci_turunan(password, salt, iterasi)
    tag = hmac.new(k_mac, salt + nonce + sandi, hashlib.sha256).digest()
    if not hmac.compare_digest(tag, b64(amplop['mac'])):
        raise ValueError('Password salah, atau file data sudah berubah/rusak.')
    padat = _aes_ctr(k_aes, nonce, sandi)
    return json.loads(gzip.decompress(padat).decode('utf-8'))
