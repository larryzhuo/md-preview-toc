// 给官方 mermaid 图加“全屏”按钮：图的容器铺满预览区，SVG 等比放大到屏幕大小。
// 依赖官方 mermaid-markdown-features 生成的结构：.mermaid-wrapper > .mermaid-content > svg，
// 工具条 .mermaid-zoom-controls。官方的平移/缩放仍作用在同一个元素上，退出后由其 ResizeObserver 自动复原。
(function () {
  const FS = 'mdfs-on';
  let current = null;

  function icon(name) {
    const s = document.createElement('span');
    s.className = 'codicon codicon-' + name;
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  function setBtn(btn, on) {
    // 退出用 close：screen-normal 已被官方“复位缩放”按钮占用
    btn.replaceChildren(icon(on ? 'close' : 'screen-full'));
    btn.title = on ? '退出全屏（Esc）' : '全屏查看';
    btn.setAttribute('aria-label', btn.title);
  }

  function resetZoom(wrapper) {
    // 用官方的“复位”按钮让它按新尺寸重新居中；没有就靠 ResizeObserver
    const r = wrapper.querySelector('.zoom-reset-btn');
    if (r) requestAnimationFrame(() => r.click());
  }

  // 全屏时容器脱离文档流，页面高度会变、滚动位置会跳；
  // 用同高占位块撑住原位置，并记下滚动位置，退出时还原。
  let placeholder = null;
  let savedScroll = null;

  function restoreScroll() {
    if (!savedScroll) return;
    const { x, y } = savedScroll;
    const apply = () => window.scrollTo(x, y);
    apply();
    requestAnimationFrame(apply);
    // 官方 ResizeObserver 复位会再改一次高度，稍后再校正一次
    setTimeout(() => { apply(); savedScroll = null; }, 120);
  }

  function enter(wrapper) {
    if (current && current !== wrapper) exit();
    current = wrapper;
    savedScroll = { x: window.scrollX, y: window.scrollY };
    const r = wrapper.getBoundingClientRect();
    const cs = getComputedStyle(wrapper);
    placeholder = document.createElement('div');
    placeholder.className = 'mdfs-placeholder';
    placeholder.style.height = r.height + 'px';
    placeholder.style.marginBottom = cs.marginBottom;
    wrapper.parentNode.insertBefore(placeholder, wrapper);
    wrapper.classList.add(FS);
    document.documentElement.classList.add('mdfs-lock');
    wrapper.querySelectorAll('.mdfs-btn').forEach((b) => setBtn(b, true));
    resetZoom(wrapper);
  }

  function exit() {
    const w = current;
    if (!w) return;
    current = null;
    w.classList.remove(FS);
    document.documentElement.classList.remove('mdfs-lock');
    if (placeholder) { placeholder.remove(); placeholder = null; }
    w.querySelectorAll('.mdfs-btn').forEach((b) => setBtn(b, false));
    resetZoom(w);
    restoreScroll();
  }

  function makeBtn(wrapper) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mdfs-btn';
    setBtn(btn, wrapper.classList.contains(FS));
    // 阻止冒泡到容器，免得触发官方的拖拽/点击缩放
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (wrapper.classList.contains(FS)) exit(); else enter(wrapper);
    });
    return btn;
  }

  function decorate() {
    for (const w of document.querySelectorAll('.mermaid-wrapper')) {
      if (w.querySelector('.mdfs-btn')) continue;
      const controls = w.querySelector(':scope > .mermaid-zoom-controls');
      if (controls) {
        controls.appendChild(makeBtn(w));
      } else {
        // 用户关掉了官方工具条（markdown-mermaid.controls.show = never）时，单独放一个
        const b = makeBtn(w);
        b.classList.add('mdfs-solo');
        w.appendChild(b);
      }
    }
    if (current && !current.isConnected) {
      current = null;
      document.documentElement.classList.remove('mdfs-lock');
      if (placeholder) { placeholder.remove(); placeholder = null; }
      savedScroll = null;
    }
  }

  // mermaid 是异步渲染的，工具条也是之后才插入，所以监听整棵树
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; decorate(); });
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('vscode.markdown.updateContent', schedule);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) {
      e.preventDefault();
      e.stopPropagation();
      exit();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
})();
