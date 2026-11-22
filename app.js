(() => {
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmt = s => s < 60 ? t("{n}s", { n: Math.round(s) }) : s < 3600 ? t("{n}m", { n: Math.floor(s/60) }) : t("{n}h", { n: (s/3600).toFixed(1) });
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
const label = k => k.startsWith("node:") ? NODE[k.slice(5)].title : dt(DOC[k]);

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
    return { id: d.id, s, why: best ? t("Because you read {x}", { x: label(best) }) : "" };
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
    if (ex) out.splice(3, 0, { id: ex.id, why: t("New to you: {x}", { x: cold.label }) });
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
const dur = mins => mins >= 60 ? t("{h}h {m}m", { h: Math.floor(mins / 60), m: String(mins % 60).padStart(2, "0") }) : t("{n} min", { n: mins });
function lenShort(d) { const m = METAS[d.id] || {}; return m.pages ? t("{n} pp", { n: m.pages }) : m.words ? dur(readMin(d)) : (d.kind === "paper" ? "PDF" : "WIKI"); }
function lenLong(d) {
  const m = METAS[d.id] || {}; if (!m.pages && !m.words) return "";
  return `${m.pages ? t("{n} pages", { n: m.pages }) : t("{n} words", { n: m.words.toLocaleString() })} · ${t("~{d} read", { d: dur(readMin(d)) })}`;
}
function thumb(d, hover = true) {
  let src = THUMB[d.id] || d.thumb || borrowed(d);
  if (src && !/^(https?:)?\//.test(src)) src = "/" + src;
  return `<div class="thumb">${src ? `<img loading="lazy" src="${esc(src)}" alt="">` : knotSVG(d.id, TCOLOR[d.topics[0]] || "#555")}
    <span class="badge">${lenShort(d)}</span>
    ${hover ? `<div class="hov"><div class="hov-len">${d.kind === "paper" ? t("Paper") : t("Wikipedia")}${lenLong(d) ? " · " + lenLong(d) : ""}</div><p>${esc(d.abstract)}</p></div>` : ""}</div>`;
}
const byline = d => d.kind === "article" ? t("Wikipedia") : d.authors[0].split(" ").pop() + (d.authors.length > 1 ? t(" et al.") : "");
function card(r) {
  const d = DOC[r.id], col = TCOLOR[d.topics[0]];
  return `<div class="card" data-doc="${esc(d.id)}" title="${esc(r.why || dt(d))}">${thumb(d)}
    <div class="c-body"><div class="avatar" style="background:${col}">${esc(TOPIC[d.topics[0]].label[0])}</div><div style="min-width:0">
    <div class="c-title">${esc(dt(d))}</div><div class="c-meta">${esc(byline(d))} · ${esc(TOPIC[d.topics[0]].label)} · ${d.year}</div>
    ${r.why ? `<div class="c-why">${esc(r.why)}</div>` : ""}</div></div></div>`;
}
function mini(r) {
  const d = DOC[r.id];
  return `<div class="mini" data-doc="${esc(d.id)}">${thumb(d)}<div style="min-width:0">
    <div class="c-title">${esc(dt(d))}</div><div class="c-meta">${esc(byline(d))} · ${d.year}</div>
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
    return { id: lid, title: t("From basics to “{x}”", { x: dt(d) }), sub: t("Built for this document"), items: pathTo([d.id]) };
  }
  if (lid === "foryou") {
    const tp = topInterest(); if (!tp) return null;
    const ip = introPaper(tp);
    return { id: lid, title: t("Your path: {x}", { x: TOPIC[tp].label }), sub: t("Built from what you read"), items: pathTo([ip ? ip.id : "wiki:" + TOPIC_ENTRY[tp]]) };
  }
  const p = PLAYLISTS.find(x => x.id === lid); if (!p) return null;
  return { ...p, title: t(p.title), sub: t(p.sub), items: pathTo(p.targets) };
}
const nextUndone = l => l.items.find(id => !isDone(id)) || l.items[0];
const listHref = (id, lid) => `/watch/${encodeURIComponent(id)}?list=${encodeURIComponent(lid)}`;
function listCard(l) {
  const done = l.items.filter(isDone).length, mins = l.items.reduce((s, id) => s + readMin(DOC[id]), 0);
  const first = DOC[nextUndone(l)], goal = DOC[l.items[l.items.length - 1]];
  return `<a class="lcard" href="${listHref(first.id, l.id)}">
    <div class="lthumb">${thumb(goal, false)}<div class="lcount"><b>${l.items.length}</b><span>${t("steps")}</span><span>${dur(mins)}</span></div></div>
    <div class="c-title">${esc(l.title)}</div>
    <div class="c-meta">${esc(l.sub)}${done ? ` · ${t("{d}/{n} done", { d: done, n: l.items.length })}` : ""}</div></a>`;
}

// ================= HOME =================
let topic = null, query = "";
function renderChips() {
  $("#chips").innerHTML = `<button class="chip ${!topic ? "on" : ""}" data-topic="">${t("All")}</button>` +
    TOPICS.map(t => `<button class="chip ${topic === t.id ? "on" : ""}" data-topic="${t.id}">${esc(t.label)}</button>`).join("");
}
function renderHome() {
  renderChips();
  const showShelf = !topic && !query;
  const lists = [getList("foryou"), ...PLAYLISTS.map(p => getList(p.id))].filter(Boolean);
  const recs = recommend(60, { topic, q: query });
  $("#grid").innerHTML = recs.map(r => card(r)).join("") || `<div class="empty">${t("No results")}</div>`;
  if (showShelf) {
    const row = document.createElement("div");
    row.id = "shelf";
    row.innerHTML = `<div class="shelf-head"><h2>${t("Learning paths")}</h2><span>${t("Start from the basics and build up, one step at a time")}</span></div>
      <div class="shelf-wrap"><button class="sh-arrow l" aria-label="${t("Scroll left")}">‹</button><div class="shelf">${lists.map(listCard).join("")}</div><button class="sh-arrow r" aria-label="${t("Scroll right")}">›</button></div>`;
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
  box.innerHTML = `<div class="lp-head"><div class="lp-title">${esc(l.title)}</div><div class="c-meta">${t("Step {i} of {n} · {d} done", { i: i + 1, n: l.items.length, d: l.items.filter(isDone).length })}</div></div>
    <div class="lp-items">${l.items.map((id, k) => { const d = DOC[id]; return `<a class="lp-item${id === watching ? " cur" : ""}" href="${listHref(id, l.id)}">
      <span class="lp-n">${id === watching ? "▶" : isDone(id) ? "✓" : k + 1}</span>${thumb(d, false)}
      <div style="min-width:0"><div class="c-title">${esc(dt(d))}</div><div class="c-meta">${d.kind === "article" ? t("Concept") : t("Paper")} · ${lenShort(d)}</div></div></a>`; }).join("")}</div>`;
  const cur = box.querySelector(".cur"); if (cur) cur.parentNode.scrollTop = cur.offsetTop - cur.parentNode.offsetTop - 60;
}
function renderWatch(id, lid) {
  const d = DOC[id]; if (!d) return go("/");
  watching = id;
  curList = getList(lid);
  if (curList && !curList.items.includes(id)) curList = null;
  $(".player").classList.toggle("article", d.kind === "article");
  if (d.kind === "paper") {
    const src = d.embed + "#navpanes=0&view=FitH";
    if ($("#player").dataset.src !== src) { $("#player").src = src; $("#player").dataset.src = src; }
  } else loadArticle(d);
  $("#w-title").textContent = dt(d);
  $("#w-meta").textContent = `${d.kind === "article" ? t("Wikipedia") : d.authors.join(", ")} · ${d.year} · ${lenLong(d) || d.topics.map(t => TOPIC[t].label).join(", ")}`;
  $("#w-src").innerHTML = d.kind === "paper"
    ? t("© the authors · {link} · shown from arXiv.org", { link: `<a href="${esc(d.url)}" target="_blank" rel="noopener">arXiv:${esc(d.id.slice(6))}</a>` })
    : t("Text from {link} · CC BY-SA 4.0", { link: `<a href="${esc(d.url)}" target="_blank" rel="noopener">${t("Wikipedia")}</a>` });
  $("#w-open").href = d.url;
  // next step / start-from-basics
  const pth = pathTo([id]);
  if (curList) {
    const nx = curList.items[curList.items.indexOf(id) + 1];
    $("#w-path").innerHTML = nx ? t("Next step: {x} →", { x: esc(dt(DOC[nx])) }) : t("Path complete ✓");
    $("#w-path").href = nx ? listHref(nx, curList.id) : "/";
    $("#w-path").hidden = false;
  } else if (pth.length > 1) {
    $("#w-path").textContent = t("Start from basics ({n} steps)", { n: pth.length });
    $("#w-path").href = listHref(pth.find(x => !isDone(x)) || pth[0], "path:" + id);
    $("#w-path").hidden = false;
  } else $("#w-path").hidden = true;
  renderListPanel();
  $("#w-abs").textContent = d.abstract;
  $("#w-desc").open = false;
  const probs = OPEN.filter(n => d.topics.some(t => nodeTopics(n).includes(t)));
  $("#w-problems").innerHTML = probs.length ? `<div class="related"><b>${t("Open problems here")}</b>${probs.map(n => `<a class="chip" href="/map/${n.id}">${esc(n.title)}</a>`).join("")}</div>` : "";
  profile.last[id] = Date.now(); save();
  lastUpKey = ""; renderUpNext();
}
// Wikipedia articles are rendered natively from the REST API (CORS-enabled), sanitised.
const WIKI_BY_TITLE = Object.fromEntries(DOCS.filter(d => d.kind === "article").map(d => [d.title.replace(/ /g, "_"), d.id]));
const artCache = {};
// In Korean mode, use the Korean Wikipedia article when one exists (found via interlanguage links).
const koTitles = {};
async function koTitleOf(en) {
  if (en in koTitles) return koTitles[en];
  try {
    const r = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=ko&redirects=1&format=json&origin=*&titles=${encodeURIComponent(en)}`)).json();
    const pg = Object.values(r.query.pages)[0];
    const kt = (pg.langlinks && pg.langlinks[0] && pg.langlinks[0]["*"]) || null;
    if (!kt) return koTitles[en] = null;
    // a Korean title that only redirects elsewhere (e.g. to a broader article) is not a real translation
    const k = await (await fetch(`https://ko.wikipedia.org/w/api.php?action=query&redirects=1&format=json&origin=*&titles=${encodeURIComponent(kt)}`)).json();
    return koTitles[en] = (k.query && k.query.redirects && k.query.redirects.length) ? null : kt;
  } catch (e) { return koTitles[en] = null; }
}
async function loadArticle(d, forceEn = false) {
  const box = $("#reader");
  const key = d.id + (forceEn ? "|en" : "");
  if (box.dataset.id === key) return;
  box.dataset.id = key; box.innerHTML = `<p style="color:var(--muted)">${t("Loading…")}</p>`; box.scrollTop = 0;
  try {
    let host = "en", title = d.url.split("/wiki/")[1], heading = dt(d), note = "";
    if (LANG === "ko") {
      const kt = await koTitleOf(d.title);
      if (box.dataset.id !== key) return;
      if (kt && !forceEn) { host = "ko"; title = encodeURIComponent(kt.replace(/ /g, "_")); heading = kt;
        note = ` · <span>${t("Korean Wikipedia")}</span> · <button type="button" class="linkbtn" data-wiki-lang="en">${t("Show English original")}</button>`; }
      else if (kt) note = ` · <button type="button" class="linkbtn" data-wiki-lang="ko">${t("Show in Korean")}</button>`;
      else note = ` · ${t("No Korean article yet, so this is the English original.")}`;
    }
    const base = `https://${host}.wikipedia.org/wiki/`;
    const ck = host + ":" + title;
    const html = artCache[ck] ||= await (await fetch(`https://${host}.wikipedia.org/api/rest_v1/page/html/${title}`)).text();
    if (box.dataset.id !== key) return;
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
      if (host === "en" && m && WIKI_BY_TITLE[decodeURIComponent(m[1])]) a.setAttribute("href", "/watch/" + encodeURIComponent(WIKI_BY_TITLE[decodeURIComponent(m[1])]));
      else { a.href = m ? base + m[1] : new URL(h, base).href; a.target = "_blank"; a.rel = "noopener"; }
    });
    doc.querySelectorAll("img[src^='//'],img[srcset]").forEach(i => { if (i.getAttribute("src")?.startsWith("//")) i.src = "https:" + i.getAttribute("src"); i.removeAttribute("srcset"); });
    // Lesson format: core idea (lead paragraphs + one picture), then collapsible sections to go deeper.
    const wc = el => (el.textContent.match(/\S+/g) || []).length;
    const mins = n => Math.max(1, Math.round(n / 200));
    const SKIP = /^(references|notes|see also|external links|further reading|bibliography|sources|citations|footnotes|literature|gallery|각주|참고 문헌|참고문헌|같이 보기|외부 링크|참고 자료|출처|더 읽을거리|읽을거리)/i;
    const secs = [...doc.body.querySelectorAll(":scope > section")];
    const lead = secs.length ? secs.shift() : doc.body;
    const figEl = doc.querySelector("figure img")?.closest("figure");
    const fig = figEl ? figEl.innerHTML : ""; if (figEl) figEl.remove();
    const leadPs = [...lead.querySelectorAll("p")].filter(p => p.textContent.trim().length > (host === "ko" ? 15 : 40)).slice(0, 4);
    const parts = secs.map(s => {
      const h = s.querySelector(":scope > h2, :scope > .mw-heading > h2"); if (!h) return null;
      const title = h.textContent.trim(); if (SKIP.test(title)) return null;
      (h.closest(".mw-heading") || h).remove();
      return s.textContent.trim().length > 60 ? { title, s } : null;
    }).filter(Boolean);
    const leadW = leadPs.reduce((a, p) => a + wc(p), 0);
    const pageUrl = base + title;
    box.innerHTML = `<h1>${esc(heading)}</h1>
      <div class="lesson-meta">${t("Core idea · {m} min read", { m: mins(leadW) })}${parts.length ? t(" · {n} sections to go deeper", { n: parts.length }) : ""}${note}</div>
      ${fig ? `<figure class="lead-fig">${fig}</figure>` : ""}
      <div class="lead">${leadPs.map(p => p.outerHTML).join("")}</div>
      ${parts.length ? `<div class="deeper">${t("Go deeper")}</div>` + parts.map(p =>
        `<details class="wsec"><summary><span>${esc(p.title)}</span><small>${t("{m} min", { m: mins(wc(p.s)) })}</small></summary><div class="wsec-body">${p.s.innerHTML}</div></details>`).join("") : ""}
      <p class="wfoot">${t("Shortened from Wikipedia · CC BY-SA 4.0 · ")}<a href="${esc(pageUrl)}" target="_blank" rel="noopener">${t("Read the full article ↗")}</a></p>`;
  } catch (e) {
    box.innerHTML = `<p>${t("Couldn't load this article.")} <a href="${esc(d.url)}" target="_blank" rel="noopener">${t("Open on Wikipedia ↗")}</a></p>`;
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
const WL = { age: t("Years open"), attention: t("Expert attention"), depth: t("Prerequisite depth"), resistance: t("Lack of progress"), experiment: t("Computer-testable (−)") };
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
const TIERS = [[35, t("Good first project")], [55, t("Graduate")], [72, t("Frontier")], [101, t("Legendary")]];
const tier = s => TIERS.find(t => s < t[0])[1];

function renderProblems() {
  $("#weights").innerHTML = Object.keys(weights).map(k => `<div class="weight"><span>${WL[k]}</span><input type="range" min="0" max=".6" step=".05" value="${weights[k]}" data-w="${k}"><span>${weights[k].toFixed(2)}</span></div>`).join("");
  $("#formula").textContent = t("FORMULA");
  document.querySelectorAll("[data-w]").forEach(i => i.oninput = () => { weights[i.dataset.w] = +i.value; i.nextElementSibling.textContent = (+i.value).toFixed(2); listProblems(); });
  listProblems();
}
function listProblems() {
  $("#plist").innerHTML = OPEN.map(n => ({ n, s: difficulty(n) })).sort((a, b) => b.s - a.s).map(({ n, s }, i) =>
    `<li class="prow" data-node="${n.id}"><span class="n">${i + 1}</span><div><div class="t">${esc(n.title)}</div><div class="a">${esc(AREA[n.area].name)} · ${tier(s)}</div></div>
     <div class="track"><i style="width:${s}%"></i></div><b>${s}</b></li>`).join("");
}

// ================= IDEA MAP =================
// Input: a problem idea in plain words (English or Korean).
// Output: a left-to-right map — Foundations → Known results → Open problems → Recent papers → Your idea —
// plus the closest open problem, the most related paper and a first question to try.
const KO2EN = [
  ["풀린 매듭", "unknot"], ["풀림수", "unknotting number"], ["풀림", "unknotting"], ["교차수", "crossing number"], ["교차", "crossing"],
  ["슬라이스", "slice"], ["리본", "ribbon"], ["콘코던스", "concordance"], ["다항식", "polynomial"], ["불변량", "invariant"],
  ["호몰로지", "homology"], ["쌍곡", "hyperbolic"], ["부피", "volume"], ["수술", "surgery"], ["렌즈", "lens space"], ["땋임", "braid"],
  ["꼬임군", "braid group"], ["알고리즘", "algorithm"], ["복잡도", "complexity"], ["컴퓨터", "computer computation"], ["계산", "computation"],
  ["종수", "genus"], ["존스", "jones"], ["알렉산더", "alexander"], ["호바노프", "khovanov"], ["플뢰어", "floer"], ["플로어", "floer"],
  ["교대", "alternating"], ["원환면", "torus"], ["토러스", "torus"], ["4차원", "4-dimensional slice"], ["다양체", "manifold"],
  ["기계학습", "machine learning"], ["머신러닝", "machine learning"], ["인공지능", "machine learning neural"], ["신경망", "neural network"],
  ["딥러닝", "deep learning neural"], ["그래프", "graph"], ["무작위", "random"], ["랜덤", "random"], ["확률", "random probability"],
  ["통계", "statistics"], ["자이페르트", "seifert"], ["곡면", "surface"], ["링크", "link"], ["연환", "link"], ["양자", "quantum"],
  ["바실리예프", "vassiliev"], ["유한형", "finite type"], ["검출", "detect detection"], ["알아낼", "detect"], ["구별", "distinguish detect"],
  ["분류", "classification"], ["가법", "additive"], ["연결합", "connected sum"], ["8자", "figure-eight"], ["세잎", "trefoil"],
  ["위성", "satellite"], ["소매듭", "prime knot"], ["색 존스", "colored jones"], ["기울기", "slope boundary"], ["코스메틱", "cosmetic"],
  ["베르주", "berge"], ["밀노어", "milnor"], ["라스무센", "rasmussen"], ["표현", "representation"], ["기하", "geometry"], ["위상", "topology"],
  ["원판", "disk slice"], ["단백질", "protein"], ["생물", "biology dna"], ["매듭", "knot"],
];
const SYN = { unknot: ["unknot", "unknotting"], ml: ["machine", "learning"], ai: ["machine", "learning", "neural"], "4d": ["4-dimensional", "slice", "concordance"],
  "3d": ["3-manifold"], hfk: ["floer"], dna: ["dna", "biology"], untangle: ["unknotting"], untie: ["unknotting"] };
const IDEA_STOP = new Set(("a an the of in on for to and or with is are be can could how what why which does do did i we you my our about from into " +
  "using use used new problem problems idea want study whether its it this that there their than then also more most some any all one two " +
  "find show prove knot knots theory mathematical mathematics").split(" "));
const stem = w => (w.length > 4 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) ? w.slice(0, -1) : w;
function ideaTokens(s) {
  let x = " " + String(s || "").toLowerCase() + " ";
  KO2EN.forEach(([ko, en]) => { if (x.includes(ko)) x += " " + en + " "; });
  const out = [];
  x.replace(/[^a-z0-9\-\s]/g, " ").split(/\s+/).forEach(w => {
    w = w.replace(/^-+|-+$/g, ""); if (!w) return;
    (SYN[w] || [w]).forEach(v => { if ((v.length > 2 || /\d/.test(v)) && !IDEA_STOP.has(v)) out.push(stem(v)); });
  });
  return out;
}
let IDX = null;
function buildIndex() {
  const items = [];
  DOCS.forEach(d => items.push({ key: d.id, text: [d.title, d.title, d.abstract, d.topics.join(" ")].join(" ") }));
  NODES.forEach(n => {
    const ti = n._en ? n._en.title : n.title, tx = n._en ? n._en.text : (n.statement || n.summary);
    items.push({ key: "node:" + n.id, text: [ti, ti, tx, n.tags.join(" "), n.tags.join(" "), nodeTopics(n).join(" ")].join(" ") });
  });
  const df = {};
  items.forEach(it => { it.tf = {}; ideaTokens(it.text).forEach(w => it.tf[w] = (it.tf[w] || 0) + 1); Object.keys(it.tf).forEach(w => df[w] = (df[w] || 0) + 1); });
  const N = items.length;
  items.forEach(it => {
    let nn = 0; it.v = {};
    for (const w in it.tf) { const v = (1 + Math.log(it.tf[w])) * Math.log(1 + N / df[w]); it.v[w] = v; nn += v * v; }
    it.n = Math.sqrt(nn) || 1;
  });
  IDX = { items, by: Object.fromEntries(items.map(it => [it.key, it])) };
}
function scoreIdea(q) {
  if (!IDX) buildIndex();
  const qt = [...new Set(ideaTokens(q))];
  const res = {};
  IDX.items.forEach(it => { let s = 0; qt.forEach(w => { if (it.v[w]) s += it.v[w]; }); res[it.key] = s / Math.sqrt(it.n); });
  return { res, qt };
}
const simKeys = (a, b) => { const A = IDX.by[a], B = IDX.by[b]; if (!A || !B) return 0; let s = 0; for (const w in A.v) if (B.v[w]) s += A.v[w] * B.v[w]; return s / (A.n * B.n); };

function buildIdeaMap(q) {
  const { res, qt } = scoreIdea(q);
  if (!qt.length) return null;
  const sc = k => res[k] || 0;
  const opens = OPEN.slice().sort((a, b) => sc("node:" + b.id) - sc("node:" + a.id)).filter(n => sc("node:" + n.id) > 0).slice(0, 3);
  const papers = DOCS.filter(d => d.kind === "paper" && sc(d.id) > 0)
    .sort((a, b) => (sc(b.id) + (b.year - 2000) * .004) - (sc(a.id) + (a.year - 2000) * .004)).slice(0, 5);
  if (!opens.length && !papers.length) return null;
  const knownSet = new Set();
  opens.forEach(n => n.builds.forEach(b => NODE[b] && NODE[b].type === "known" && knownSet.add(b)));
  NODES.filter(n => n.type === "known" && sc("node:" + n.id) > 0).sort((a, b) => sc("node:" + b.id) - sc("node:" + a.id)).forEach(n => knownSet.add(n.id));
  const known = [...knownSet].slice(0, 5);
  // foundations: the concept chain behind the dominant topic, plus directly matching concept articles
  const tcount = {};
  [...papers.map(d => d.topics[0]), ...opens.flatMap(nodeTopics), ...opens.flatMap(nodeTopics)].forEach(tp => tcount[tp] = (tcount[tp] || 0) + 1);
  const topTopic = Object.entries(tcount).sort((a, b) => b[1] - a[1])[0]?.[0];
  let chain = topTopic ? ancestors(TOPIC_ENTRY[topTopic]).map(c => "wiki:" + c).filter(id => DOC[id]) : [];
  DOCS.filter(d => d.kind === "article" && sc(d.id) > 0).sort((a, b) => sc(b.id) - sc(a.id)).slice(0, 2).forEach(d => { if (!chain.includes(d.id)) chain.push(d.id); });
  if (chain.length > 5) chain = [chain[0], ...chain.slice(-4)];
  const cols = [
    { key: "concept", title: t("Foundations"), items: chain.map(id => ({ key: id, id, kind: "concept" })) },
    { key: "known", title: t("Known results"), items: known.map(id => ({ key: "node:" + id, id, kind: "known" })) },
    { key: "open", title: t("Open problems"), items: opens.map(n => ({ key: "node:" + n.id, id: n.id, kind: "open" })) },
    { key: "paper", title: t("Recent papers"), items: papers.map(d => ({ key: d.id, id: d.id, kind: "paper" })) },
    { key: "idea", title: t("Your idea"), items: [{ key: "idea", kind: "idea", id: "idea" }] },
  ].filter(c => c.items.length);
  // edges: real "builds on" links where they exist, otherwise the closest item in the previous column
  const edges = [];
  for (let ci = 1; ci < cols.length; ci++) {
    const prev = cols[ci - 1].items, cur = cols[ci].items, linked = new Set();
    cur.forEach(it => {
      let srcs = [];
      if (it.kind === "idea") srcs = prev.slice(0, 3);
      else {
        if (it.kind === "open") srcs = prev.filter(p => p.kind === "known" && NODE[it.id].builds.includes(p.id));
        if (!srcs.length) srcs = [prev.slice().sort((a, b) => simKeys(b.key, it.key) - simKeys(a.key, it.key))[0]];
      }
      srcs.forEach(p => { edges.push([p.key, it.key]); linked.add(p.key); });
    });
    prev.forEach(p => {
      if (linked.has(p.key)) return;
      const tg = cur.slice().sort((a, b) => simKeys(p.key, b.key) - simKeys(p.key, a.key))[0];
      edges.push([p.key, tg.key]);
    });
  }
  return { cols, edges, opens, papers, chain };
}

function ideaNodeHTML(it) {
  if (it.kind === "idea") return `<div class="im-node idea" data-key="idea"><div class="im-k">${t("Your idea")}</div><div class="im-t">${esc(ideaQuery)}</div></div>`;
  if (it.kind === "concept" || it.kind === "paper") {
    const d = DOC[it.id];
    return `<a class="im-node ${it.kind}" data-key="${esc(it.key)}" href="/watch/${encodeURIComponent(d.id)}">
      <div class="im-k">${it.kind === "concept" ? t("Concept") : `${esc(byline(d))} · ${d.year}`}</div><div class="im-t">${esc(dt(d))}</div></a>`;
  }
  const n = NODE[it.id];
  const extra = it.kind === "open" ? `<span class="im-diff">${difficulty(n)}</span>` : "";
  return `<a class="im-node ${it.kind}" data-key="${esc(it.key)}" href="/map/${n.id}${location.search}">
    <div class="im-k">${it.kind === "open" ? t("Open problem") : t("Proved {y}", { y: n.year })}${extra}</div><div class="im-t">${esc(n.title)}</div></a>`;
}

let ideaQuery = "", ideaMap = null;
function renderIdea(q) {
  ideaQuery = q || "";
  $("#idea-input").value = ideaQuery;
  const out = $("#idea-out");
  if (!ideaQuery) { out.innerHTML = ""; ideaMap = null; $("#idea-empty").hidden = false; return; }
  $("#idea-empty").hidden = true;
  ideaMap = buildIdeaMap(ideaQuery);
  if (!ideaMap) { out.innerHTML = `<div class="empty">${t("No close matches yet. Try words like knot, polynomial, slice, surgery or unknotting.")}</div>`; return; }
  const { cols, opens, papers, chain } = ideaMap;
  const top = opens[0], paper = papers[0];
  const start = paper ? pathTo([paper.id]) : chain;
  const firstStep = start.find(x => !isDone(x)) || start[0];
  let cards = "";
  if (top) cards += `<a class="im-card" href="/map/${top.id}${location.search}"><div class="im-ck">${t("Closest open problem")}</div><div class="im-ct">${esc(top.title)}</div>
      <div class="im-cm">${t("Difficulty")} <b>${difficulty(top)}</b> · ${tier(difficulty(top))}</div></a>`;
  if (paper) cards += `<a class="im-card" href="/watch/${encodeURIComponent(paper.id)}"><div class="im-ck">${t("Most related paper")}</div><div class="im-ct">${esc(paper.title)}</div>
      <div class="im-cm">${esc(byline(paper))} · ${paper.year} · ${lenShort(paper)}</div></a>`;
  if (top && top.entry && top.entry[0]) cards += `<div class="im-card q"><div class="im-ck">${t("A question to start with")}</div><div class="im-ct sm">${esc(top.entry[0])}</div>
      ${firstStep && start.length > 1 ? `<a class="im-cm link" href="${listHref(firstStep, "path:" + (paper ? paper.id : start[start.length - 1]))}">${t("Start from basics ({n} steps)", { n: start.length })} →</a>` : ""}</div>`;
  out.innerHTML = `<div class="im-cards">${cards}</div>
    <div class="im-wrap"><div class="im-board" id="im-board" style="--cols:${cols.length}">
      <svg class="im-edges" id="im-edges"></svg>
      ${cols.map(c => `<div class="im-col" data-col="${c.key}"><div class="im-h">${c.title}</div>${c.items.map(ideaNodeHTML).join("")}</div>`).join("")}
    </div></div>`;
  requestAnimationFrame(drawIdeaEdges); setTimeout(drawIdeaEdges, 60);
  if (document.fonts) document.fonts.ready.then(drawIdeaEdges);
}
function drawIdeaEdges() {
  const board = $("#im-board"), svgEl = $("#im-edges"); if (!board || !ideaMap) return;
  const bb = board.getBoundingClientRect();
  svgEl.setAttribute("width", board.scrollWidth); svgEl.setAttribute("height", board.scrollHeight);
  const pos = {};
  board.querySelectorAll(".im-node").forEach(el => { const r = el.getBoundingClientRect(); pos[el.dataset.key] = { l: r.left - bb.left, r: r.right - bb.left, y: r.top - bb.top + r.height / 2 }; });
  svgEl.innerHTML = ideaMap.edges.filter(([a, b]) => pos[a] && pos[b]).map(([a, b]) => {
    const A = pos[a], B = pos[b], mx = (A.r + B.l) / 2;
    return `<path data-a="${esc(a)}" data-b="${esc(b)}" d="M${A.r},${A.y} C${mx},${A.y} ${mx},${B.y} ${B.l},${B.y}"/>`;
  }).join("");
}
addEventListener("resize", () => { if (view === "map") drawIdeaEdges(); });
document.addEventListener("mouseover", e => {
  const svgEl = $("#im-edges"); if (!svgEl || view !== "map") return;
  const el = e.target.closest(".im-node"), k = el ? el.dataset.key : null;
  const lit = new Set();
  svgEl.querySelectorAll("path").forEach(p => {
    const on = !!k && (p.dataset.a === k || p.dataset.b === k);
    p.classList.toggle("hi", on); if (on) { lit.add(p.dataset.a); lit.add(p.dataset.b); }
  });
  document.querySelectorAll(".im-node").forEach(n => n.classList.toggle("dim", !!k && !lit.has(n.dataset.key)));
});
$("#idea-form").onsubmit = e => { e.preventDefault(); const q = $("#idea-input").value.trim(); go("/map" + (q ? "?q=" + encodeURIComponent(q) : "")); };
$("#idea-input").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#idea-form").requestSubmit(); } });
function renderIdeaExamples() {
  const ex = LANG === "ko"
    ? ["머신러닝으로 매듭의 풀림수를 예측할 수 있을까?", "존스 다항식만으로 풀린 매듭을 알아낼 수 있을까?", "4차원에서 원판을 감싸는 매듭은 어떤 것일까?", "쌍곡 부피와 양자 불변량은 어떤 관계일까?"]
    : ["Can machine learning predict the unknotting number of a knot?", "Is the Jones polynomial enough to detect the unknot?", "Which knots bound a disk in 4 dimensions?", "How does hyperbolic volume relate to quantum invariants?"];
  $("#idea-ex").innerHTML = `<span>${t("Try:")}</span>` + ex.map(x => `<a class="chip" href="/map?q=${encodeURIComponent(x)}">${esc(x)}</a>`).join("");
}
renderIdeaExamples();

function openPanel(id) {
  const n = NODE[id]; if (!n) return;
  panelNode = id; profile.last["node:" + id] = Date.now();
  if (!IDX) buildIndex();
  const docs = DOCS.filter(d => d.topics.some(tp => nodeTopics(n).includes(tp)))
    .sort((a, b) => simKeys("node:" + id, b.id) - simKeys("node:" + id, a.id)).slice(0, 4);
  let h = `<div class="status">${n.type === "open" ? t("Open since {y}", { y: n.yearNote || n.year }) : t("Proved {y}", { y: n.year })} · ${esc(AREA[n.area].name)}</div>
    <div class="p-title">${esc(n.title)}</div><p class="stmt">${esc(n.type === "open" ? n.statement : n.summary)}</p>`;
  if (n.type === "open") {
    const s = difficulty(n);
    h += `<div class="score"><b>${s}</b><span>/ 100 · ${tier(s)}</span></div>
      <details open><summary>${t("First steps")}</summary><ol>${n.entry.map(e => `<li>${esc(e)}</li>`).join("")}</ol></details>`;
  }
  if (n.builds.length) h += `<div class="sec">${t("Builds on")}</div>${n.builds.map(b => `<a class="chip" href="/map/${b}${location.search}">${esc(NODE[b].title)}</a>`).join("")}`;
  h += `<div class="sec">${t("Read")}</div><div class="list">${docs.map(d => mini({ id: d.id })).join("")}</div>`;
  $("#panel-body").innerHTML = h;
  $("#panel").classList.add("on");
  document.querySelectorAll(".im-node").forEach(el => el.classList.toggle("sel", el.dataset.key === "node:" + id));
  setTimeout(drawIdeaEdges, 240);
}
function closePanel() { if (view === "map" && panelNode) go("/map" + location.search); }
$("#panel-x").onclick = closePanel;

// ================= HISTORY =================
function renderHistory() {
  const tt = {}; TOPICS.forEach(t => tt[t.id] = 0);
  Object.keys(profile.time).forEach(k => { if (FV[k]) Object.keys(FV[k]).filter(f => f.startsWith("t:")).forEach(f => tt[f.slice(2)] += profile.time[k]); });
  const total = Object.values(profile.time).reduce((a, b) => a + b, 0);
  const nDocs = Object.keys(profile.time).filter(k => DOC[k]).length;
  $("#total").innerHTML = total ? `${fmt(total)}<small>${t("total reading time across {n} documents", { n: nDocs })}</small>` : "";
  const top = Object.entries(tt).filter(e => e[1]).sort((a, b) => b[1] - a[1]).slice(0, 6), mx = top[0]?.[1] || 1;
  $("#topics-bars").innerHTML = top.map(([t, s]) => `<div class="tb"><span>${esc(TOPIC[t].label)}</span><div class="track"><i style="width:${100*s/mx}%"></i></div><span>${fmt(s)}</span></div>`).join("");
  const seen = Object.keys(profile.time).filter(k => DOC[k]).sort((a, b) => (profile.last[b] || 0) - (profile.last[a] || 0));
  $("#hgrid").innerHTML = seen.map(id => card({ id })).join("") || `<div class="empty">${t("Nothing yet. Time spent reading builds your recommendations.")}</div>`;
}
$("#clear").onclick = () => { profile = { time: {}, last: {} }; save(); renderHistory(); };

// ================= ROUTER =================
let view = "home";
function go(h) { if (location.pathname + location.search !== h) history.pushState(null, "", h); route(); }
// old "#/…" links keep working
if (location.hash.startsWith("#/")) history.replaceState(null, "", location.hash.slice(1));
function route() {
  const hpath = location.pathname, qs = location.search.slice(1);
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
  if (view === "map") {
    const q = new URLSearchParams(qs).get("q") || "";
    // opening a problem directly (from Problems or a chip) maps that problem when no idea was typed
    const want = q || (id && NODE[id] ? (NODE[id]._en ? NODE[id]._en.title : NODE[id].title) : "");
    if (want !== ideaQuery || (want && !ideaMap)) renderIdea(want);
    if (id) openPanel(id);
    else { panelNode = null; $("#panel").classList.remove("on"); document.querySelectorAll(".im-node.sel").forEach(el => el.classList.remove("sel"));  setTimeout(drawIdeaEdges, 240); }
  }
}
addEventListener("popstate", route);

// ================= SETTINGS =================
applyStaticI18n();
const settingsEl = $("#settings");
function openSettings() {
  document.querySelectorAll("[data-lang]").forEach(b => b.classList.toggle("on", b.dataset.lang === LANG));
  settingsEl.hidden = false;
}
$("#open-settings").onclick = openSettings;
$("#close-settings").onclick = () => settingsEl.hidden = true;
settingsEl.addEventListener("click", e => { if (e.target === settingsEl) settingsEl.hidden = true; });
addEventListener("keydown", e => { if (e.key === "Escape") settingsEl.hidden = true; });
document.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => {
  if (b.dataset.lang === LANG) { settingsEl.hidden = true; return; }
  try { localStorage.setItem("knotfound-lang", b.dataset.lang); } catch (e) {}
  location.reload();
});

document.addEventListener("click", e => {
  const wl = e.target.closest("[data-wiki-lang]");
  if (wl && watching) { loadArticle(DOC[watching], wl.dataset.wikiLang === "en"); return; }
  const a = e.target.closest("a[href^='/']");
  if (a && !a.target && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); go(a.getAttribute("href")); return; }
  const d = e.target.closest("[data-doc]"); if (d) { go("/watch/" + encodeURIComponent(d.dataset.doc)); return; }
  const n = e.target.closest("[data-node]"); if (n) { go("/map/" + n.dataset.node); return; }
  const t = e.target.closest("[data-topic]"); if (t) { topic = t.dataset.topic || null; renderHome(); scrollTo(0, 0); }
});
$("#search-form").onsubmit = e => { e.preventDefault(); query = $("#search").value.trim(); topic = null; go("/"); renderHome(); };
$("#search").addEventListener("input", e => { if (!e.target.value) { query = ""; if (view === "home") renderHome(); } });

route();
})();
