"""Make real thumbnails for every document in feed.js -> thumbs/*.webp + thumbs.js

Papers: download the arXiv PDF and crop the largest figure (raster image or cluster of vector
drawings) from the first pages; if none, use the top of page 1 (title + abstract).
Articles: the Wikipedia lead image (or the first image in the article).
Run: python scripts/build_thumbs.py  [pdf-cache-dir]
"""
import io, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "thumbs"; OUT.mkdir(exist_ok=True)
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".pdfcache"; CACHE.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "knotfound-thumbs/1.0 (educational hackathon project)"}
W, H = 480, 300

src = (ROOT / "feed.js").read_text(encoding="utf-8")
DOCS = json.loads(re.search(r"const DOCS = (\[.*\]);", src, re.S).group(1))

def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as ex:
            if i == tries - 1: raise
            time.sleep(3 * (i + 1))

def safe(i): return re.sub(r"[^A-Za-z0-9._-]", "_", i)

def fit(img):
    """Fit onto a white 480x300 canvas (contain, centred)."""
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA"); bg = Image.new("RGBA", img.size, "white"); bg.alpha_composite(img); img = bg
    img = img.convert("RGB")
    img.thumbnail((W - 24, H - 24), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), "white")
    canvas.paste(img, ((W - img.width) // 2, (H - img.height) // 2))
    return canvas

def best_region(page):
    pr = page.rect; parea = pr.width * pr.height
    cands = []
    for info in page.get_image_info():
        r = pymupdf.Rect(info["bbox"]) & pr
        cands.append(r)
    try:
        cands += [pymupdf.Rect(r) & pr for r in page.cluster_drawings()]
    except Exception:
        pass
    good = []
    for r in cands:
        a = r.width * r.height
        if a < 0.04 * parea or r.height < 90 or r.width < 90: continue      # too small / rules / logos
        if a > 0.85 * parea: continue                                        # page frame
        good.append((a, r))
    return max(good, key=lambda x: x[0])[1] if good else None

def paper_thumb(d):
    aid = d["id"].split(":", 1)[1]
    pdf = CACHE / (safe(aid) + ".pdf")
    if not pdf.exists():
        pdf.write_bytes(get(f"https://arxiv.org/pdf/{aid}"))
        time.sleep(1.0)
    doc = pymupdf.open(pdf)
    for pno in range(min(len(doc), 30)):
        page = doc[pno]
        r = best_region(page)
        if not r: continue
        # reject boxes that are mostly running text (theorem boxes, tables, title frames)
        words = page.get_text("words", clip=r)
        text_area = sum((w[2] - w[0]) * (w[3] - w[1]) for w in words)
        if text_area > 0.25 * r.width * r.height: continue
        pix = page.get_pixmap(clip=r + (-6, -6, 6, 6), dpi=160)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
        ink = sum(1 for p in img.resize((120, 80)).getdata() if p < 200) / 9600
        if ink < 0.04: continue                       # nearly blank
        return fit(Image.open(io.BytesIO(pix.tobytes("png")))), "figure"
    page = doc[0]; pr = page.rect
    clip = pymupdf.Rect(pr.x0 + pr.width * .08, pr.y0 + pr.height * .07, pr.x1 - pr.width * .08, pr.y0 + pr.height * .07 + (pr.width * .84) * H / W)
    pix = page.get_pixmap(clip=clip, dpi=110)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB").resize((W, H), Image.LANCZOS)
    return img, "page"

def article_thumb(d):
    url = d.get("thumb")
    if not url:
        title = urllib.parse.quote(d["url"].split("/wiki/")[1], safe="()_%")
        media = json.loads(get(f"https://en.wikipedia.org/api/rest_v1/page/media-list/{title}"))
        imgs = [m for m in media.get("items", []) if m.get("type") == "image" and m.get("srcset")]
        if not imgs: return None, "none"
        url = "https:" + imgs[0]["srcset"][0]["src"]
    time.sleep(0.8)
    return fit(Image.open(io.BytesIO(get(url)))), "wiki"

result, stats, figures = {}, {}, []
_old = ROOT / "thumbs.js"
if _old.exists():
    _m = re.search(r"const FIGURES = (\[.*?\]);", _old.read_text(encoding="utf-8"), re.S)
    if _m: figures = json.loads(_m.group(1))
for n, d in enumerate(DOCS, 1):
    fn = OUT / (safe(d["id"]) + ".webp")
    if fn.exists():
        result[d["id"]] = "thumbs/" + fn.name; stats["cached"] = stats.get("cached", 0) + 1; continue
    try:
        img, kind = (paper_thumb if d["kind"] == "paper" else article_thumb)(d)
        if img is None: raise RuntimeError("no image")
        img.save(fn, "WEBP", quality=78)
        result[d["id"]] = "thumbs/" + fn.name
        if kind == "figure": figures.append(d["id"])
        stats[kind] = stats.get(kind, 0) + 1
        print(f"[{n}/{len(DOCS)}] {kind:6} {d['title'][:70]}", flush=True)
    except Exception as ex:
        stats["fail"] = stats.get("fail", 0) + 1
        print(f"[{n}/{len(DOCS)}] FAIL   {d['title'][:60]} :: {ex}", flush=True)

(ROOT / "thumbs.js").write_text("// generated by scripts/build_thumbs.py\nconst THUMBS = " + json.dumps(result, indent=0) + ";\nconst FIGURES = " + json.dumps(figures) + ";\n", encoding="utf-8")
print("done", stats)
