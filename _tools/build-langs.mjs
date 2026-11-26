// 언어별 페이지 만들기 — 검색 엔진이 언어마다 따로 읽도록 /ko/ · /ja/ … 아래에 글이 박힌 페이지를 굽는다.
// 원본은 루트의 index.html · buy.html · features/*.html(영어) 그대로다. 문구를 고친 뒤에는 이것을 다시 돌린다:
//   node _tools/build-langs.mjs
// (밑줄로 시작하는 폴더라 GitHub Pages(Jekyll)는 이 파일을 내보내지 않는다)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = "https://thebutters.app/butter-edit/";
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["i18n.js", "details.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx);
const T = ctx.window.BE_I18N, D = ctx.window.BE_DETAILS;
const LANGS = Object.keys(T);
const SLUGS = ["folder", "raw", "adjust", "ai", "shooting", "merge", "export", "more"];
const SHOTS = { folder: "01-browse", raw: "02-edit", adjust: "03-mask", ai: "04-erase" };
const ALT = { folder: 0, raw: 1, adjust: 2, ai: 3 };
const PAGES = ["index.html", "buy.html", ...SLUGS.map(s => `features/${s}.html`)];

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const urlOf = (lang, page) => SITE + (lang === "en" ? "" : lang + "/") + (page === "index.html" ? "" : page);

function alternates(page) {
  const l = LANGS.map(x => `<link rel="alternate" hreflang="${x}" href="${urlOf(x, page)}">`);
  l.push(`<link rel="alternate" hreflang="x-default" href="${urlOf("en", page)}">`);
  return l.join("\n");
}

// 원본 페이지의 상대 주소를 언어 폴더 안에서 맞게 고친다 — 언어별로 구운 페이지는 그대로, 나머지(그림 · css · js · 개인정보 등)는 한 칸 위로
function relink(html, page) {
  const dir = path.posix.dirname(page);
  return html.replace(/\b(href|src)="([^"]*)"/g, (m, attr, url) => {
    if (/^(https?:|mailto:|#|data:|\/)/.test(url) || url === "") return m;
    const [p] = url.split(/[?#]/);
    const target = path.posix.normalize(path.posix.join(dir, p));
    if (PAGES.includes(target)) return m;
    return `${attr}="../${url}"`;
  });
}

function setText(html, key, value) {
  // data-i가 붙은 칸 안의 글만 바꾼다(칸 안에 다른 태그가 없는 것만 — home.js와 같은 textContent)
  const re = new RegExp(`(<(\\w+)\\b[^>]*\\sdata-i="${key}"[^>]*>)([^<]*)(</\\2>)`, "g");
  return html.replace(re, (m, open, tag, _t, close) => open + esc(value) + close);
}

function groupsHTML(d, lang, page) {
  const href = s => (page.startsWith("features/") ? `${s}.html` : `features/${s}.html`);
  return d.groups.map((g, k) =>
    `<a class="group" href="${href(SLUGS[k])}"><h3>${esc(g.t)}</h3><ul>${g.i.map(t => `<li>${esc(t)}</li>`).join("")}</ul><span class="more-link">${esc(d.moreLink)} →</span></a>`).join("");
}

function build(lang, page) {
  const d = T[lang];
  let html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const group = page.startsWith("features/") ? path.posix.basename(page, ".html") : null;
  const det = group ? (D[lang] || D.en)[group] : null;
  const grp = group ? d.groups[SLUGS.indexOf(group)] : null;

  // 글 칸
  for (const key of new Set([...html.matchAll(/\sdata-i="(\w+)"/g)].map(m => m[1]))) {
    if (d[key] != null) html = setText(html, key, d[key]);
  }
  // 제목 · 설명
  const title = group ? `${grp.t} — Butter Edit` : page === "buy.html" ? `${d.buyTitle} — Butter Edit` : d.htmlTitle;
  const desc = group ? det.lead : page === "buy.html" ? d.buyLead : d.promo;
  html = html.replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  if (/<meta name="description"/.test(html)) html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`);
  else html = html.replace(/(<title>[^<]*<\/title>)/, `$1\n<meta name="description" content="${esc(desc)}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(d.subtitle)}">`)
    .replace(/(<meta property="og:image" content="[^"]*\/img\/)en\//, `$1${d.img}/`);
  // 그림
  html = html.replace(/(<img\b[^>]*\sdata-shot="([^"]+)"[^>]*\ssrc=")img\/[^/]+\//g, `$1img/${d.img}/`)
    .replace(/(<img\b[^>]*\sdata-face[^>]*\ssrc=")img\/05-face-\w+\.webp/g, `$1img/05-face-${lang === "ko" ? "ko" : "en"}.webp`)
    .replace(/(<img\b[^>]*\sdata-alt="(\d+)"[^>]*\salt=")[^"]*/g, (m, a, i) => a + esc(d.shotAlt[+i]))
    .replace(/(<img\b[^>]*\sdata-alt-i="(\w+)"[^>]*\salt=")[^"]*/g, (m, a, k) => a + esc(d[k] || ""));
  // 기능 목록 · 상세
  html = html.replace(/(<div class="groups" id="groups">)[\s\S]*?(<\/div>)/, `$1${groupsHTML(d, lang, page)}$2`);
  if (group) {
    const k = SLUGS.indexOf(group);
    const tabs = SLUGS.map((s, i) => `<a href="${s}.html"${s === group ? ' class="on" aria-current="page"' : ""}>${esc(d.groups[i].t)}</a>`).join("");
    const prev = SLUGS[(k + 7) % 8], next = SLUGS[(k + 1) % 8];
    const pager = `<a class="prev" href="${prev}.html"><small>←</small><span>${esc(d.groups[SLUGS.indexOf(prev)].t)}</span></a><a class="next" href="${next}.html"><small>→</small><span>${esc(d.groups[SLUGS.indexOf(next)].t)}</span></a>`;
    const items = det.items.map(it => `<div class="item"><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></div>`).join("");
    html = html.replace(/(id="tabs"[^>]*>)(<\/nav>)/, `$1${tabs}$2`)
      .replace(/(id="d-title">)(<\/h1>)/, `$1${esc(grp.t)}$2`)
      .replace(/(id="d-lead">)(<\/p>)/, `$1${esc(det.lead)}$2`)
      .replace(/(id="d-items">)(<\/div>)/, `$1${items}$2`)
      .replace(/(id="pager">)(<\/nav>)/, `$1${pager}$2`);
    if (SHOTS[group]) html = html.replace(/<img([^>]*)id="d-shot" alt=""([^>]*) hidden>/, `<img$1id="d-shot" src="../img/${d.img}/${SHOTS[group]}.webp" alt="${esc(d.shotAlt[ALT[group]])}"$2>`);
  }
  // 이 페이지의 언어 · 사이트 뿌리(home.js가 읽는다)
  html = html.replace(/<body([^>]*)>/, (m, a) => {
    let attrs = a.replace(/\sdata-root="[^"]*"/, "");
    return `<body${attrs} data-lang="${lang}" data-root="${group ? "../../" : "../"}">`;
  });
  html = relink(html, page);
  html = html.replace(/<link rel="canonical"[^>]*>\n?/g, "").replace(/<link rel="alternate" hreflang[^>]*>\n?/g, "")
    .replace(/(<meta charset="utf-8">)/, `$1\n<link rel="canonical" href="${urlOf(lang, page)}">\n${alternates(page)}`);
  return html.replace(/\n?<!-- 이 페이지는 앱 · App Store Connect의 '지원 URL'이기도 하다[^>]*-->/, "");
}

// 영어 원본(루트)에도 대표 주소 · 언어별 주소를 단다
for (const page of PAGES) {
  const f = path.join(ROOT, page);
  let html = fs.readFileSync(f, "utf8");
  html = html.replace(/<link rel="canonical"[^>]*>\n?/g, "").replace(/<link rel="alternate" hreflang[^>]*>\n?/g, "")
    .replace(/(<meta charset="utf-8">)/, `$1\n<link rel="canonical" href="${urlOf("en", page)}">\n${alternates(page)}`);
  fs.writeFileSync(f, html);
}
let n = 0;
for (const lang of LANGS.filter(l => l !== "en")) {
  for (const page of PAGES) {
    const out = path.join(ROOT, lang, page);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, build(lang, page));
    n++;
  }
}
console.log(`${n}쪽 만듦 (${LANGS.length - 1}개 언어 × ${PAGES.length}쪽)`);
