(() => {
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmt = s => s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.floor(s/60)}m` : `${(s/3600).toFixed(1)}h`;
const clock = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
const NOW_YEAR = 2026;

// ---------- lookups ----------
// Papers whose PDF couldn't be fetched (no thumbnail) are dropped so the viewer never shows a blank page.
if (typeof THUMBS !== "undefined") for (let i = DOCS.length - 1; i >= 0; i--) if (DOCS[i].kind === "paper" && !THUMBS[DOCS[i].id]) DOCS.splice(i, 1);
const DOC =Object.fromEntries(DOCS.map(d => [d.id, d]));
const TOPIC = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const AREA = Object.fromEntries(AREAS.map(a => [a.id, a]));
const NODE = Object.fromEntries(NODES.map(n => [n.id, n]));
const OPEN = NODES.filter(n => n.type === "open");
const TCOLOR = { concordance:"#e8590c", khovanov:"#c2255c", floer:"#e03131", quantum:"#7048e8", volume:"#5f3dc4", hyperbolic:"#2f9e44",
  surgery:"#f08c00", unknotting:"#0c8599", classical:"#1971c2", diagrams:"#4263eb", braids:"#9c36b5", vassiliev:"#862e9c", algorithms:"#495057" };
const AREA_TOPIC = { classical:"classical", diagrams:"diagrams", unknotting:"unknotting", quantum:"quantum", vassiliev:"vassiliev",
  khovanov:"khovanov", hfk:"floer", hyperbolic:"hyperbolic", surgery:"surgery", concordance:"concordance", computation:"algorithms" };
const nodeTopics = n => n.id === "volume-conj" ? ["volume", "hyperbolic"] : [AREA_TOPIC[n.area]];

// ---------- profile (dwell time) ----------
const STORE = "knotfound-v1";
let profile = { time: {}, last: {} };
try { profile = JSON.parse(localStorage.getItem(STORE)) || profile; } catch (e) {}
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(profile)); } catch (e) {} };

// ================= RECOMMENDER =================
const STOP = new Set("with from that this their there these those into over under about knot knots theory note some on of the and for are via its new two".split(" "));
const words = s => s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOP.has(w));
function fvDoc(d) { const v = {}; d.topics.forEach(t => v["t:" + t] = 2); words(d.title).forEach(w => v["w:" + w] = 1); return v; }
function fvNode(n) { const v = {}; nodeTopics(n).forEach(t => v["t:" + t] = 2); n.tags.forEach(t => words(t).forEach(w => v["w:" + w] = 1)); words(n.title).forEach(w => v["w:" + w] = 1); return v; }
const FV = {};
DOCS.forEach(d => FV[d.id] = fvDoc(d));
NODES.forEach(n => FV["node:" + n.id] = fvNode(n));
const nrm = v => Math.sqrt(Object.values(v).reduce((s, x) => s + x*x, 0)) || 1;
const NRM = Object.fromEntries(Object.entries(FV).map(([k, v]) => [k, nrm(v)]));
const dot = (a, b) => { let s = 0; for (const k in a) if (b[k]) s += a[k]*b[k]; return s; };
const cos = (a, b, nb) => dot(a, b) / (nrm(a) * (nb || nrm(b)));

function weightOf(key) {
  const t = profile.time[key] || 0; if (!t) return 0;
  const days = (Date.now() - (profile.last[key] || Date.now())) / 864e5;
  return Math.log(1 + t) * Math.exp(-days / 14);       // diminishing returns + 2-week decay
}
const readKeys = () => Object.keys(profile.time).filter(k => FV[k] && profile.time[k] >= 5);
function userVec() {
  const u = {};
  readKeys().forEach(k => { const w = weightOf(k); for (const f in FV[k]) u[f] = (u[f] || 0) + w * FV[k][f]; });
  return u;
}
const label = k => k.startsWith("node:") ? NODE[k.slice(5)].title : DOC[k].title;

// returns [{id, why}] — personalised, diversified, with one exploration slot
function recommend(k = 24, { exclude = null, topic = null, q = "" } = {}) {
  const ql = q.toLowerCase();
  let pool = DOCS.filter(d => d.id !== exclude && (!topic || d.topics.includes(topic)) &&
    (!ql || (d.title + " " + d.authors.join(" ") + " " + d.topics.map(t => TOPIC[t].label).join(" ")).toLowerCase().includes(ql)));
  const reads = readKeys();
  if (!reads.length) {
    // cold start: Wikipedia overviews first, then papers round-robin by topic
    const art = pool.filter(d => d.kind === "article"), pap = pool.filter(d => d.kind === "paper");
    const byT = {}; pap.forEach(d => (byT[d.topics[0]] ||= []).push(d));
    const rr = []; let i = 0, more = true;
    while (more) { more = false; for (const t in byT) if (byT[t][i]) { rr.push(byT[t][i]); more = true; } i++; }
    const mix = []; while (art.length || rr.length) { mix.push(...art.splice(0, 1)); mix.push(...rr.splice(0, 3)); }
    return mix.slice(0, k).map(d => ({ id: d.id, why: "" }));
  }
  const u = userVec(), un = nrm(u);
  const scored = pool.map(d => {
    let s = dot(u, FV[d.id]) / (un * NRM[d.id]);
    const seen = profile.time[d.id] || 0;
    if (seen > 120) s *= 0.2; else if (seen > 10) s *= 0.5;
    let best = null, bv = 0;
    reads.forEach(r => { if (r === d.id) return; const v = weightOf(r) * cos(FV[r], FV[d.id], NRM[d.id]); if (v > bv) { bv = v; best = r; } });
    return { id: d.id, s, why: best ? `Because you read ${label(best)}` : "" };
  });
  // greedy diversification: penalise repeating the same main topic
  const out = [], used = {};
  const rest = scored.sort((a, b) => b.s - a.s).slice(0, k * 4);
  while (out.length < k && rest.length) {
    let bi = 0, bs = -1;
    rest.forEach((c, i) => { const v = c.s - 0.08 * (used[DOC[c.id].topics[0]] || 0); if (v > bs) { bs = v; bi = i; } });
    const c = rest.splice(bi, 1)[0]; out.push(c); used[DOC[c.id].topics[0]] = (used[DOC[c.id].topics[0]] || 0) + 1;
  }
  // exploration slot (position 4): best-known item from your least-read topic
  if (!topic && !ql && out.length > 4) {
    const tt = {}; TOPICS.forEach(t => tt[t.id] = 0);
    reads.forEach(r => (FV[r] && Object.keys(FV[r]).filter(f => f.startsWith("t:")).forEach(f => tt[f.slice(2)] += profile.time[r])));
    const cold = TOPICS.slice().sort((a, b) => tt[a.id] - tt[b.id])[0];
    const ex = DOCS.find(d => d.topics.includes(cold.id) && d.kind === "article" && !out.some(o => o.id === d.id) && d.id !== exclude)
            || DOCS.find(d => d.topics.includes(cold.id) && !out.some(o => o.id === d.id) && d.id !== exclude);
    if (ex) out.splice(3, 0, { id: ex.id, why: `New to you: ${cold.label}` });
  }
  return out.slice(0, k);
}

// ================= THUMBNAILS =================
// Procedural torus-knot art for papers (and articles without an image).
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const PQ = [[2,3],[2,5],[3,4],[2,7],[3,5],[3,7],[4,5],[2,9],[5,6],[4,7]];
const thumbCache = {};
function knotSVG(id, color) {
  if (thumbCache[id]) return thumbCache[id];
  const h = hash(id), [p, q] = PQ[h % PQ.length], rot = (h >> 8) % 360, R = 2 + ((h >> 4) % 3) * 0.25;
  let d = "";
  for (let i = 0; i <= 600; i++) {
    const t = i / 600 * 2 * Math.PI, r = Math.cos(q * t) + R;
    d += (i ? "L" : "M") + (160 + 24 * r * Math.cos(p * t)).toFixed(1) + " " + (90 + 24 * r * Math.sin(p * t)).toFixed(1);
  }
  return thumbCache[id] = `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><rect width="320" height="180" fill="${color}18"/>` +
    `<g transform="rotate(${rot} 160 90)"><path d="${d}" fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round" opacity=".9"/></g></svg>`;
}
// Thumbnails are real images: a figure cropped from the paper's PDF, or the article's Wikipedia image
// (generated by scripts/build_thumbs.py). The knot drawing is only a last-resort fallback.
const THUMB = typeof THUMBS !== "undefined" ? THUMBS : {};
// Articles with no image of their own borrow a real figure from a paper on the same topic.
function borrowed(d) {
  const figs = new Set(typeof FIGURES !== "undefined" ? FIGURES : []);
  const pool = DOCS.filter(x => figs.has(x.id) && x.topics.includes(d.topics[0]));
  return pool.length ? THUMB[pool[hash(d.id) % pool.length].id] : null;
}
// Length: papers = page count (≈4 min/page for maths), articles = words at 200 wpm. From scripts/build_meta.py.
const METAS = typeof META !== "undefined" ? META : {};
function readMin(d) { const m = METAS[d.id] || {}; return m.pages ? m.pages * 4 : m.words ? Math.max(1, Math.round(m.words / 200)) : 0; }
const dur = mins => mins >= 60 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m` : `${mins} min`;
function lenShort(d) { const m = METAS[d.id] || {}; return m.pages ? `${m.pages} pp` : m.words ? dur(readMin(d)) : (d.kind === "paper" ? "PDF" : "WIKI"); }
function lenLong(d) {
  const m = METAS[d.id] || {}; if (!m.pages && !m.words) return "";
  return `${m.pages ? m.pages + " pages" : m.words.toLocaleString() + " words"} · ~${dur(readMin(d))} read`;
}
function thumb(d, hover = true) {
  const src = THUMB[d.id] || d.thumb || borrowed(d);
  return `<div class="thumb">${src ? `<img loading="lazy" src="${esc(src)}" alt="">` : knotSVG(d.id, TCOLOR[d.topics[0]] || "#555")}
    <span class="badge">${lenShort(d)}</span>
    ${hover ? `<div class="hov"><div class="hov-len">${d.kind === "paper" ? "Paper" : "Wikipedia"}${lenLong(d) ? " · " + lenLong(d) : ""}</div><p>${esc(d.abstract)}</p></div>` : ""}</div>`;
}
const byline = d => d.kind === "article" ? "Wikipedia" : d.authors[0].split(" ").pop() + (d.authors.length > 1 ? " et al." : "");
function card(r) {
  const d = DOC[r.id], col = TCOLOR[d.topics[0]];
  return `<div class="card" data-doc="${esc(d.id)}" title="${esc(r.why || d.title)}">${thumb(d)}
    <div class="c-body"><div class="avatar" style="background:${col}">${esc(TOPIC[d.topics[0]].label[0])}</div><div style="min-width:0">
    <div class="c-title">${esc(d.title)}</div><div class="c-meta">${esc(byline(d))} · ${esc(TOPIC[d.topics[0]].label)} · ${d.year}</div>
    ${r.why ? `<div class="c-why">${esc(r.why)}</div>` : ""}</div></div></div>`;
}
function mini(r) {
  const d = DOC[r.id];
  return `<div class="mini" data-doc="${esc(d.id)}">${thumb(d)}<div style="min-width:0">
    <div class="c-title">${esc(d.title)}</div><div class="c-meta">${esc(byline(d))} · ${d.year}</div>
    ${r.why ? `<div class="c-meta">${esc(r.why)}</div>` : ""}</div></div>`;
}

// ================= LEARNING PATHS (bottom-up engine) =================
// Concept prerequisite graph over the Wikipedia articles in the feed. A path to any document is the
// topologically ordered set of concepts it depends on, then an introductory survey, then the document.
const PREREQ = {
  "Knot theory": [], "Reidemeister move": ["Knot theory"], "Trefoil knot": ["Knot theory"], "Prime knot": ["Knot theory"],
  "Linking number": ["Knot theory"], "Knot invariant": ["Reidemeister move", "Trefoil knot"],
  "Crossing number (knot theory)": ["Knot invariant"], "Unknotting number": ["Crossing number (knot theory)"],
  "Unknotting problem": ["Reidemeister move", "Unknotting number"], "Torus knot": ["Prime knot"], "Satellite knot": ["Torus knot"],
  "Alternating knot": ["Crossing number (knot theory)"], "Bracket polynomial": ["Knot invariant"], "Jones polynomial": ["Bracket polynomial"],
  "Tait conjectures": ["Alternating knot", "Jones polynomial"], "HOMFLY polynomial": ["Jones polynomial"], "Kauffman polynomial": ["HOMFLY polynomial"],
  "Seifert surface": ["Knot invariant"], "Alexander polynomial": ["Seifert surface"], "Knot group": ["Knot invariant"],
  "Knot complement": ["Knot group"], "Braid group": ["Knot theory"], "Borromean rings": ["Linking number"],
  "Finite type invariant": ["Jones polynomial"], "Khovanov homology": ["Jones polynomial"],
  "Floer homology": ["Alexander polynomial", "Knot complement"], "Slice knot": ["Seifert surface"], "Ribbon knot": ["Slice knot"],
  "Link concordance": ["Slice knot", "Linking number"], "Conway knot": ["Slice knot", "Alexander polynomial"],
  "Dehn surgery": ["Knot complement"], "Lens space": ["Dehn surgery"], "Berge knot": ["Lens space", "Torus knot"],
  "Hyperbolic link": ["Knot complement"], "Figure-eight knot (mathematics)": ["Hyperbolic link"],
  "Hyperbolic volume": ["Hyperbolic link"], "Volume conjecture": ["Hyperbolic volume", "Jones polynomial"],
};
const TOPIC_ENTRY = { concordance: "Slice knot", khovanov: "Khovanov homology", floer: "Floer homology", quantum: "Jones polynomial",
  volume: "Volume conjecture", hyperbolic: "Hyperbolic link", surgery: "Dehn surgery", unknotting: "Unknotting number",
  classical: "Alexander polynomial", diagrams: "Crossing number (knot theory)", braids: "Braid group", vassiliev: "Finite type invariant",
  algorithms: "Unknotting problem" };
const conceptOf = d => d.kind === "article" ? d.title : TOPIC_ENTRY[d.topics[0]];
function ancestors(c, out = [], seen = new Set()) {
  if (seen.has(c)) return out; seen.add(c);
  (PREREQ[c] || []).forEach(p => ancestors(p, out, seen)); out.push(c); return out;
}
const introPaper = (t, not) => DOCS.find(x => x.kind === "paper" && x.topics.includes(t) && x.id !== not && /introduc|survey|overview|lecture|primer/i.test(x.title));
function pathTo(targets) {
  const items = [], seen = new Set(), add = id => { if (DOC[id] && !seen.has(id)) { seen.add(id); items.push(id); } };
  targets.forEach(tid => {
    const d = DOC[tid]; if (!d) return;
    const c = conceptOf(d); if (c) ancestors(c).forEach(x => add("wiki:" + x));
    if (d.kind === "paper") { const ip = introPaper(d.topics[0], tid); if (ip) add(ip.id); }
    add(tid);
  });
  return items;
}
const PLAYLISTS = [
  { id: "zero", title: "Knot theory from zero", sub: "No background needed", targets: ["wiki:Tait conjectures"] },
  { id: "invariants", title: "Polynomial invariants", sub: "Alexander, Jones, HOMFLY", targets: ["wiki:Alexander polynomial", "wiki:Kauffman polynomial"] },
  { id: "khovanov", title: "Road to Khovanov homology", sub: "From diagrams to homology", targets: ["arxiv:1107.1524"] },
  { id: "slice", title: "Road to the slice–ribbon conjecture", sub: "Into 4 dimensions", targets: ["wiki:Ribbon knot", "wiki:Conway knot", "wiki:Link concordance"] },
  { id: "floer", title: "Road to knot Floer homology", sub: "Floer theory for knots", targets: ["arxiv:1401.7107", "arxiv:1706.07729"] },
  { id: "volume", title: "Road to the volume conjecture", sub: "Quantum meets hyperbolic", targets: ["arxiv:1002.0126"] },
  { id: "hyperbolic", title: "Hyperbolic knots", sub: "Geometry of knot complements", targets: ["wiki:Figure-eight knot (mathematics)", "arxiv:1708.07201"] },
  { id: "surgery", title: "Dehn surgery & lens spaces", sub: "Building 3-manifolds from knots", targets: ["wiki:Berge knot"] },
];
const isDone = id => (profile.time[id] || 0) >= 60;
function topInterest() {
  const tt = {};
  Object.keys(profile.time).forEach(k => { if (FV[k]) Object.keys(FV[k]).filter(f => f.startsWith("t:")).forEach(f => tt[f.slice(2)] = (tt[f.slice(2)] || 0) + profile.time[k]); });
  return Object.entries(tt).sort((a, b) => b[1] - a[1])[0]?.[0];
}
function getList(lid) {
  if (!lid) return null;
  if (lid.startsWith("path:")) {
    const d = DOC[lid.slice(5)]; if (!d) return null;
    return { id: lid, title: `From basics to “${d.title}”`, sub: "Built for this document", items: pathTo([d.id]) };
  }
  if (lid === "foryou") {
    const t = topInterest(); if (!t) return null;
    const ip = introPaper(t);
    return { id: lid, title: `Your path: ${TOPIC[t].label}`, sub: "Built from what you read", items: pathTo([ip ? ip.id : "wiki:" + TOPIC_ENTRY[t]]) };
  }
  const p = PLAYLISTS.find(x => x.id === lid); if (!p) return null;
  return { ...p, items: pathTo(p.targets) };
}
const nextUndone = l => l.items.find(id => !isDone(id)) || l.items[0];
const listHref = (id, lid) => `#/watch/${encodeURIComponent(id)}?list=${encodeURIComponent(lid)}`;
function listCard(l) {
  const done = l.items.filter(isDone).length, mins = l.items.reduce((s, id) => s + readMin(DOC[id]), 0);
  const first = DOC[nextUndone(l)], goal = DOC[l.items[l.items.length - 1]];
  return `<a class="lcard" href="${listHref(first.id, l.id)}">
    <div class="lthumb">${thumb(goal, false)}<div class="lcount"><b>${l.items.length}</b><span>steps</span><span>${dur(mins)}</span></div></div>
    <div class="c-title">${esc(l.title)}</div>
    <div class="c-meta">${esc(l.sub)}${done ? ` · ${done}/${l.items.length} done` : ""}</div></a>`;
}

// ================= HOME =================
let topic = null, query = "";
function renderChips() {
  $("#chips").innerHTML = `<button class="chip ${!topic ? "on" : ""}" data-topic="">All</button>` +
    TOPICS.map(t => `<button class="chip ${topic === t.id ? "on" : ""}" data-topic="${t.id}">${esc(t.label)}</button>`).join("");
}
function renderHome() {
  renderChips();
  const showShelf = !topic && !query;
  const lists = [getList("foryou"), ...PLAYLISTS.map(p => getList(p.id))].filter(Boolean);
  const recs = recommend(60, { topic, q: query });
  $("#grid").innerHTML = recs.map(r => card(r)).join("") || `<div class="empty">No results</div>`;
  if (showShelf) {
    const row = document.createElement("div");
    row.id = "shelf";
    row.innerHTML = `<div class="shelf-head"><h2>Learning paths</h2><span>Start from the basics and build up, one step at a time</span></div>
      <div class="shelf-wrap"><button class="sh-arrow l" aria-label="Scroll left">‹</button><div class="shelf">${lists.map(listCard).join("")}</div><button class="sh-arrow r" aria-label="Scroll right">›</button></div>`;
    $("#grid").appendChild(row);
    placeShelf();
    const sh = row.querySelector(".shelf"), upd = () => {
      row.querySelector(".l").hidden = sh.scrollLeft < 8;
      row.querySelector(".r").hidden = sh.scrollLeft + sh.clientWidth > sh.scrollWidth - 8;
    };
    row.querySelector(".l").onclick = () => sh.scrollBy({ left: -sh.clientWidth * .8, behavior: "smooth" });
    row.querySelector(".r").onclick = () => sh.scrollBy({ left: sh.clientWidth * .8, behavior: "smooth" });
    sh.addEventListener("scroll", upd, { passive: true }); upd();
  }
}
// Learning paths sit after the first two rows of cards, whatever the column count.
function placeShelf() {
  const grid = $("#grid"), row = $("#shelf"); if (!row) return;
  const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1;
  const cards = [...grid.querySelectorAll(":scope > .card")];
  const before = cards[cols * 2];
  if (before) grid.insertBefore(row, before); else grid.appendChild(row);
}
let rsT; addEventListener("resize", () => { clearTimeout(rsT); rsT = setTimeout(() => { if (view === "home") placeShelf(); }, 150); });

// ================= WATCH =================
let watching = null, lastAct = Date.now(), lastUpKey = "", curList = null;
function renderListPanel() {
  const l = curList, box = $("#lpanel");
  if (!l) { box.innerHTML = ""; return; }
  const i = l.items.indexOf(watching);
  box.innerHTML = `<div class="lp-head"><div class="lp-title">${esc(l.title)}</div><div class="c-meta">Step ${i + 1} of ${l.items.length} · ${l.items.filter(isDone).length} done</div></div>
    <div class="lp-items">${l.items.map((id, k) => { const d = DOC[id]; return `<a class="lp-item${id === watching ? " cur" : ""}" href="${listHref(id, l.id)}">
      <span class="lp-n">${id === watching ? "▶" : isDone(id) ? "✓" : k + 1}</span>${thumb(d, false)}
      <div style="min-width:0"><div class="c-title">${esc(d.title)}</div><div class="c-meta">${d.kind === "article" ? "Concept" : "Paper"} · ${lenShort(d)}</div></div></a>`; }).join("")}</div>`;
  const cur = box.querySelector(".cur"); if (cur) cur.parentNode.scrollTop = cur.offsetTop - cur.parentNode.offsetTop - 60;
}
function renderWatch(id, lid) {
  const d = DOC[id]; if (!d) return go("#/");
  watching = id;
  curList = getList(lid);
  if (curList && !curList.items.includes(id)) curList = null;
  $(".player").classList.toggle("article", d.kind === "article");
  if (d.kind === "paper") {
    const src = d.embed + "#navpanes=0&view=FitH";
    if ($("#player").dataset.src !== src) { $("#player").src = src; $("#player").dataset.src = src; }
  } else loadArticle(d);
  $("#w-title").textContent = d.title;
  $("#w-meta").textContent = `${d.kind === "article" ? "Wikipedia" : d.authors.join(", ")} · ${d.year} · ${lenLong(d) || d.topics.map(t => TOPIC[t].label).join(", ")}`;
  $("#w-src").innerHTML = d.kind === "paper"
    ? `© the authors · <a href="${esc(d.url)}" target="_blank" rel="noopener">arXiv:${esc(d.id.slice(6))}</a> · shown from arXiv.org`
    : `Text from <a href="${esc(d.url)}" target="_blank" rel="noopener">Wikipedia</a> · CC BY-SA 4.0`;
  $("#w-open").href = d.url;
  // next step / start-from-basics
  const pth = pathTo([id]);
  if (curList) {
    const nx = curList.items[curList.items.indexOf(id) + 1];
    $("#w-path").innerHTML = nx ? `Next step: ${esc(DOC[nx].title)} →` : "Path complete ✓";
    $("#w-path").href = nx ? listHref(nx, curList.id) : "#/";
    $("#w-path").hidden = false;
  } else if (pth.length > 1) {
    $("#w-path").textContent = `Start from basics (${pth.length} steps)`;
    $("#w-path").href = listHref(pth.find(x => !isDone(x)) || pth[0], "path:" + id);
    $("#w-path").hidden = false;
  } else $("#w-path").hidden = true;
  renderListPanel();
  $("#w-abs").textContent = d.abstract;
  $("#w-desc").open = false;
  const probs = OPEN.filter(n => d.topics.some(t => nodeTopics(n).includes(t)));
  $("#w-problems").innerHTML = probs.length ? `<div class="related"><b>Open problems here</b>${probs.map(n => `<a class="chip" href="#/map/${n.id}">${esc(n.title)}</a>`).join("")}</div>` : "";
  profile.last[id] = Date.now(); save();
  lastUpKey = ""; renderUpNext();
}
// Wikipedia articles are rendered natively from the REST API (CORS-enabled), sanitised.
const WIKI_BY_TITLE = Object.fromEntries(DOCS.filter(d => d.kind === "article").map(d => [d.title.replace(/ /g, "_"), d.id]));
const artCache = {};
async function loadArticle(d) {
  const box = $("#reader");
  if (box.dataset.id === d.id) return;
  box.dataset.id = d.id; box.innerHTML = `<p style="color:var(--muted)">Loading…</p>`; box.scrollTop = 0;
  try {
    const title = d.url.split("/wiki/")[1];
    const html = artCache[d.id] ||= await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${title}`)).text();
    if (box.dataset.id !== d.id) return;
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll(`script,style,link,meta,noscript,iframe,object,embed,form,table,.infobox,.navbox,.sidebar,.hatnote,.ambox,
      .metadata,.noprint,.mw-ref,sup.reference,.reflist,.mw-references-wrap,ol.references,.mw-editsection,.mw-empty-elt,
      [role=navigation],.gallery,.shortdescription,.thumbcaption .magnify,img.mwe-math-fallback-image-inline,
      img.mwe-math-fallback-image-display`).forEach(e => e.remove());
    // formulas: keep the native MathML (all modern browsers render it), drop the image fallback
    doc.querySelectorAll(".mwe-math-mathml-a11y").forEach(m => { m.removeAttribute("style"); m.classList.remove("mwe-math-mathml-a11y"); });
    doc.querySelectorAll("*").forEach(el => [...el.attributes].forEach(a => {
      if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
    }));
    doc.querySelectorAll("a[href]").forEach(a => {
      const h = a.getAttribute("href");
      const m = h.match(/^\.\/([^#?]+)/);
      if (m && WIKI_BY_TITLE[decodeURIComponent(m[1])]) a.setAttribute("href", "#/watch/" + encodeURIComponent(WIKI_BY_TITLE[decodeURIComponent(m[1])]));
      else { a.href = m ? "https://en.wikipedia.org/wiki/" + m[1] : new URL(h, "https://en.wikipedia.org/wiki/").href; a.target = "_blank"; a.rel = "noopener"; }
    });
    doc.querySelectorAll("img[src^='//'],img[srcset]").forEach(i => { if (i.getAttribute("src")?.startsWith("//")) i.src = "https:" + i.getAttribute("src"); i.removeAttribute("srcset"); });
    // Lesson format: core idea (lead paragraphs + one picture), then collapsible sections to go deeper.
    const wc = el => (el.textContent.match(/\S+/g) || []).length;
    const mins = n => Math.max(1, Math.round(n / 200));
    const SKIP = /^(references|notes|see also|external links|further reading|bibliography|sources|citations|footnotes|literature|gallery)/i;
    const secs = [...doc.body.querySelectorAll(":scope > section")];
    const lead = secs.length ? secs.shift() : doc.body;
    const figEl = doc.querySelector("figure img")?.closest("figure");
    const fig = figEl ? figEl.innerHTML : ""; if (figEl) figEl.remove();
    const leadPs = [...lead.querySelectorAll("p")].filter(p => p.textContent.trim().length > 40).slice(0, 4);
    const parts = secs.map(s => {
      const h = s.querySelector(":scope > h2, :scope > .mw-heading > h2"); if (!h) return null;
      const title = h.textContent.trim(); if (SKIP.test(title)) return null;
      (h.closest(".mw-heading") || h).remove();
      return s.textContent.trim().length > 60 ? { title, s } : null;
    }).filter(Boolean);
    const leadW = leadPs.reduce((a, p) => a + wc(p), 0);
    box.innerHTML = `<h1>${esc(d.title)}</h1>
      <div class="lesson-meta">Core idea · ${mins(leadW)} min read${parts.length ? ` · ${parts.length} sections to go deeper` : ""}</div>
      ${fig ? `<figure class="lead-fig">${fig}</figure>` : ""}
      <div class="lead">${leadPs.map(p => p.outerHTML).join("")}</div>
      ${parts.length ? `<div class="deeper">Go deeper</div>` + parts.map(p =>
        `<details class="wsec"><summary><span>${esc(p.title)}</span><small>${mins(wc(p.s))} min</small></summary><div class="wsec-body">${p.s.innerHTML}</div></details>`).join("") : ""}
      <p class="wfoot">Shortened from Wikipedia · CC BY-SA 4.0 · <a href="${esc(d.url)}" target="_blank" rel="noopener">Read the full article ↗</a></p>`;
  } catch (e) {
    box.innerHTML = `<p>Couldn't load this article. <a href="${esc(d.url)}" target="_blank" rel="noopener">Open on Wikipedia ↗</a></p>`;
  }
}
$("#reader").addEventListener("scroll", () => lastAct = Date.now(), { passive: true });

function renderUpNext() {
  if (!watching) return;
  const recs = recommend(20, { exclude: watching });
  const key = recs.map(r => r.id).join();
  if (key === lastUpKey) return;
  lastUpKey = key;
  $("#upnext").innerHTML = recs.map(r => mini(r)).join("");
}

// ================= DWELL CLOCK =================
["mousemove", "keydown", "wheel", "scroll", "touchstart"].forEach(e => addEventListener(e, () => lastAct = Date.now(), { passive: true, capture: true }));
let panelNode = null, secs = 0;
setInterval(() => {
  const iframeFocus = document.activeElement && document.activeElement.tagName === "IFRAME";
  const active = !document.hidden && (iframeFocus || Date.now() - lastAct < 60000);
  const key = view === "watch" && watching ? watching : view === "map" && panelNode ? "node:" + panelNode : null;
  if (!key || !active) return;
  profile.time[key] = (profile.time[key] || 0) + 1;
  profile.last[key] = Date.now();
  if (++secs % 5 === 0) { save(); if (view === "watch") renderUpNext(); }
}, 1000);

// ================= DIFFICULTY =================
const weights = { age: .20, attention: .30, depth: .15, resistance: .25, experiment: .20 };
const WL = { age: "Years open", attention: "Expert attention", depth: "Prerequisite depth", resistance: "Lack of progress", experiment: "Computer-testable (−)" };
const nbrs = {}; NODES.forEach(n => nbrs[n.id] = new Set());
NODES.forEach(n => n.builds.forEach(b => { if (NODE[b]) { nbrs[n.id].add(b); nbrs[b].add(n.id); } }));
function ancestry(id, seen = new Set()) { NODE[id].builds.forEach(b => { if (NODE[b] && !seen.has(b)) { seen.add(b); ancestry(b, seen); } }); return seen; }
const depthRaw = Object.fromEntries(OPEN.map(n => { const a = ancestry(n.id); return [n.id, a.size + new Set([...a].map(x => NODE[x].area)).size]; }));
const maxDepth = Math.max(...Object.values(depthRaw));
const factors = n => ({ age: Math.min(1, Math.log(1 + NOW_YEAR - n.year) / Math.log(71)), attention: n.diff.attention / 5,
  depth: depthRaw[n.id] / maxDepth, resistance: 1 - n.diff.progress, experiment: n.diff.computational });
function difficulty(n) {
  const f = factors(n), pos = weights.age + weights.attention + weights.depth + weights.resistance || 1;
  return Math.round(100 * Math.max(0, Math.min(1, (weights.age*f.age + weights.attention*f.attention + weights.depth*f.depth + weights.resistance*f.resistance - weights.experiment*f.experiment) / pos)));
}
const TIERS = [[35, "Good first project"], [55, "Graduate"], [72, "Frontier"], [101, "Legendary"]];
const tier = s => TIERS.find(t => s < t[0])[1];

function renderProblems() {
  $("#weights").innerHTML = Object.keys(weights).map(k => `<div class="weight"><span>${WL[k]}</span><input type="range" min="0" max=".6" step=".05" value="${weights[k]}" data-w="${k}"><span>${weights[k].toFixed(2)}</span></div>`).join("");
  $("#formula").textContent = `score = 100 × (Σ wᵢ·factorᵢ − w·computer-testable) / Σ wᵢ — inputs are editorial estimates from the cited literature`;
  document.querySelectorAll("[data-w]").forEach(i => i.oninput = () => { weights[i.dataset.w] = +i.value; i.nextElementSibling.textContent = (+i.value).toFixed(2); listProblems(); sizeNodes(); });
  listProblems();
}
function listProblems() {
  $("#plist").innerHTML = OPEN.map(n => ({ n, s: difficulty(n) })).sort((a, b) => b.s - a.s).map(({ n, s }, i) =>
    `<li class="prow" data-node="${n.id}"><span class="n">${i + 1}</span><div><div class="t">${esc(n.title)}</div><div class="a">${esc(AREA[n.area].name)} · ${tier(s)}</div></div>
     <div class="track"><i style="width:${s}%"></i></div><b>${s}</b></li>`).join("");
}

// ================= MAP =================
const W = 1500, H = 960;
const svg = d3.select("#map").attr("viewBox", `-40 -40 ${W + 80} ${H + 80}`);
const root = svg.append("g");
const zoom = d3.zoom().scaleExtent([.4, 4]).on("zoom", e => root.attr("transform", e.transform));
svg.call(zoom).on("click", () => closePanel());
const nodes = NODES.map(n => ({ ...n, x: AREA[n.area].x + (hash(n.id) % 60 - 30), y: AREA[n.area].y + (hash(n.id + "y") % 60 - 30) }));
const nIdx = Object.fromEntries(nodes.map(n => [n.id, n]));
const links = []; nodes.forEach(n => n.builds.forEach(b => nIdx[b] && links.push({ source: n.id, target: b })));
const radius = n => n.type === "open" ? 6 + difficulty(n) / 9 : 5;
d3.forceSimulation(nodes)
  .force("x", d3.forceX(d => AREA[d.area].x).strength(.22)).force("y", d3.forceY(d => AREA[d.area].y).strength(.22))
  .force("link", d3.forceLink(links).id(d => d.id).distance(80).strength(.04))
  .force("charge", d3.forceManyBody().strength(-120)).force("collide", d3.forceCollide(d => radius(d) + 26)).stop().tick(400);
root.append("g").selectAll("text").data(AREAS).join("text").attr("class", "area-label")
  .attr("x", a => d3.mean(nodes.filter(n => n.area === a.id), n => n.x)).attr("y", a => d3.min(nodes.filter(n => n.area === a.id), n => n.y) - 28).text(a => a.name);
const linkSel = root.append("g").selectAll("line").data(links).join("line").attr("class", "link")
  .attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
const nodeSel = root.append("g").selectAll("g").data(nodes).join("g").attr("class", d => "node " + d.type)
  .attr("transform", d => `translate(${d.x},${d.y})`).on("click", (e, d) => { e.stopPropagation(); go("#/map/" + d.id); });
nodeSel.append("circle").attr("class", "core").attr("fill", d => d.type === "known" ? TCOLOR[nodeTopics(d)[0]] : null);
nodeSel.append("text").attr("text-anchor", "middle").text(d => d.title.length > 30 ? d.title.slice(0, 28) + "…" : d.title);
function sizeNodes() { nodeSel.select(".core").attr("r", radius); nodeSel.select("text").attr("y", d => radius(d) + 14); }
sizeNodes();

function focusNode(id) {
  const n = nIdx[id], el = svg.node(), box = el.getBoundingClientRect(); if (!n || !box.width) return;
  const vb = el.viewBox.baseVal, s = Math.min(box.width / vb.width, box.height / vb.height), k = 1.5;
  const tx = (box.width / 2 - (box.width - vb.width * s) / 2) / s + vb.x - n.x * k;
  const ty = (box.height / 2 - (box.height - vb.height * s) / 2) / s + vb.y - n.y * k;
  svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
}
function highlight() {
  nodeSel.classed("sel", d => d.id === panelNode).classed("dim", d => panelNode && d.id !== panelNode && !nbrs[panelNode].has(d.id));
  linkSel.classed("hi", d => panelNode && (d.source.id === panelNode || d.target.id === panelNode));
}
function openPanel(id) {
  const n = NODE[id]; if (!n) return;
  panelNode = id; profile.last["node:" + id] = Date.now();
  const docs = DOCS.filter(d => d.topics.some(t => nodeTopics(n).includes(t)))
    .sort((a, b) => dot(FV["node:" + id], FV[b.id]) - dot(FV["node:" + id], FV[a.id])).slice(0, 4);
  let h = `<div class="status">${n.type === "open" ? `Open since ${n.yearNote || n.year}` : `Proved ${n.year}`} · ${esc(AREA[n.area].name)}</div>
    <div class="p-title">${esc(n.title)}</div><p class="stmt">${esc(n.type === "open" ? n.statement : n.summary)}</p>`;
  if (n.type === "open") {
    const s = difficulty(n);
    h += `<div class="score"><b>${s}</b><span>/ 100 · ${tier(s)}</span></div>
      <details><summary>First steps</summary><ol>${n.entry.map(e => `<li>${esc(e)}</li>`).join("")}</ol></details>`;
  }
  if (n.builds.length) h += `<div class="sec">Builds on</div>${n.builds.map(b => `<a class="chip" href="#/map/${b}">${esc(NODE[b].title)}</a>`).join("")}`;
  h += `<div class="sec">Read</div><div class="list">${docs.map(d => mini({ id: d.id })).join("")}</div>`;
  $("#panel-body").innerHTML = h;
  $("#panel").classList.add("on");
  highlight(); setTimeout(() => focusNode(id), 220);
}
function closePanel() { if (view === "map" && panelNode) go("#/map"); }
$("#panel-x").onclick = closePanel;

// ================= HISTORY =================
function renderHistory() {
  const tt = {}; TOPICS.forEach(t => tt[t.id] = 0);
  Object.keys(profile.time).forEach(k => { if (FV[k]) Object.keys(FV[k]).filter(f => f.startsWith("t:")).forEach(f => tt[f.slice(2)] += profile.time[k]); });
  const total = Object.values(profile.time).reduce((a, b) => a + b, 0);
  const nDocs = Object.keys(profile.time).filter(k => DOC[k]).length;
  $("#total").innerHTML = total ? `${fmt(total)}<small>total reading time across ${nDocs} document${nDocs === 1 ? "" : "s"}</small>` : "";
  const top = Object.entries(tt).filter(e => e[1]).sort((a, b) => b[1] - a[1]).slice(0, 6), mx = top[0]?.[1] || 1;
  $("#topics-bars").innerHTML = top.map(([t, s]) => `<div class="tb"><span>${esc(TOPIC[t].label)}</span><div class="track"><i style="width:${100*s/mx}%"></i></div><span>${fmt(s)}</span></div>`).join("");
  const seen = Object.keys(profile.time).filter(k => DOC[k]).sort((a, b) => (profile.last[b] || 0) - (profile.last[a] || 0));
  $("#hgrid").innerHTML = seen.map(id => card({ id })).join("") || `<div class="empty">Nothing yet. Time spent reading builds your recommendations.</div>`;
}
$("#clear").onclick = () => { profile = { time: {}, last: {} }; save(); renderHistory(); };

// ================= ROUTER =================
let view = "home";
function go(h) { if (location.hash !== h) location.hash = h; else route(); }
function route() {
  const [hpath, qs = ""] = (location.hash || "#/").split("?");
  const [, v = "", arg] = hpath.split("/");
  const id = arg ? decodeURIComponent(hpath.split("/").slice(2).join("/")) : null;
  const lid = new URLSearchParams(qs).get("list");
  view = v === "" ? "home" : v;
  if (!["home", "watch", "map", "problems", "history"].includes(view)) view = "home";
  document.querySelectorAll(".view").forEach(s => s.classList.toggle("on", s.id === "v-" + view));
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === view));
  if (view !== "watch") { watching = null; }
  if (view === "home") renderHome();
  if (view === "watch") { renderWatch(id, lid); scrollTo(0, 0); }
  if (view === "problems") renderProblems();
  if (view === "history") renderHistory();
  if (view === "map") { if (id) openPanel(id); else { panelNode = null; $("#panel").classList.remove("on"); highlight(); } }
}
addEventListener("hashchange", route);

document.addEventListener("click", e => {
  const d = e.target.closest("[data-doc]"); if (d) { go("#/watch/" + encodeURIComponent(d.dataset.doc)); return; }
  const n = e.target.closest("[data-node]"); if (n) { go("#/map/" + n.dataset.node); return; }
  const t = e.target.closest("[data-topic]"); if (t) { topic = t.dataset.topic || null; renderHome(); scrollTo(0, 0); }
});
$("#search-form").onsubmit = e => { e.preventDefault(); query = $("#search").value.trim(); topic = null; go("#/"); renderHome(); };
$("#search").addEventListener("input", e => { if (!e.target.value) { query = ""; if (view === "home") renderHome(); } });

route();
})();
