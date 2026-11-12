// 在官方 Markdown 预览左侧生成目录：h1–h3，点击跳转，滚动高亮当前章节。
// 官方预览每次刷新用 morphdom 替换 body 内容并派发 vscode.markdown.updateContent，
// 所以在该事件里重新挂载、重建目录。
(function () {
  const KEY = 'mdtoc-collapsed';
  const NARROW = 520;
  let headings = [];
  let items = [];

  function store(get, val) {
    try {
      if (get) return localStorage.getItem(KEY);
      localStorage.setItem(KEY, val);
    } catch (_) { /* webview 里存储可能不可用，忽略 */ }
    return null;
  }

  function isNarrow() { return window.innerWidth <= NARROW; }

  function setCollapsed(c) {
    document.body.classList.toggle('mdtoc-collapsed', c);
    const btn = document.querySelector('.mdtoc-btn');
    if (btn) btn.title = c ? '显示目录' : '隐藏目录';
  }

  function ensureShell() {
    let nav = document.querySelector('.mdtoc');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'mdtoc';
      document.body.appendChild(nav);
    }
    let btn = document.querySelector('.mdtoc-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'mdtoc-btn';
      btn.type = 'button';
      btn.textContent = '☰';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const c = !document.body.classList.contains('mdtoc-collapsed');
        setCollapsed(c);
        if (!isNarrow()) store(false, c ? '1' : '0');
      });
      document.body.appendChild(btn);
    }
    return nav;
  }

  function build() {
    if (!document.body) return;
    const nav = ensureShell();
    headings = [...document.querySelectorAll('h1, h2, h3')].filter((h) => !h.closest('.mdtoc'));
    nav.textContent = '';
    items = headings.map((h, i) => {
      if (!h.id) h.id = 'mdtoc-' + i;
      const a = document.createElement('div');
      a.className = 'mdtoc-item l' + h.tagName[1];
      a.setAttribute('role', 'link');
      a.textContent = h.textContent.trim();
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        h.scrollIntoView({ block: 'start' });
        if (isNarrow()) setCollapsed(true);
      });
      nav.appendChild(a);
      return a;
    });
    document.body.classList.toggle('mdtoc-on', headings.length > 0);
    nav.style.display = headings.length ? '' : 'none';
    document.querySelector('.mdtoc-btn').style.display = headings.length ? '' : 'none';
    highlight();
  }

  function highlight() {
    if (!headings.length) return;
    let cur = 0;
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top <= 80) cur = i; else break;
    }
    // 当前所在的 h2（或 h1）分节：只展开该分节下的 h3
    let sec = cur;
    while (sec > 0 && headings[sec].tagName === 'H3') sec--;
    items.forEach((a, i) => {
      a.classList.toggle('active', i === cur);
      if (a.classList.contains('l3')) {
        let p = i;
        while (p > 0 && headings[p].tagName === 'H3') p--;
        a.classList.toggle('show', p === sec);
      }
    });
    const nav = document.querySelector('.mdtoc');
    const act = items[cur];
    if (nav && act && !nav.matches(':hover')) {
      const r = act.getBoundingClientRect();
      if (r.top < 40 || r.bottom > window.innerHeight - 20) act.scrollIntoView({ block: 'nearest' });
    }
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; highlight(); });
  }, { passive: true });

  window.addEventListener('vscode.markdown.updateContent', build);

  // 兜底：切换预览/源码等路径可能直接替换正文或 body，而不派发 updateContent。
  // 监听结构变化，目录被移走或正文被换掉时重建（合并到下一帧，避免抖动）。
  let pending = false;
  let lastBody = null;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const body = document.body;
      if (!body) return;
      const missing = !body.querySelector(':scope > .mdtoc') || !body.querySelector(':scope > .mdtoc-btn');
      const stale = headings.length && !headings[0].isConnected;
      if (body !== lastBody) observeBody();
      if (missing || stale || !body.classList.contains('mdtoc-on')) {
        const collapsed = body.classList.contains('mdtoc-collapsed');
        build();
        setCollapsed(collapsed || isNarrow() || store(true) === '1');
      }
    });
  }
  const bodyObserver = new MutationObserver(schedule);
  function observeBody() {
    bodyObserver.disconnect();
    lastBody = document.body;
    if (lastBody) bodyObserver.observe(lastBody, { childList: true, attributes: true, attributeFilter: ['class'] });
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true });
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', schedule);

  function init() {
    build();
    setCollapsed(isNarrow() || store(true) === '1');
    observeBody();
    console.log('[md-preview-toc] loaded, headings:', headings.length);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
