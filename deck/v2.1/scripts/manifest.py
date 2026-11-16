"""Collects the recorded clips into deck/media/ and writes deck/manifest.json.

For each clip id under clips/<id>/ it copies <id>.gif (full), <id>-lite.gif and the poster still, and records
their pixel sizes so the deck builder can place pictures without distorting them. Extra stills (any other
*.jpg in the clip folder that is not a contact sheet, a probe or a recon shot) are added as their own ids:
"<id>-<name>". Usage: python3 tools/manifest.py [--budget-kb N]   (N = total KB allowed for the lite GIFs)
"""
import json, os, shutil, sys, glob, subprocess
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIPS = os.path.join(ROOT, "clips"); OUT = os.path.join(ROOT, "deck", "media")
os.makedirs(OUT, exist_ok=True)
SKIP = ("sheet", "probe", "recon", "debug", "dbg", "try", "test", "tmp", "check")
man = {}
for d in sorted(glob.glob(os.path.join(CLIPS, "*"))):
    cid = os.path.basename(d)
    if cid.startswith("_") or not os.path.isdir(d):
        continue
    gif = os.path.join(d, cid + ".gif"); lite = os.path.join(d, cid + "-lite.gif"); poster = os.path.join(d, "poster.jpg")
    entry = {}
    if os.path.exists(gif):
        shutil.copy(gif, os.path.join(OUT, cid + ".gif"))
        with Image.open(gif) as im:
            entry.update(kind="gif", gif=cid + ".gif", gif_size=list(im.size), frames=getattr(im, "n_frames", 1), kb=round(os.path.getsize(gif) / 1024))
        if os.path.exists(lite):
            shutil.copy(lite, os.path.join(OUT, cid + "-lite.gif")); entry.update(lite=cid + "-lite.gif", lite_kb=round(os.path.getsize(lite) / 1024))
    if os.path.exists(poster):
        shutil.copy(poster, os.path.join(OUT, cid + "-poster.jpg"))
        with Image.open(poster) as im:
            entry.update(poster=cid + "-poster.jpg", poster_size=list(im.size))
        entry.setdefault("kind", "still")
    elif "gif" in entry:   # no poster: take a middle frame of the GIF
        with Image.open(gif) as im:
            im.seek(max(0, getattr(im, "n_frames", 1) * 2 // 3)); fr = im.convert("RGB"); fr.save(os.path.join(OUT, cid + "-poster.jpg"), quality=90)
            entry.update(poster=cid + "-poster.jpg", poster_size=list(fr.size))
    if entry:
        man[cid] = entry
    for extra in sorted(glob.glob(os.path.join(d, "*.jpg"))):
        name = os.path.splitext(os.path.basename(extra))[0]
        if name == "poster" or any(k in name.lower() for k in SKIP):
            continue
        eid = cid + "-" + name
        shutil.copy(extra, os.path.join(OUT, eid + ".jpg"))
        with Image.open(extra) as im:
            man[eid] = {"kind": "still", "poster": eid + ".jpg", "poster_size": list(im.size)}
json.dump(man, open(os.path.join(ROOT, "deck", "manifest.json"), "w"), indent=1)
for k, v in man.items():
    print(f"{k:22s} {v['kind']:5s} gif {v.get('gif_size','-')} {v.get('kb','-')}KB lite {v.get('lite_kb','-')}KB poster {v.get('poster_size','-')}")
print(len(man), "media ids; full GIFs", sum(v.get("kb", 0) for v in man.values()), "KB; lite GIFs", sum(v.get("lite_kb", 0) for v in man.values()), "KB")
