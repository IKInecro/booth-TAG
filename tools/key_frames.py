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
    print("selfcheck OK")


if __name__ == "__main__":
    if "--selfcheck" in sys.argv:
        _selfcheck()
    else:
        print("pakai --selfcheck | --proof ... | --batch")
