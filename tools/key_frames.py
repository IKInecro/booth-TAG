"""Green-key batch untuk frame booth-tag. Lihat spec:
docs/superpowers/specs/2026-10-09-frame-greenkey-design.md
"""
import sys


def key_green_to_alpha(rgb):
    """RGB uint8 (H,W,3) -> RGBA. Hijau inti transparan, ring 2px feather."""
    import numpy as np
    a = np.asarray(rgb, dtype=np.uint8)
    if a.ndim != 3 or a.shape[2] < 3:
        raise ValueError("butuh array RGB (H,W,3)")
    rgb3 = a[..., :3]
    r = rgb3[..., 0].astype(np.int16)
    g = rgb3[..., 1].astype(np.int16)
    b = rgb3[..., 2].astype(np.int16)
    core = (g > 200) & ((g - r) > 120) & ((g - b) > 120)
    alpha = np.full(core.shape, 255, dtype=np.uint8)
    alpha[core] = 0

    def _neighbors(m):
        p = np.pad(m, 1, mode="constant", constant_values=False)
        return (p[:-2, :-2] | p[:-2, 1:-1] | p[:-2, 2:]
                | p[1:-1, :-2] | p[1:-1, 2:]
                | p[2:, :-2] | p[2:, 1:-1] | p[2:, 2:])
    ring1 = _neighbors(core) & ~core
    ring2 = _neighbors(core | ring1) & ~core & ~ring1
    alpha[ring1] = 110
    alpha[ring2] = 190
    return np.dstack([rgb3, alpha])


def _green_mask(rgb):
    import numpy as np
    a = np.asarray(rgb, dtype=np.uint8)[..., :3].astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (g > 200) & ((g - r) > 120) & ((g - b) > 120)


def detect_slots(mask, down=4, min_frac=0.01, close_px=9):
    """mask bool (H,W) -> [{'x','y','w','h'}] urut baris atas→bawah, x menaik."""
    import numpy as np
    from collections import deque
    from PIL import Image, ImageFilter
    mask = np.asarray(mask, dtype=bool)
    h, w = mask.shape
    small = np.asarray(
        Image.fromarray(mask).resize((w // down, h // down), Image.NEAREST))
    small = np.asarray(Image.fromarray(small).filter(
        ImageFilter.MaxFilter(close_px)).filter(
        ImageFilter.MinFilter(close_px)))
    sh, sw = small.shape
    seen = np.zeros_like(small, dtype=bool)
    comps = []
    for y in range(sh):
        for x in range(sw):
            if small[y, x] and not seen[y, x]:
                q = deque([(y, x)])
                seen[y, x] = True
                x0 = x1 = x
                y0 = y1 = y
                n = 0
                while q:
                    cy, cx = q.popleft()
                    n += 1
                    if cx < x0: x0 = cx
                    if cx > x1: x1 = cx
                    if cy < y0: y0 = cy
                    if cy > y1: y1 = cy
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if (0 <= ny < sh and 0 <= nx < sw
                                    and small[ny, nx] and not seen[ny, nx]):
                                seen[ny, nx] = True
                                q.append((ny, nx))
                comps.append((n, x0, y0, x1, y1))
    min_area = h * w * min_frac / (down * down)
    rects = []
    for n, x0, y0, x1, y1 in comps:
        if n < min_area:
            continue
        mx0 = max(0, x0 * down - down * 2)
        my0 = max(0, y0 * down - down * 2)
        mx1 = min(w, (x1 + 1) * down + down * 2)
        my1 = min(h, (y1 + 1) * down + down * 2)
        sub = mask[my0:my1, mx0:mx1]
        rows = np.where(sub.any(axis=1))[0]
        cols = np.where(sub.any(axis=0))[0]
        if len(rows) == 0 or len(cols) == 0:
            continue
        rects.append({"x": int(mx0 + cols[0]), "y": int(my0 + rows[0]),
                      "w": int(cols[-1] - cols[0] + 1),
                      "h": int(rows[-1] - rows[0] + 1)})
    rects.sort(key=lambda r: (r["y"], r["x"]))
    return rects


def group_strip(rects):
    """Rects urut baris -> grup pasangan [[i,j],...] (kiri+kanan sebaris)."""
    order = sorted(range(len(rects)),
                   key=lambda i: (rects[i]["y"], rects[i]["x"]))
    used = [False] * len(rects)
    groups = []
    for i in order:
        if used[i]:
            continue
        a = rects[i]
        partner = None
        for j in order:
            if used[j] or j == i or rects[j]["x"] <= a["x"]:
                continue
            b = rects[j]
            ov = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
            if ov >= 0.5 * min(a["h"], b["h"]):
                partner = j
                break
        used[i] = True
        if partner is None:
            groups.append([i])
        else:
            used[partner] = True
            groups.append([i, partner])
    return groups


def analyze(path, category):
    from PIL import Image
    from pathlib import Path
    import numpy as np
    im = Image.open(path).convert("RGB")
    w, h = im.size
    rects = detect_slots(_green_mask(np.asarray(im)))
    groups = (group_strip(rects) if category == "strip-kecil"
              else [[i] for i in range(len(rects))])
    return {"file": Path(path).name, "w": w, "h": h,
            "rects": rects, "groups": groups}


def proof_image(path, category):
    from PIL import Image, ImageDraw
    from pathlib import Path
    info = analyze(path, category)
    im = Image.open(path).convert("RGB")
    d = ImageDraw.Draw(im)
    lw = max(3, im.width // 300)
    for k, r in enumerate(info["rects"]):
        d.rectangle([r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]],
                    outline=(255, 0, 0), width=lw)
        d.text((r["x"] + lw, r["y"] + lw), str(k), fill=(255, 0, 0))
    Path("tools/proofs").mkdir(parents=True, exist_ok=True)
    out = f"tools/proofs/{Path(path).stem}.proof.png"
    im.save(out)
    print(f"{info['file']}: {im.width}x{im.height} "
          f"slot={len(info['rects'])} grup={info['groups']} -> {out}")
    return out


def _test_detect():
    import numpy as np
    m = np.zeros((200, 240), bool)
    m[20:60, 20:100] = True
    m[20:60, 140:220] = True
    m[100:140, 20:100] = True
    m[100:140, 140:220] = True
    m[180:182, 180:185] = True  # noise, harus dibuang
    rects = detect_slots(m)
    assert len(rects) == 4, rects
    assert (rects[0]["x"], rects[0]["y"],
            rects[0]["w"], rects[0]["h"]) == (20, 20, 80, 40), rects[0]
    assert (rects[1]["x"], rects[1]["y"]) == (140, 20), rects[1]
    assert (rects[2]["x"], rects[2]["y"]) == (20, 100), rects[2]
    assert (rects[3]["x"], rects[3]["y"]) == (140, 100), rects[3]
    assert group_strip(rects) == [[0, 1], [2, 3]], group_strip(rects)
    print("detect OK")


def _selfcheck():
    import numpy as np
    img = np.full((9, 9, 3), [240, 235, 220], dtype=np.uint8)  # krem jauh
    img[3:6, 3:6] = [15, 255, 0]  # inti hijau tengah
    img[0, 0] = [38, 255, 2]  # hijau koran, jauh dari inti
    img[0, 8] = [255, 255, 255]  # putih, jauh dari inti
    out = key_green_to_alpha(img)
    a = out[..., 3]
    assert a[4, 4] == 0, "inti strip transparan"
    assert a[0, 0] == 0, "hijau koran transparan"
    assert a[2, 4] == 110, f"ring1 parsial: {a[2,4]}"
    assert a[1, 4] == 190, f"ring2 parsial: {a[1,4]}"
    assert a[0, 4] == 255, "krem jauh tetap opak"
    assert a[0, 8] == 255, "putih jauh tetap opak"
    _test_detect()
    print("selfcheck OK")


if __name__ == "__main__":
    if "--selfcheck" in sys.argv:
        _selfcheck()
    elif "--proof" in sys.argv:
        args = sys.argv[sys.argv.index("--proof") + 1:]
        cat = "auto"
        paths = []
        for a in args:
            if a.startswith("--cat="):
                cat = a.split("=", 1)[1]
            else:
                paths.append(a)
        for p in paths:
            c = cat
            if c == "auto":
                c = ("strip-koran" if "KORAN" in p.upper() else "strip-kecil")
            proof_image(p, c)
    else:
        print("pakai --selfcheck | --proof ... | --batch")
