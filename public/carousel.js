/* =========================================================================
   Карусель для меню: превращает каждый список блюд (.items) в ленту.
   Стрелки, точки, свайп пальцем, автопрокрутка по кругу.
   app.js не трогаем: скрипт следит за #menuRoot и подключается сам,
   когда меню перерисовывается (смена фильтров, аллергенов и т.д.).
   ========================================================================= */
(function () {
  const root = document.getElementById("menuRoot");
  if (!root) return;

  const AUTOPLAY_MS = 3500;
  const GAP = 18;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const maxScroll = el => el.scrollWidth - el.clientWidth;
  const stepOf = el => (el.firstElementChild ? el.firstElementChild.offsetWidth + GAP : el.clientWidth);

  function go(items, dir) {
    const max = maxScroll(items);
    if (dir > 0) {
      if (items.scrollLeft >= max - 4) items.scrollTo({ left: 0, behavior: "smooth" });
      else items.scrollBy({ left: stepOf(items), behavior: "smooth" });
    } else {
      if (items.scrollLeft <= 4) items.scrollTo({ left: max, behavior: "smooth" });
      else items.scrollBy({ left: -stepOf(items), behavior: "smooth" });
    }
  }

  function setup(items) {
    if (items.dataset.carousel) return;
    items.dataset.carousel = "1";

    const wrap = document.createElement("div");
    wrap.className = "carousel";
    items.parentNode.insertBefore(wrap, items);
    wrap.appendChild(items);

    const mkArrow = (cls, label, glyph) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "car-arrow " + cls;
      b.setAttribute("aria-label", label);
      b.textContent = glyph;
      return b;
    };
    const prev = mkArrow("prev", "Назад", "‹");
    const next = mkArrow("next", "Вперёд", "›");
    const dots = document.createElement("div");
    dots.className = "car-dots";
    wrap.append(prev, next, dots);

    prev.onclick = () => go(items, -1);
    next.onclick = () => go(items, 1);

    let pages = 1;
    function buildDots() {
      const fits = maxScroll(items) <= 2;
      wrap.classList.toggle("static", fits);
      if (fits) { dots.innerHTML = ""; pages = 1; return; }
      pages = Math.max(2, Math.ceil(items.scrollWidth / items.clientWidth - 0.05));
      dots.innerHTML = "";
      for (let i = 0; i < pages; i++) {
        const d = document.createElement("button");
        d.type = "button";
        d.className = "car-dot";
        d.setAttribute("aria-label", "Страница " + (i + 1));
        d.onclick = () => items.scrollTo({ left: (maxScroll(items) * i) / (pages - 1), behavior: "smooth" });
        dots.appendChild(d);
      }
      updateDots();
    }
    function updateDots() {
      const max = maxScroll(items);
      if (max <= 2 || pages < 2) return;
      const idx = Math.round((items.scrollLeft / max) * (pages - 1));
      [...dots.children].forEach((d, i) => d.classList.toggle("on", i === idx));
    }
    let raf = 0;
    items.addEventListener("scroll", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateDots);
    }, { passive: true });

    // Автопрокрутка останавливается, пока гость наводит мышь, касается или фокусируется.
    const pause = () => { wrap.dataset.paused = "1"; };
    const resume = () => { delete wrap.dataset.paused; };
    wrap.addEventListener("mouseenter", pause);
    wrap.addEventListener("mouseleave", resume);
    wrap.addEventListener("focusin", pause);
    wrap.addEventListener("focusout", resume);
    wrap.addEventListener("touchstart", pause, { passive: true });
    wrap.addEventListener("touchend", () => setTimeout(resume, 4000), { passive: true });

    if ("ResizeObserver" in window) new ResizeObserver(buildDots).observe(items);
    buildDots();
  }

  function scan() { root.querySelectorAll(".items").forEach(setup); }
  new MutationObserver(scan).observe(root, { childList: true });
  scan();

  // Одна общая «пружина» для всех лент на странице.
  if (!reduceMotion) {
    setInterval(() => {
      if (document.hidden) return;
      document.querySelectorAll(".carousel:not(.static)").forEach(wrap => {
        if (wrap.dataset.paused) return;
        const r = wrap.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return; // не на экране, не крутим
        go(wrap.querySelector(".items"), 1);
      });
    }, AUTOPLAY_MS);
  }
})();
