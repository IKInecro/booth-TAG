# Frame Green-Key + Kategori Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 11 PNG frame di-green-key jadi transparan, slot terdeteksi otomatis, `frames.json` regenerate dengan kategori, app dukung grup capture + chip filter.

**Architecture:** Batch Python sekali-jalan (keying toleransi + connected-component + proof overlay, verifikasi visual) lalu perubahan kecil di `app.js`/`index.html`/`style.css` untuk grup capture dan filter kategori. Tanpa dep runtime baru.

**Tech Stack:** Python 3.11 + pillow/numpy (batch saja), vanilla JS, `node --check` untuk verifikasi sintaks.

**Spec:** `docs/superpowers/specs/2026-10-09-frame-greenkey-design.md`

## Global Constraints

- Keying: `g > 200 AND (g-r) > 120 AND (g-b) > 120`, feather alpha 1–2px di tepi mask.
- Timpa PNG di tempat; nama file tidak diubah.
- Hapus `frames/new1.png`, `frames/new2.png` + entri json-nya.
- `origin` tetap `https://github.com/IKInecro/booth-TAG.git`; `booth-mncu` tidak tersentuh.
- Commit per task selesai.

## Review Focus

- Tepi hijau bergerigi/halo di hasil compose → feather + cek proof overlay zoom tepi slot.
- Box noise kecil (mis. teks hijau "GROWWITHTAG" bukan hijau — aman, tapi logo TAG warna-warni) → saring komponen < 1% luas gambar + verifikasi visual jumlah slot (strip=6 box/3 grup, koran=3 box).
- Pasangan baris salah (box kiri-baris-1 terpasang dengan kanan-baris-2) → grup by overlap vertikal ≥ 50% tinggi box + cek proof bernomor.
- Nama file ber-spasi di `src` → cek `img` load (browser encode otomatis) saat uji.
- Slot koran bawah-kiri vs bawah-kanan tertukar → urutan x menaik dalam baris yang sama.

---

### Task 1: Env + fungsi keying beruji

**Files:**
- Create: `tools/key_frames.py`
- Create: `tools/proofs/` (output proof, gitignore)

**Interfaces:**
- Consumes: PNG RGB dari `frames/`
- Produces: `key_green_to_alpha(pil_image) -> pil_rgba` yang dipakai Task 2–3

- [ ] **Step 1: Coba install dep, catat hasil**

Run: `python3 -m pip install pillow numpy 2>&1 | tail -n 2`
Expected: sukses; kalau gagal, tulis fallback stdlib di `tools/key_frames.py` (decode via `zlib`, tanpa dep) dan lanjut.

- [ ] **Step 2: Tulis skrip cek keying dengan assert**

Buat `tools/key_frames.py` berisi fungsi `key_green_to_alpha` + blok
`if __name__ == '__main__':` yang assert: piksel `(15,255,0)` dan
`(38,255,2)` jadi alpha 0; piksel putih `(255,255,255)` dan krem
`(240,235,220)` tetap alpha 255; piksel tepi `(46,254,11)` jadi alpha
parsial (0 < a < 255).

- [ ] **Step 3: Jalankan cek**

Run: `python3 tools/key_frames.py --selfcheck`
Expected: semua assert lolos (exit 0).

- [ ] **Step 4: Commit**

```bash
git add tools/key_frames.py
git commit -m "feat: green-key toleransi + feather untuk frame"
```

### Task 2: Deteksi slot + proof overlay

**Files:**
- Modify: `tools/key_frames.py` (tambah deteksi + proof)
- Test: `tools/proofs/*.proof.png` (diperiksa visual oleh pekerja)

**Interfaces:**
- Consumes: `key_green_to_alpha` dari Task 1
- Produces: `detect_slots(mask) -> list[rect]` dan `group_strip(rects) -> groups`, dipakai Task 3

- [ ] **Step 1: Implementasi `detect_slots` + `group_strip`**

Signature: `detect_slots(green_mask_2d) -> [{'x','y','w','h'}]` (buang
komponen < 1% luas gambar); `group_strip(rects) -> [[i,j],...]` (pasangan
overlap vertikal ≥ 50% tinggi box, urut baris atas→bawah, dalam baris x menaik).

- [ ] **Step 2: Generate proof overlay untuk 2 sampel**

Run: `python3 tools/key_frames.py --proof "frames/DESIGN STRIP BIASA/STRIPE 10_20261008_213730_0000.png" "frames/DESIGN KORAN/1_20261009_134611_0000.png"`
Expected: 2 file di `tools/proofs/` berisi bbox + nomer urut.

- [ ] **Step 3: Verifikasi visual (wajib lolos sebelum Task 3)**

Baca kedua proof sebagai gambar. Lolos bila: strip = 6 box bernomor
0–5 row-major (L,R per baris), grup = [[0,1],[2,3],[4,5]]; koran = 3 box
(0 besar atas, 1 bawah-kiri, 2 bawah-kanan); tidak ada box noise.
Kalau gagal, tuning threshold/morphologi di fungsi yang sama, ulangi Step 2.

- [ ] **Step 4: Commit**

```bash
git add tools/key_frames.py
git commit -m "feat: deteksi slot + grup pasangan strip"
```

### Task 3: Batch 11 frame + regenerate frames.json

**Files:**
- Modify: 11 PNG di `frames/` (timpa transparan)
- Modify: `frames.json` (regenerate penuh)
- Delete: `frames/new1.png`, `frames/new2.png`

**Interfaces:**
- Consumes: `key_green_to_alpha`, `detect_slots`, `group_strip` dari Task 1–2
- Produces: `frames.json` dengan `category`/`printSize`/`captureGroups` yang dipakai Task 4

- [ ] **Step 1: Batch keying semua 11 file + proof per file**

Run: `python3 tools/key_frames.py --batch`
Expected: exit 0; 11 proof baru di `tools/proofs/`; tiap file log
`slot=N grup=M` dengan N=6/M=3 (strip) atau N=3/M=3-identitas (koran).
Verifikasi visual cepat semua proof (jumlah + urutan benar).

- [ ] **Step 2: Tulis `frames.json` baru**

Aturan: satu entri per PNG; `category` dari nama folder
(`DESIGN KORAN`→`strip-koran`/`A4`, `DESIGN STRIP BIASA`→`strip-kecil`/`100x148mm`);
`captureGroups` hanya untuk strip-kecil; `name` = nama file tanpa
prefiks tanggal (`14_20261008_213731_0004` → bersihkan jadi judul);
`w,h` = dimensi asli; tidak ada entri new1/new2.

- [ ] **Step 3: Validasi json + file**

Run: `python3 -c "import json; d=json.load(open('frames.json')); assert len(d)==11; import os; [os.path.exists(f['src']) or print('HILANG',f['src']) for f in d]; assert all(f['category'] in ('strip-koran','strip-kecil') for f in d); print('OK', len(d))"`
Expected: `OK 11` tanpa baris HILANG.

- [ ] **Step 4: Hapus new1/new2 + commit**

```bash
git rm -q frames/new1.png frames/new2.png
git add frames frames.json tools/proofs
git commit -m "feat: 11 frame transparan + frames.json kategori"
```

### Task 4: App — grup capture + chip kategori

**Files:**
- Modify: `app.js` (grup capture, filter, badge)
- Modify: `index.html` (container chip)
- Modify: `style.css` (gaya chip + badge)

**Interfaces:**
- Consumes: `frames.json` dari Task 3 (`category`, `printSize`, `captureGroups`)
- Produces: UI + alur foto final (tidak ada konsumen lanjutan)

- [ ] **Step 1: Helper grup + kartu badge + chip filter**

Tambah di `app.js`: `groupCount(f)` (panjang `captureGroups` atau
`slots.length`), `groupRects(f,k)`, state `activeCategory='all'`;
`loadFrames` render chip `Semua / Strip Koran (A4) / Strip Kecil (100×148)`
+ filter grid; kartu tampil badge `printSize` + `N foto` (= groupCount).
Tambah `<div id="category-chips">` di `index.html`, gaya di `style.css`
ikut pola `.neo-btn` yang ada.

- [ ] **Step 2: Alur booth ikut grup**

Ganti acuan `selected.slots.length` → `groupCount(selected)` di
`renderProgress`/`btnCapture`; `buildSlots` highlight semua rect grup aktif;
`composeAndShow` loop grup → `drawCover` ke tiap rect grup;
`selectFrame` pakai rect pertama grup aktif untuk `videoWrap.aspectRatio`.

- [ ] **Step 3: Cek sintaks + json konsisten**

Run: `node --check app.js && python3 -c "import json; d=json.load(open('frames.json')); print('frames:',len(d))"`
Expected: tanpa error + `frames: 11`.

- [ ] **Step 4: Uji browser manual (difasilitasi ke user bila kamera tak ada)**

Buka via server lokal, cek: chip filter menyaring benar; 1 frame koran +
1 frame strip dicapture sampai hasil; strip mengisi pasangan kiri-kanan
identik; tidak ada sisa hijau. Catat hasil di pesan commit bila uji parsial.

- [ ] **Step 5: Commit + push**

```bash
git add app.js index.html style.css
git commit -m "feat: grup capture strip + filter kategori frame"
git push origin main
```
