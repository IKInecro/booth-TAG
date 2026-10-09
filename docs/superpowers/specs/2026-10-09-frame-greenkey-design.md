# Desain: Frame Green-Key + Kategori — booth-tag

Tanggal: 2026-10-09
Status: disetujui user (in-chat), siap jadi rencana implementasi

## Latar

`frames/` berisi 11 PNG baru dalam 2 folder. Semua RGB tanpa alpha.
Area foto ditandai hijau (BUKAN exact `#0DFF00`):

- `DESIGN STRIP BIASA/` (9 file, 1204×1795, rasio 0.671 ≈ 100×148mm):
  hijau dominan `(15,255,0)`, 6 kotak (2 kolom × 3 baris).
- `DESIGN KORAN/` (2 file, 1587×2245, rasio 0.707 = A4):
  hijau dominan `(38,255,2)`, 3 slot (1 besar atas + 2 kecil bawah).
- Stamp Eiffel (strip) menumpuk slot atas — tetap jadi overlay frame.
- `frames/new1.png`, `frames/new2.png` + entri json-nya dihapus.

## Keputusan kunci (dari user)

1. Strip kecil: pasangan kiri-kanan sebaris dihitung 1 foto.
   6 kotak = 3 capture; 1 foto digambar ke 2 rect (hasil 1 lembar = 2 strip siap potong).
2. Koran tidak ikut aturan itu: 3 slot independen.
3. Pilih frame pakai chip filter + badge ukuran di kartu.

## Pipeline batch (sekali jalan, bukan runtime)

Script `tools/key_frames.py` (tidak ikut dibundel ke app):

1. Keying toleransi per piksel: `g > 200 AND (g-r) > 120 AND (g-b) > 120`.
   Menangkap `(15,255,0)` dan `(38,255,2)`; putih/krem koran lolos
   (r≈g≈b tinggi → selisih kecil).
2. Feather: alpha ramp 1–2px di batas mask (uji jarak ke tepi mask)
   supaya tidak ada halo hijau di hasil compose.
3. Timpa PNG di tempat (RGB → RGBA). Nama file tidak diubah.
4. Deteksi slot: connected-component pada mask (downsample untuk cepat),
   bbox per komponen pada resolusi penuh, buang noise < 1% luas gambar.
5. Strip kecil: kelompokkan box yang overlap vertikal sebaris →
   `captureGroups: [[0,1],[2,3],[4,5]]`, slots urut row-major (L,R per baris).
   Koran: tanpa grup, slots urut atas→bawah (besar, bawah-kiri, bawah-kanan).
6. Bukti visual: render overlay bbox + nomer urut per frame,
   diperiksa manual sebelum `frames.json` difinalkan.
7. Dependensi: coba `pillow` + `numpy` via pip; kalau gagal,
   fallback stdlib (zlib decode, lebih lambat tapi tanpa dep).

## Skema `frames.json`

```json
{
  "id": "strip-kecil-stripe-10",
  "name": "Stripe 10",
  "src": "./frames/DESIGN STRIP BIASA/STRIPE 10_20261008_213730_0000.png",
  "w": 1204, "h": 1795,
  "category": "strip-kecil",
  "printSize": "100x148mm",
  "captureGroups": [[0,1],[2,3],[4,5]],
  "slots": [{"x":..,"y":..,"w":..,"h":..}, ...]
}
```

- `category`: `strip-kecil` | `strip-koran`.
- `printSize`: `100x148mm` | `A4`.
- `captureGroups`: absen/identitas = 1 rect 1 foto (koran).
- `name` dari nama file (rapikan prefiks tanggal).
- Jumlah "foto" di kartu = panjang `captureGroups` (atau slots bila absen).

## Perubahan app (`app.js`, `index.html`, `style.css`)

1. `loadFrames`: render chip `Semua / Strip Koran (A4) / Strip Kecil (100×148)`;
   filter grid tanpa reload. Kartu tampil badge `printSize` + `N foto`.
2. State capture berbasis grup: `groupCount(f)`, `groupRects(f, k)`.
   `photosCanvases[k]` mengisi semua rect grup `k`.
3. `buildSlots`/`renderProgress`: highlight semua rect grup aktif;
   progress `cur/total-grup`; teks "Slot k dari N" = grup.
4. `composeAndShow`: untuk tiap grup, `drawCover` ke tiap rect-nya.
5. Preview kamera: tetap rasio slot aktif (`videoWrap.aspectRatio`);
   karena isi grup seukuran, cukup ambil rect pertama grup aktif.
6. Hapus referensi `new1`/`new2`.

Non-tujuan: ubah alur kamera/timer/filter/suara; cetak 2-up terpisah
(hasil PNG sudah selembar penuh); ganti nama file frame.

## Verifikasi

- Proof overlay bbox dibaca visual (slot pas di kotak hijau, urutan benar).
- `frames.json` valid JSON, semua `src` ada filenya, tidak ada sisa new1/new2.
- Uji browser: filter chip, pilih 1 koran + 1 strip, capture penuh,
  hasil compose tanpa sisa hijau, foto terduplikasi kiri-kanan di strip.
- `booth-mncu` tidak tersentuh (remote `origin` = booth-TAG).
