"""Fetch real knot-theory documents (arXiv papers + Wikipedia articles) into feed.js.
Run: python scripts/build_feed.py              (rebuild everything)
     python scripts/build_feed.py --only a,b    (fetch only these topics and merge into the existing feed.js)
"""
import json, re, sys, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

UA = {"User-Agent": "knotfound-feed/1.0 (educational hackathon project)"}
NS = {"a": "http://www.w3.org/2005/Atom"}

# topic id -> (label, arXiv query, wikipedia titles)
TOPICS = {
    "beginner": ("Hands-on basics", 'cat:math.GT AND (ti:tricolorability OR ti:"Fox coloring" OR ti:"Fox colorings" OR ti:"stick number" OR ti:"knot table" OR ti:"bridge number")',
                 ["Unknot", "Tricolorability", "Fox n-coloring", "Writhe", "Knot tabulation", "Stick number", "Bridge number"]),
    "grid": ("Grid diagrams & arc index", 'ti:"arc index" OR ti:"grid diagram" OR ti:"grid diagrams" OR ti:"arc presentation" OR ti:"grid number"', []),
    "concordance": ("Slice & concordance", 'cat:math.GT AND (ti:slice OR ti:concordance OR ti:ribbon)',
                    ["Slice knot", "Ribbon knot", "Knot concordance", "Conway knot"]),
    "khovanov": ("Khovanov homology", 'cat:math.GT AND ti:Khovanov', ["Khovanov homology"]),
    "floer": ("Knot Floer", 'cat:math.GT AND ti:"knot Floer"', ["Heegaard Floer homology"]),
    "quantum": ("Jones & quantum", 'cat:math.GT AND (ti:"Jones polynomial" OR ti:"colored Jones")',
                ["Jones polynomial", "HOMFLY polynomial", "Kauffman polynomial", "Bracket polynomial"]),
    "volume": ("Volume conjecture", 'ti:"volume conjecture"', ["Volume conjecture"]),
    "hyperbolic": ("Hyperbolic knots", 'cat:math.GT AND ti:hyperbolic AND ti:knot', ["Hyperbolic link", "Hyperbolic volume", "Figure-eight knot (mathematics)", "Knot complement"]),
    "surgery": ("Dehn surgery", 'cat:math.GT AND ti:surgery AND ti:knot', ["Dehn surgery", "Berge knot", "Lens space"]),
    "unknotting": ("Unknotting", 'cat:math.GT AND (ti:unknotting OR ti:"crossing change" OR ti:"Gordian")',
                   ["Unknotting number", "Unknotting problem", "Reidemeister move"]),
    "classical": ("Alexander & Seifert", 'cat:math.GT AND (ti:"Alexander polynomial" OR ti:"Seifert")',
                  ["Alexander polynomial", "Seifert surface", "Knot invariant", "Knot group", "Linking number"]),
    "diagrams": ("Diagrams & crossings", 'cat:math.GT AND (ti:"crossing number" OR ti:alternating) AND ti:knot',
                 ["Crossing number (knot theory)", "Alternating knot", "Tait conjectures", "Prime knot", "Trefoil knot", "Torus knot", "Satellite knot"]),
    "braids": ("Braids", 'cat:math.GT AND ti:braid', ["Braid group", "Borromean rings"]),
    "vassiliev": ("Vassiliev", 'ti:Vassiliev OR ti:"finite type invariants"', ["Finite type invariant"]),
    "algorithms": ("Algorithms", 'cat:math.GT AND (ti:algorithm OR ti:complexity OR ti:"machine learning") AND ti:knot',
                   ["Knot theory", "Unknotting problem"]),
}

def get(url):
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.read()
        except urllib.error.HTTPError as ex:
            if ex.code != 429: raise
            time.sleep(4 * (i + 1))
    raise RuntimeError("rate limited")

def arxiv(query, n=14):
    url = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode(
        {"search_query": query, "start": 0, "max_results": n, "sortBy": "relevance"})
    root = ET.fromstring(get(url))
    out = []
    for e in root.findall("a:entry", NS):
        aid = e.find("a:id", NS).text.rsplit("/abs/", 1)[-1]
        aid = re.sub(r"v\d+$", "", aid)
        out.append({
            "id": "arxiv:" + aid, "kind": "paper", "src": "arXiv",
            "title": " ".join(e.find("a:title", NS).text.split()),
            "authors": [a.find("a:name", NS).text for a in e.findall("a:author", NS)][:4],
            "year": int(e.find("a:published", NS).text[:4]),
            "abstract": " ".join(e.find("a:summary", NS).text.split())[:600],
            "embed": f"https://arxiv.org/pdf/{aid}",
            "url": f"https://arxiv.org/abs/{aid}",
        })
    return out

def wiki(title):
    t = urllib.parse.quote(title.replace(" ", "_"), safe="()")
    try:
        d = json.loads(get(f"https://en.wikipedia.org/api/rest_v1/page/summary/{t}"))
    except Exception as ex:
        print("  wiki miss:", title, ex); return None
    if d.get("type") != "standard":
        print("  wiki skip:", title, d.get("type")); return None
    page = d["content_urls"]["desktop"]["page"]
    return {
        "id": "wiki:" + d["title"], "kind": "article", "src": "Wikipedia",
        "title": d["title"], "authors": ["Wikipedia"], "year": int(d.get("timestamp", "2025")[:4]),
        "abstract": d.get("extract", "")[:600],
        "thumb": (d.get("thumbnail") or {}).get("source"),
        "embed": d["content_urls"]["mobile"]["page"], "url": page,
    }

ONLY = None
if "--only" in sys.argv: ONLY = sys.argv[sys.argv.index("--only") + 1].split(",")
docs, seen = [], {}
FEED = Path(__file__).resolve().parent.parent / "feed.js"
if ONLY and FEED.exists():
    docs = json.loads(re.search(r"const DOCS = (\[.*\]);", FEED.read_text(encoding="utf-8"), re.S).group(1))
    seen = {d["id"]: d for d in docs}
for tid, (label, q, wtitles) in TOPICS.items():
    if ONLY and tid not in ONLY: continue
    print(tid)
    for w in wtitles:
        if "wiki:" + w in seen: seen["wiki:" + w]["topics"].append(tid); continue
        d = wiki(w); time.sleep(1.2)
        if d:
            if d["id"] in seen: seen[d["id"]]["topics"].append(tid); continue
            d["topics"] = [tid]; seen[d["id"]] = d; docs.append(d)
    try:
        for d in arxiv(q):
            if d["id"] in seen: seen[d["id"]]["topics"].append(tid); continue
            d["topics"] = [tid]; seen[d["id"]] = d; docs.append(d)
    except Exception as ex:
        print("  arxiv fail", ex)
    time.sleep(3.2)  # arXiv API etiquette

topics = [{"id": k, "label": v[0]} for k, v in TOPICS.items()]
out = Path(__file__).resolve().parent.parent / "feed.js"
out.write_text("// generated by scripts/build_feed.py\nconst TOPICS = " + json.dumps(topics, ensure_ascii=False) +
               ";\nconst DOCS = " + json.dumps(docs, ensure_ascii=False, indent=0) + ";\n", encoding="utf-8")
print(len(docs), "docs ->", out)
