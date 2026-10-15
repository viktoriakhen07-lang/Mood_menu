// Переключатель светлой/тёмной темы. Выбор запоминается в браузере.
(function () {
  var KEY = 'mm-theme';
  var root = document.documentElement;

  function current() { return root.dataset.theme === 'dark' ? 'dark' : 'light'; }

  function apply(t) {
    root.dataset.theme = t;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = t === 'dark' ? '#17100b' : '#f2e7d8';
    var btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      var label = t === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
      btn.setAttribute('aria-label', label);
      btn.title = label;
    }
  }

  function init() {
    var btn = document.getElementById('themeToggle');
    if (!btn) {                                   // на страницах без кнопки в меню — плавающая
      btn = document.createElement('button');
      btn.id = 'themeToggle';
      btn.type = 'button';
      btn.className = 'theme-toggle floating';
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.classList.add('theme-anim');
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      setTimeout(function () { root.classList.remove('theme-anim'); }, 450);
    });
    apply(current());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
