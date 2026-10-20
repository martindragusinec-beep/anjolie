/* Anjolie · homepage interakce
 * Bez závislostí. Hlavní části: lišta výhod, mega menu, našeptávač, mobilní menu,
 * záložky, karusely s ukazatelem, mini košík s množstevní slevou, akordeony v patičce, newsletter.
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const dataEl = $('#anj-data');
  if (!dataEl) return;
  const DATA = JSON.parse(dataEl.textContent);
  const NB = ' ';
  const mqDesk = window.matchMedia('(min-width: 1200px)');
  const mqTablet = window.matchMedia('(min-width: 768px)');
  const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const api = {};

  const icon = (name, cls = '') => `<svg class="icon${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (n) => {
    const r = Math.round(n * 100) / 100;
    const whole = Math.abs(r - Math.round(r)) < 0.005;
    return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(r) + NB + 'Kč';
  };
  // v náhledu (artifact) otevíráme anjolie.cz v novém panelu, na webu normálně
  const go = (url) => { if (window.ANJ_PREVIEW) window.open(url, '_blank', 'noopener'); else window.location.href = url; };
  const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ---------- zámek scrollu, překryv, fokus ---------- */
  let locks = 0;
  const lock = () => { locks += 1; document.body.classList.add('is-locked'); };
  const unlock = () => { locks = Math.max(0, locks - 1); if (!locks) document.body.classList.remove('is-locked'); };

  const overlay = $('#overlay');
  let overlayOwner = null;
  function showOverlay(owner, top = false) {
    overlayOwner = owner;
    overlay.hidden = false;
    overlay.style.zIndex = top ? '75' : '';
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }
  function hideOverlay(owner) {
    if (owner && overlayOwner !== owner) return;
    overlayOwner = null;
    overlay.classList.remove('is-visible');
    window.setTimeout(() => { if (!overlayOwner) overlay.hidden = true; }, 200);
  }
  overlay.addEventListener('click', () => {
    if (overlayOwner === 'mega') api.closeMega();
    if (overlayOwner === 'search') api.closeSearch();
    if (overlayOwner === 'cart') api.closeCart();
  });

  const focusables = (root) => $$('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
  function trapTab(root, e) {
    if (e.key !== 'Tab') return;
    const f = focusables(root);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- lišta výhod (mobil: střídání) ---------- */
  function initAnnounce() {
    const root = $('[data-announce]');
    if (!root) return;
    const items = $$('.announce__item', root);
    const mqWide = window.matchMedia('(min-width: 1024px)');
    let i = 0;
    let paused = false;
    root.addEventListener('mouseenter', () => { paused = true; });
    root.addEventListener('mouseleave', () => { paused = false; });
    if (mqReduced.matches || items.length < 2) return;
    window.setInterval(() => {
      if (paused || mqWide.matches || document.hidden) return;
      i = (i + 1) % items.length;
      items.forEach((el, k) => el.classList.toggle('is-active', k === i));
    }, 5000);
  }

  /* ---------- mega menu ---------- */
  function initMega() {
    const btn = $('#nav-obchod');
    const panel = $('#mega-obchod');
    if (!btn || !panel) { api.closeMega = () => {}; return; }
    const item = btn.closest('.nav__item');
    let openT;
    let closeT;
    const open = () => {
      window.clearTimeout(closeT);
      if (!panel.hidden) return;
      api.closeSearch && api.closeSearch();
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      showOverlay('mega');
    };
    const close = () => {
      window.clearTimeout(openT);
      if (panel.hidden) return;
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      hideOverlay('mega');
    };
    api.closeMega = close;
    btn.addEventListener('click', () => (panel.hidden ? open() : close()));
    [item, panel].forEach((el) => {
      el.addEventListener('mouseenter', () => { if (!canHover.matches) return; window.clearTimeout(closeT); openT = window.setTimeout(open, 150); });
      el.addEventListener('mouseleave', () => { if (!canHover.matches) return; window.clearTimeout(openT); closeT = window.setTimeout(close, 200); });
    });
    panel.addEventListener('focusout', (e) => { if (!panel.contains(e.relatedTarget) && e.relatedTarget !== btn) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { close(); btn.focus(); } });
    mqDesk.addEventListener('change', close);
  }

  /* ---------- našeptávač ---------- */
  function initSearch() {
    const panel = $('#search-panel');
    const q = $('#q');
    const qm = $('#q-m');
    const results = $('[data-search-results]');
    const form = $('[data-search-form]');
    if (!panel || !q) return;
    const products = Object.entries(DATA).filter(([k]) => !k.startsWith('_')).map(([id, p]) => ({ id, ...p, key: norm(p.name + ' ' + p.desc) }));
    const cats = DATA._cats.map((c) => ({ ...c, key: norm(c.name) }));
    let active = -1;
    let opener = null;

    const row = (p, query) => {
      let name = esc(p.name);
      if (query) {
        const idx = norm(p.name).indexOf(norm(query));
        if (idx > -1) name = esc(p.name.slice(0, idx)) + '<mark>' + esc(p.name.slice(idx, idx + query.length)) + '</mark>' + esc(p.name.slice(idx + query.length));
      }
      const price = (p.priceFrom ? 'od' + NB : '') + money(p.price);
      return `<a class="result" href="${esc(p.url)}"><img class="result__thumb" src="${esc(p.img)}" alt="" width="56" height="56"><span class="result__text"><span class="result__name t-title-s">${name}</span><span class="t-body-s text-body">${esc(p.desc)}</span></span><span class="t-price-s">${price}</span></a>`;
    };
    const searchUrl = (query) => 'https://www.anjolie.cz/vyhledavani/?string=' + encodeURIComponent(query);
    const quick = `<div class="mobile-only-links">${[['Prodejna a poradny', 'https://www.anjolie.cz/nase-pobocky/'], ['Doprava a platba', 'https://www.anjolie.cz/doprava-a-platba/'], ['Moje objednávka', 'https://www.anjolie.cz/moje-objednavka/']].map(([l, h]) => `<a class="navrow" href="${h}">${esc(l)}${icon('chevron-right')}</a>`).join('')}</div>`;

    function render() {
      const query = (mqDesk.matches ? q.value : qm.value).trim();
      const def = $('.search-panel__default', panel);
      active = -1;
      if (query.length < 2) {
        def.hidden = false;
        const best = DATA._best.map((id) => products.find((p) => p.id === id)).filter(Boolean);
        results.innerHTML = `<hr class="divider"><div class="stack" style="--section-gap:4px"><p class="eyebrow" style="margin-bottom:8px">Nejprodávanější</p>${best.map((p) => row(p)).join('')}</div>`
          + `<a class="link-arrow" style="align-self:flex-start" href="https://www.anjolie.cz/obchod/"><span>Zobrazit všechny produkty</span>${icon('arrow-up-right')}</a>` + quick;
        return;
      }
      def.hidden = true;
      const nq = norm(query);
      const hitsP = products.filter((p) => p.key.includes(nq)).slice(0, 5);
      const hitsC = cats.filter((c) => c.key.includes(nq)).slice(0, 3);
      if (!hitsP.length && !hitsC.length) {
        results.innerHTML = `<p class="search-panel__empty t-body-m">Pro „${esc(query)}“ jsme nic nenašli. Zkuste jiný výraz, třeba název účinné látky.</p>`
          + `<a class="link-arrow" style="align-self:flex-start" href="${searchUrl(query)}"><span>Hledat v celém e-shopu</span>${icon('arrow-up-right')}</a>`;
        return;
      }
      let html = '';
      if (hitsC.length) html += `<div class="stack" style="--section-gap:12px"><p class="eyebrow">Kategorie</p><div class="chips">${hitsC.map((c) => `<a class="chip" href="${esc(c.url)}">${esc(c.name)}</a>`).join('')}</div></div>`;
      if (hitsP.length) html += `<div class="stack" style="--section-gap:4px"><p class="eyebrow" style="margin-bottom:8px">Produkty</p>${hitsP.map((p) => row(p, query)).join('')}</div>`;
      html += `<a class="link-arrow" style="align-self:flex-start" href="${searchUrl(query)}"><span>Zobrazit všechny výsledky pro „${esc(query)}“</span>${icon('arrow-up-right')}</a>`;
      results.innerHTML = html;
    }

    function open(fromEl) {
      api.closeMega();
      opener = fromEl || document.activeElement;
      if (panel.hidden) {
        panel.hidden = false;
        if (mqDesk.matches) { q.setAttribute('aria-expanded', 'true'); showOverlay('search'); }
        else {
          lock();
          qm.value = q.value;
          // fokus hned v obsluze kliknutí, jinak iOS neotevře klávesnici
          qm.focus({ preventScroll: true });
          if (document.activeElement !== qm) window.setTimeout(() => qm.focus({ preventScroll: true }), 30);
        }
      }
      render();
    }
    function close(restore = true) {
      if (panel.hidden) return;
      panel.hidden = true;
      q.setAttribute('aria-expanded', 'false');
      if (mqDesk.matches) hideOverlay('search');
      else { unlock(); if (restore && opener && opener.focus) opener.focus(); }
    }
    api.closeSearch = () => close(false);

    q.addEventListener('focus', () => open(q));
    q.addEventListener('input', () => { if (panel.hidden) open(q); else render(); });
    qm.addEventListener('input', render);
    $$('[data-search-open]').forEach((b) => b.addEventListener('click', () => { api.closeMenu && api.closeMenu(false); open(b); }));
    $$('[data-search-close]', panel).forEach((b) => b.addEventListener('click', () => close()));
    panel.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-query]');
      if (!chip) return;
      e.preventDefault();
      const input = mqDesk.matches ? q : qm;
      input.value = chip.dataset.query;
      render();
      input.focus();
    });
    form.addEventListener('submit', (e) => {
      if (!q.value.trim()) { e.preventDefault(); q.focus(); return; }
      if (window.ANJ_PREVIEW) { e.preventDefault(); go(searchUrl(q.value.trim())); }
    });
    // klávesnice v obou polích: šipky vybírají výsledek, Enter otevře výsledek nebo celé hledání
    const onKeys = (input) => (e) => {
      const links = $$('.result', panel).filter((l) => l.offsetParent !== null);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!links.length) return;
        e.preventDefault();
        active = e.key === 'ArrowDown' ? Math.min(links.length - 1, active + 1) : Math.max(-1, active - 1);
        links.forEach((l, i) => l.classList.toggle('is-active', i === active));
        if (links[active]) links[active].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (active > -1 && links[active]) { e.preventDefault(); links[active].click(); }
        else if (input === qm) { e.preventDefault(); if (qm.value.trim()) go(searchUrl(qm.value.trim())); }
      } else if (e.key === 'Escape' && input === q) {
        close(); q.blur();
      }
    };
    q.addEventListener('keydown', onKeys(q));
    qm.addEventListener('keydown', onKeys(qm));
    document.addEventListener('click', (e) => {
      if (panel.hidden || !mqDesk.matches) return;
      if (!panel.contains(e.target) && !form.contains(e.target)) close(false);
    });
    panel.addEventListener('focusout', (e) => {
      if (!mqDesk.matches) return;
      if (e.relatedTarget && !panel.contains(e.relatedTarget) && !form.contains(e.relatedTarget)) close(false);
    });
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (!mqDesk.matches) trapTab(panel, e);
    });
    mqDesk.addEventListener('change', () => close(false));
  }

  /* ---------- mobilní menu ---------- */
  function initMenu() {
    const menu = $('#mmenu');
    if (!menu) return;
    const openers = $$('[data-menu-open]');
    let opener = null;
    const open = (btn) => {
      opener = btn;
      menu.hidden = false;
      lock();
      openers.forEach((b) => b.setAttribute('aria-expanded', 'true'));
      window.setTimeout(() => $('[data-menu-close]', menu).focus(), 30);
    };
    const close = (restore = true) => {
      if (menu.hidden) return;
      menu.hidden = true;
      unlock();
      openers.forEach((b) => b.setAttribute('aria-expanded', 'false'));
      if (restore && opener) opener.focus();
    };
    api.closeMenu = close;
    openers.forEach((b) => b.addEventListener('click', () => open(b)));
    $$('[data-menu-close]', menu).forEach((b) => b.addEventListener('click', () => close()));
    menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); trapTab(menu, e); });
    $$('.navrow[aria-controls]', menu).forEach((b) => {
      const group = document.getElementById(b.getAttribute('aria-controls'));
      b.addEventListener('click', () => {
        const openNow = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(openNow));
        group.hidden = !openNow;
      });
    });
    mqDesk.addEventListener('change', () => { if (mqDesk.matches) close(false); });
  }

  /* ---------- záložky ---------- */
  function initTabs() {
    $$('[role="tablist"]').forEach((list) => {
      const tabs = $$('[role="tab"]', list);
      const select = (tab, focus) => {
        tabs.forEach((t) => {
          const on = t === tab;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
          const p = document.getElementById(t.getAttribute('aria-controls'));
          if (p) p.hidden = !on;
        });
        if (focus) tab.focus();
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) $$('[data-carousel]', panel).forEach((c) => c.update && c.update(true));
      };
      tabs.forEach((t, i) => {
        t.addEventListener('click', () => select(t, false));
        t.addEventListener('keydown', (e) => {
          const map = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 };
          if (e.key in map) { e.preventDefault(); select(tabs[map[e.key]], true); }
        });
      });
    });
  }

  /* ---------- karusely ---------- */
  function initCarousels() {
    $$('[data-carousel]').forEach((c) => {
      const track = $('.carousel__track', c);
      const prev = $('.carousel__arrow--prev', c);
      const next = $('.carousel__arrow--next', c);
      const prog = document.querySelector(`[data-progress-for="${c.id}"]`);
      const thumb = prog && $('.progress__thumb', prog);
      const step = () => {
        const item = track.firstElementChild;
        if (!item) return track.clientWidth;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        const w = item.getBoundingClientRect().width + gap;
        return w * Math.max(1, Math.floor((track.clientWidth + gap) / w));
      };
      const update = (reset) => {
        if (reset) track.scrollLeft = 0;
        const max = track.scrollWidth - track.clientWidth;
        const scrollable = max > 2;
        c.classList.toggle('is-static', !scrollable);
        if (prog) prog.classList.toggle('is-static', !scrollable);
        prev.hidden = !scrollable || track.scrollLeft < 4;
        next.hidden = !scrollable || track.scrollLeft > max - 4;
        if (thumb && scrollable) {
          const ratio = track.clientWidth / track.scrollWidth;
          const pos = (track.scrollLeft / max) * (1 - ratio);
          thumb.style.width = (ratio * 100).toFixed(2) + '%';
          thumb.style.transform = `translateX(${((pos / ratio) * 100).toFixed(2)}%)`;
        }
        const media = track.querySelector('.pcard__media, .vcard, .acard__img, .store__photo, .rcard');
        const top = media ? (media.classList.contains('rcard') ? media.offsetHeight / 2 : media.offsetHeight / 2) : track.clientHeight / 2;
        c.style.setProperty('--arrow-top', `${Math.round(top)}px`);
      };
      const go = (dir) => track.scrollBy({ left: dir * step(), behavior: mqReduced.matches ? 'auto' : 'smooth' });
      prev.addEventListener('click', () => go(-1));
      next.addEventListener('click', () => go(1));
      let raf = 0;
      track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => update(false)); }, { passive: true });
      if ('ResizeObserver' in window) new ResizeObserver(() => update(false)).observe(track);
      window.addEventListener('load', () => update(false));
      c.update = update;
      update(false);
    });
  }

  /* ---------- mini košík ---------- */
  function initCart() {
    const drawer = $('#minicart');
    const body = $('[data-cart-body]', drawer);
    const foot = $('[data-cart-foot]', drawer);
    const titleEl = $('#minicart-title');
    const titleText = $('[data-cart-title]', drawer);
    const subtotalEl = $('[data-cart-subtotal]', drawer);
    const discountEl = $('[data-cart-discount]', drawer);
    const countEl = $('.cart-count');
    const cartBtn = $('[data-cart-open]');
    const toast = $('#toast');
    const toastText = $('[data-toast-text]', toast);
    const toastUndo = $('[data-toast-undo]', toast);
    const items = [];
    let focusItem = null;
    let opener = null;
    let toastTimer = 0;
    let undo = null;

    const product = (id) => DATA[id];
    const rate = (id, qty) => (product(id).bulk ? (qty >= 5 ? 0.15 : qty >= 2 ? 0.1 : 0) : 0);

    function updateCount(bump) {
      const n = items.reduce((s, it) => s + it.qty, 0);
      countEl.textContent = String(n);
      countEl.hidden = n === 0;
      cartBtn.setAttribute('aria-label', n ? `Košík, ${n} ${plural(n, 'položka', 'položky', 'položek')}` : 'Košík je prázdný');
      if (bump && !mqReduced.matches) { countEl.classList.remove('is-bump'); void countEl.offsetWidth; countEl.classList.add('is-bump'); }
    }

    function progress(it) {
      const p = product(it.id);
      if (!p.bulk) return '';
      const q = it.qty;
      const fill = q >= 5 ? 100 : q === 4 ? 83.3 : q === 3 ? 66.7 : q === 2 ? 50 : 25;
      let msg;
      if (q === 1) msg = 'Přidejte ještě 1 kus a získáte množstevní slevu 10' + NB + '%.';
      else if (q < 5) msg = `Máte slevu 10${NB}%. Přidejte ještě ${5 - q}${NB}${plural(5 - q, 'kus', 'kusy', 'kusů')} a sleva bude 15${NB}%.`;
      else msg = 'Máte nejvyšší množstevní slevu 15' + NB + '%.';
      const btn = q < 5 ? `<button class="btn btn--outline btn--s" type="button" data-inc="${it.id}">Přidat ${q + 1}.${NB}kus${icon('plus')}</button>` : '';
      return `<div class="dprog" aria-live="polite"><p class="dprog__msg">${icon('percent')}<span>${msg}</span></p>
        <div class="dprog__track" role="progressbar" aria-label="Množstevní sleva" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${Math.min(q, 5)}"><div class="dprog__fill" style="width:${fill}%"></div></div>
        <p class="dprog__marks"><span class="is-reached">1${NB}ks</span><span class="${q >= 2 ? 'is-reached' : ''}">2${NB}ks · −10${NB}%</span><span class="${q >= 5 ? 'is-reached' : ''}">5${NB}ks · −15${NB}%</span></p>${btn}</div>`;
    }

    function line(it) {
      const p = product(it.id);
      const r = rate(it.id, it.qty);
      const full = p.price * it.qty;
      const price = full * (1 - r);
      const min = it.qty <= 1;
      return `<div class="line" data-line="${it.id}">
        <img class="line__thumb" src="${esc(p.img)}" alt="" width="88" height="88">
        <div class="line__body">
          <a class="line__name" href="${esc(p.url)}">${esc(p.name)}</a>
          <span class="line__desc">${esc(p.desc)}</span>
          <div class="line__row">
            <div class="stepper" role="group" aria-label="Počet kusů">
              <button type="button" data-dec="${it.id}" aria-label="Ubrat kus" aria-disabled="${min}">${icon('minus')}</button>
              <output aria-live="polite">${it.qty}</output>
              <button type="button" data-inc="${it.id}" aria-label="Přidat kus">${icon('plus')}</button>
            </div>
            <span class="line__price">${r ? `<span class="line__was">${money(full)}</span>` : ''}<span class="t-price-s">${money(price)}</span></span>
          </div>
        </div>
        <button class="line__remove" type="button" data-remove="${it.id}" aria-label="Odebrat ${esc(p.name)} z košíku">${icon('trash')}</button>
      </div>`;
    }

    function xsell() {
      const ids = DATA._xsell.filter((id) => !items.some((it) => it.id === id)).slice(0, 2);
      if (!ids.length) return '';
      return `<div class="drawer__xsell"><p class="eyebrow">Mohlo by se vám hodit</p>${ids.map((id) => {
        const p = product(id);
        return `<a class="result" href="${esc(p.url)}"><img class="result__thumb" src="${esc(p.img)}" alt="" width="56" height="56"><span class="result__text"><span class="result__name t-title-s">${esc(p.name)}</span><span class="t-body-s text-body">${esc(p.desc)}</span></span><span class="t-price-s">${(p.priceFrom ? 'od' + NB : '') + money(p.price)}</span></a>`;
      }).join('')}</div>`;
    }

    function render() {
      if (!items.length) {
        titleText.textContent = 'Košík';
        titleEl.querySelector('.icon').style.display = 'none';
        body.innerHTML = `<div class="drawer__empty"><p class="t-title-m" style="color:var(--color-text-primary)">Košík je prázdný</p><p class="t-body-s">Vyberte si z nejprodávanějších doplňků nebo se poraďte na infolince.</p><button class="btn btn--outline" type="button" data-cart-close>Pokračovat v nákupu</button></div>`;
        foot.hidden = true;
        return;
      }
      foot.hidden = false;
      const lead = items.find((it) => it.id === focusItem) || items[0];
      titleEl.querySelector('.icon').style.display = focusItem ? '' : 'none';
      titleText.textContent = focusItem ? 'Přidáno do košíku' : 'Košík';
      body.innerHTML = items.map((it) => line(it) + (it === lead ? progress(it) : '')).join('') + xsell();
      let sum = 0;
      let saved = 0;
      items.forEach((it) => { const full = product(it.id).price * it.qty; const r = rate(it.id, it.qty); sum += full * (1 - r); saved += full * r; });
      subtotalEl.textContent = money(sum);
      discountEl.hidden = saved < 0.5;
      discountEl.innerHTML = `<span>Množstevní sleva</span><span>−${money(saved)}</span>`;
    }

    function openCart(id, from) {
      focusItem = id;
      opener = from || document.activeElement;
      api.closeMega(); api.closeSearch && api.closeSearch(); api.closeMenu && api.closeMenu(false);
      render();
      if (drawer.hidden) {
        drawer.hidden = false;
        showOverlay('cart', true);
        lock();
      }
      window.setTimeout(() => titleEl.focus(), 30);
    }
    function closeCart() {
      if (drawer.hidden) return;
      drawer.hidden = true;
      hideOverlay('cart');
      unlock();
      if (opener && document.contains(opener)) opener.focus();
    }
    api.closeCart = closeCart;

    function add(id, from) {
      const it = items.find((x) => x.id === id);
      if (it) it.qty += 1; else items.unshift({ id, qty: 1 });
      updateCount(true);
      openCart(id, from);
    }

    function showToast(text, onUndo) {
      window.clearTimeout(toastTimer);
      toastText.textContent = text;
      undo = onUndo;
      toast.hidden = false;
      toastTimer = window.setTimeout(() => { toast.hidden = true; undo = null; }, 6000);
    }
    toastUndo.addEventListener('click', () => { if (undo) undo(); toast.hidden = true; undo = null; });

    document.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add]');
      if (addBtn) { e.preventDefault(); add(addBtn.dataset.add, addBtn); return; }
      if (e.target.closest('[data-cart-close]')) { closeCart(); }
    });
    cartBtn.addEventListener('click', () => openCart(null, cartBtn));
    body.addEventListener('click', (e) => {
      const inc = e.target.closest('[data-inc]');
      const dec = e.target.closest('[data-dec]');
      const rem = e.target.closest('[data-remove]');
      if (inc) {
        const it = items.find((x) => x.id === inc.dataset.inc); it.qty += 1; focusItem = focusItem || it.id; updateCount(true); render();
        const again = body.querySelector(`[data-line="${it.id}"] [data-inc]`); if (again && inc.closest('.stepper')) again.focus();
      } else if (dec) {
        if (dec.getAttribute('aria-disabled') === 'true') return;
        const it = items.find((x) => x.id === dec.dataset.dec); it.qty = Math.max(1, it.qty - 1); updateCount(false); render();
        const again = body.querySelector(`[data-line="${it.id}"] [data-dec]`); if (again) again.focus();
      } else if (rem) {
        const idx = items.findIndex((x) => x.id === rem.dataset.remove);
        const [removed] = items.splice(idx, 1);
        if (focusItem === removed.id) focusItem = null;
        updateCount(false); render();
        titleEl.focus();
        showToast(`${product(removed.id).name} odebrán z košíku`, () => { items.splice(idx, 0, removed); updateCount(false); render(); });
      }
    });
    drawer.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); trapTab(drawer, e); });
    updateCount(false);
  }

  /* ---------- patička: akordeony na mobilu ---------- */
  function initFooter() {
    const heads = $$('.fcol__head');
    const sync = () => heads.forEach((h) => {
      const list = document.getElementById(h.getAttribute('aria-controls'));
      if (mqTablet.matches) { h.removeAttribute('aria-expanded'); h.setAttribute('tabindex', '-1'); list.hidden = false; }
      else { h.removeAttribute('tabindex'); if (!h.hasAttribute('aria-expanded')) { h.setAttribute('aria-expanded', 'false'); list.hidden = true; } }
    });
    heads.forEach((h) => h.addEventListener('click', () => {
      if (mqTablet.matches) return;
      const list = document.getElementById(h.getAttribute('aria-controls'));
      const open = h.getAttribute('aria-expanded') !== 'true';
      h.setAttribute('aria-expanded', String(open));
      list.hidden = !open;
    }));
    mqTablet.addEventListener('change', () => { heads.forEach((h) => h.removeAttribute('aria-expanded')); sync(); });
    sync();
  }

  /* ---------- newsletter ---------- */
  function initNewsletter() {
    const form = $('#nl-form');
    if (!form) return;
    const input = $('#nl-email');
    const error = $('#nl-error');
    const success = $('#nl-success');
    const valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
    let tried = false;
    const show = (bad) => { input.setAttribute('aria-invalid', String(bad)); error.hidden = !bad; };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      tried = true;
      if (!valid(input.value)) { show(true); input.focus(); return; }
      show(false);
      form.hidden = true;
      success.hidden = false;
    });
    input.addEventListener('input', () => { if (tried && valid(input.value)) show(false); });
  }

  initAnnounce();
  initMega();
  initSearch();
  initMenu();
  initTabs();
  initCarousels();
  initCart();
  initFooter();
  initNewsletter();
})();
