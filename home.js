// 구입 주소 — 생기면 여기만 채운다. 비어 있으면 버튼이 '곧 나옴'으로 보인다.
const LINKS = {
  appStore: "",   // 맥 앱스토어 주소 (심사 승인 뒤)
  direct: "",     // Dodo 인증이 승인되면 "https://checkout.dodopayments.com/buy/pdt_0NsDRRyl1IPadr41aOBlq?quantity=1" 를 넣는다. 비어 있으면 구입 단추가 '곧 나옴'으로 뜬다
  download: "https://github.com/mmangmm/butter-edit/releases/download/v1.0/ButterEdit-1.0.dmg",   // 직접 판매 맥 DMG 주소(GitHub Releases) — 구입 완료 페이지(thanks.html)의 내려받기 버튼
};

(function () {
  const T = window.BE_I18N;
  const D = window.BE_DETAILS || {};
  const LANGS = Object.keys(T);
  // 모든 기능 카드 8개의 순서 = i18n.js groups 순서 = features/<slug>.html
  const SLUGS = ["folder", "raw", "adjust", "ai", "shooting", "merge", "export", "more"];
  const SHOTS = { folder: "01-browse", raw: "02-edit", adjust: "03-mask", ai: "04-erase" };
  const ALT = { folder: 0, raw: 1, adjust: 2, ai: 3 };
  const body = document.body;
  const root = body.dataset.root || "";
  const group = body.dataset.group;   // 상세 페이지일 때만

  function pick() {
    const q = new URLSearchParams(location.search).get("lang");
    if (q && T[q]) return q;
    try { const s = localStorage.getItem("be-lang"); if (s && T[s]) return s; } catch (e) {}
    for (const raw of navigator.languages || [navigator.language || "en"]) {
      const l = raw.toLowerCase();
      if (l.startsWith("zh")) return /hant|tw|hk|mo/.test(l) ? "zh-Hant" : "zh-Hans";
      if (l.startsWith("pt")) return "pt-BR";
      const base = l.split("-")[0];
      const hit = LANGS.find(x => x.toLowerCase() === base);
      if (hit) return hit;
    }
    return "en";
  }

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function withLang(href, lang) { return `${href}${href.includes("?") ? "&" : "?"}lang=${lang}`; }
  function featureHref(slug) { return group ? `${slug}.html` : `features/${slug}.html`; }

  function renderGroups(d, lang) {
    const g = document.getElementById("groups");
    if (!g) return;
    g.replaceChildren(...d.groups.map((grp, k) => {
      const box = el("a", "group");
      box.href = withLang(featureHref(SLUGS[k]), lang);
      box.append(el("h3", "", grp.t));
      const ul = el("ul");
      grp.i.forEach(t => ul.append(el("li", "", t)));
      box.append(ul, el("span", "more-link", d.moreLink + " →"));
      return box;
    }));
  }

  function renderDetail(d, lang) {
    if (!group) return;
    const k = SLUGS.indexOf(group);
    const grp = d.groups[k];
    const det = (D[lang] || D.en)[group];
    document.title = `${grp.t} — Butter Edit`;
    document.getElementById("d-title").textContent = grp.t;
    document.getElementById("d-lead").textContent = det.lead;

    const tabs = document.getElementById("tabs");
    tabs.replaceChildren(...SLUGS.map((s, i) => {
      const a = el("a", s === group ? "on" : "", d.groups[i].t);
      a.href = withLang(featureHref(s), lang);
      if (s === group) a.setAttribute("aria-current", "page");
      return a;
    }));
    const on = tabs.querySelector(".on");
    if (on) tabs.scrollLeft = on.offsetLeft - 16;

    const shot = document.getElementById("d-shot");
    if (SHOTS[group]) {
      shot.src = `${root}img/${d.img}/${SHOTS[group]}.webp`;
      shot.alt = d.shotAlt[ALT[group]];
      shot.hidden = false;
    }

    document.getElementById("d-items").replaceChildren(...det.items.map(it => {
      const c = el("div", "item");
      c.append(el("h3", "", it.t), el("p", "", it.d));
      return c;
    }));

    const pager = document.getElementById("pager");
    const prev = SLUGS[(k + SLUGS.length - 1) % SLUGS.length], next = SLUGS[(k + 1) % SLUGS.length];
    const pa = el("a", "prev"); pa.href = withLang(featureHref(prev), lang);
    pa.append(el("small", "", "←"), el("span", "", d.groups[SLUGS.indexOf(prev)].t));
    const na = el("a", "next"); na.href = withLang(featureHref(next), lang);
    na.append(el("small", "", "→"), el("span", "", d.groups[SLUGS.indexOf(next)].t));
    pager.replaceChildren(pa, na);
  }

  function apply(lang) {
    const d = T[lang];
    document.documentElement.lang = lang;
    const page = body.dataset.page;
    document.title = page === "buy" ? `${d.buyTitle} — Butter Edit` : page === "thanks" ? `${d.thanksTitle} — Butter Edit` : d.htmlTitle;
    document.querySelectorAll("[data-i]").forEach(n => { const v = d[n.dataset.i]; if (v != null) n.textContent = v; });
    document.querySelectorAll("img[data-shot]").forEach(img => {
      img.src = `${root}img/${d.img}/${img.dataset.shot}.webp`;
    });
    document.querySelectorAll("img[data-face]").forEach(img => { img.src = `${root}img/05-face-${lang === "ko" ? "ko" : "en"}.webp`; });
    document.querySelectorAll("img[data-alt]").forEach(img => { img.alt = d.shotAlt[+img.dataset.alt]; });
    document.querySelectorAll("img[data-alt-i]").forEach(img => { img.alt = d[img.dataset.altI] || ""; });
    renderGroups(d, lang);
    renderDetail(d, lang);
    const sel = document.getElementById("lang");
    sel.value = lang;
    sel.setAttribute("aria-label", d.langLabel);
  }

  // 결제 링크가 없을 때 직접 구입 버튼이 띄우는 안내 창
  function soonDialog() {
    let dlg = document.getElementById("soon-dialog");
    if (dlg) return dlg;
    dlg = el("dialog", "sheet"); dlg.id = "soon-dialog";
    const h = el("h2"); h.dataset.i = "soonT";
    const p = el("p"); p.dataset.i = "soonD";
    const b = el("button", "btn primary"); b.dataset.i = "close"; b.type = "button";
    b.addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    dlg.append(h, p, b);
    document.body.append(dlg);
    return dlg;
  }

  function emailDialog(link) {
    let dlg = document.getElementById("email-dialog");
    if (dlg) return dlg;
    dlg = el("dialog", "sheet"); dlg.id = "email-dialog";
    const form = el("form"); form.noValidate = true;
    const h = el("h2"); h.dataset.i = "emT";
    const p = el("p"); p.dataset.i = "emD";
    const field = (key, id) => {
      const lab = el("label", "field"); const sp = el("span"); sp.dataset.i = key;
      const inp = el("input"); inp.type = "email"; inp.id = id; inp.required = true; inp.spellcheck = false;
      inp.autocapitalize = "off"; inp.autocomplete = id === "em1" ? "email" : "off";
      lab.append(sp, inp); return [lab, inp];
    };
    const [l1, i1] = field("em1", "em1"), [l2, i2] = field("em2", "em2");
    i2.addEventListener("paste", e => e.preventDefault());   // 확인 칸은 직접 쳐야 한다
    const err = el("p", "err"); err.setAttribute("role", "alert");
    const note = el("p", "note-s"); note.dataset.i = "emNote";
    const go = el("button", "btn primary"); go.type = "submit"; go.dataset.i = "emGo";
    const cancel = el("button", "btn secondary"); cancel.type = "button"; cancel.dataset.i = "emCancel";
    cancel.addEventListener("click", () => dlg.close());
    const row = el("div", "row"); row.append(cancel, go);
    const ok = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    const tt = () => T[document.documentElement.lang] || T.en;
    const check = show => {
      const a = i1.value.trim(), b = i2.value.trim();
      let msg = "";
      if (!ok(a)) msg = a ? tt().emInvalid : "";
      else if (b && a.toLowerCase() !== b.toLowerCase()) msg = tt().emMismatch;
      err.textContent = show ? msg : "";
      const good = ok(a) && a.toLowerCase() === b.toLowerCase();
      go.disabled = !good;
      return good;
    };
    i1.addEventListener("input", () => check(false)); i2.addEventListener("input", () => check(i2.value.length >= i1.value.trim().length));
    i1.addEventListener("blur", () => check(true)); i2.addEventListener("blur", () => check(true));
    form.addEventListener("submit", e => {
      e.preventDefault();
      if (!check(true)) return;
      // Dodo 결제 링크 — 확인한 이메일을 미리 넣고, 끝나면 구입 완료 페이지로 돌아온다(키가 주소에 붙어 온다)
      const u = new URL(link);
      u.searchParams.set("email", i1.value.trim());
      const back = new URL(root + "thanks.html", location.href);
      back.searchParams.set("lang", document.documentElement.lang);
      u.searchParams.set("redirect_url", back.toString());
      dlg.close();
      location.href = u.toString();
    });
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    form.append(h, p, l1, l2, err, note, row);
    dlg.append(form);
    document.body.append(dlg);
    check(false);
    return dlg;
  }

  function setupButtons() {
    const links = document.querySelectorAll("#buy-appstore, #buy-direct, .buy-direct-btn, #dl-mac, #dl-free");
    links.forEach(a => {
      const kind = a.id === "buy-appstore" ? "appStore"
        : (a.id === "dl-mac" || a.id === "dl-free") ? "download" : "direct";
      const url = LINKS[kind];
      if (url) {
        a.href = url;
        a.querySelectorAll("[data-i=soon], .soon-tag").forEach(n => n.remove());
        if (kind === "direct") {
          // 결제 화면으로 가기 전에 이메일을 두 번 받는다(같아야 넘어간다) — 키가 이 주소로 간다.
          // Dodo 결제 화면 안의 이메일 칸은 손댈 수 없어서, 확인한 주소를 email로 미리 채워 넘긴다
          const dlg = emailDialog(url);
          a.setAttribute("role", "button");
          a.addEventListener("click", e => { e.preventDefault(); dlg.showModal(); dlg.querySelector("input").focus(); });
        }
      } else {
        a.classList.add("soon"); a.setAttribute("aria-disabled", "true");
        if (kind === "direct") {
          a.setAttribute("role", "button"); a.tabIndex = 0;
          const dlg = soonDialog();   // 문구는 apply()가 채운다
          const open = e => { e.preventDefault(); dlg.showModal(); };
          a.addEventListener("click", open);
          a.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") open(e); });
        }
      }
    });
  }

  // 구입 완료 페이지 — Dodo가 돌려보낼 때 주소에 붙여 주는 키(license_key, 여럿이면 쉼표)를 보여 준다.
  // 키는 이메일로도 간다. 이 값은 보여 주기만 한다 — 키가 진짜인지는 앱이 활성화할 때 Dodo에 묻는다
  function showKey() {
    const box = document.getElementById("keybox");
    if (!box) return;
    const params = new URLSearchParams(location.search);
    const status = params.get("status");
    if (!status) return;   // 결제를 거치지 않고 연 페이지
    const key = (params.get("license_key") || "").split(",")[0].trim();
    const t = () => T[document.documentElement.lang] || T.en;
    // 키 · 이메일은 주소창 · 방문 기록에 남기지 않는다
    try {
      ["license_key", "email", "payment_id", "status"].forEach(n => params.delete(n));
      history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : ""));
    } catch (e) {}
    const keyEl = document.getElementById("key-text"), copy = document.getElementById("key-copy"), note = document.getElementById("key-note");
    box.hidden = false;
    if (status !== "succeeded" || !key) {
      keyEl.hidden = true; note.dataset.i = "keyFail"; note.textContent = t().keyFail;
      return;
    }
    keyEl.textContent = key;
    copy.hidden = false;
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(key); copy.textContent = t().keyCopied; }
      catch (e) { const rg = document.createRange(); rg.selectNodeContents(keyEl); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); }
    };
  }

  const sel = document.getElementById("lang");
  LANGS.forEach(l => { const o = el("option", "", T[l].name); o.value = l; sel.append(o); });
  sel.addEventListener("change", () => {
    const l = sel.value;
    try { localStorage.setItem("be-lang", l); } catch (e) {}
    const u = new URL(location.href); u.searchParams.set("lang", l); history.replaceState(null, "", u);
    apply(l);
  });
  setupButtons();
  apply(pick());
  showKey();
})();
