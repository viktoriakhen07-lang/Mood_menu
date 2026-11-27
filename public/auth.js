/* MoodMenu — аккаунты гостей: вход, регистрация, профиль (аллергены, заметки о вкусах, оценки).
   Работает поверх существующего сайта: app.js не меняется. Профиль сохраняется на сервере. */
(function () {
  'use strict';
  var state = { user: null, open: false, registrationOpen: true, allergens: [] };
  var el = {};

  function api(method, url, body) {
    return fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || 'Ошибка'); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  function h(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  /* ---------- Кнопка в меню ---------- */
  function updateNavButton() {
    if (!el.btn) return;
    el.btn.textContent = '';
    if (state.user) {
      el.btn.appendChild(h('span', { 'aria-hidden': 'true', text: '👤 ' }));
      el.btn.appendChild(h('span', { 'data-no-i18n': '', text: state.user.name }));
    } else {
      el.btn.textContent = 'Войти';
    }
    if (el.hint) el.hint.style.display = state.user ? 'none' : '';
  }

  /* ---------- Модальное окно ---------- */
  function close() {
    state.open = false;
    if (el.overlay) { el.overlay.remove(); el.overlay = null; }
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function open(view) {
    close();
    state.open = true;
    el.overlay = h('div', { class: 'auth-overlay', onclick: function (e) { if (e.target === el.overlay) close(); } });
    el.card = h('div', { class: 'auth-card', role: 'dialog', 'aria-modal': 'true' });
    el.overlay.appendChild(el.card);
    document.body.appendChild(el.overlay);
    document.addEventListener('keydown', onKey);
    render(view);
  }

  function render(view) {
    if (!el.card) return;
    el.card.textContent = '';
    el.card.appendChild(h('button', { class: 'auth-x', type: 'button', 'aria-label': 'Закрыть', text: '×', onclick: close }));
    if (state.user) renderProfile(); else renderAuth(view || 'login');
  }

  function msgBox() { return h('div', { class: 'auth-msg', role: 'status' }); }
  function setMsg(box, text, ok) { box.textContent = text || ''; box.className = 'auth-msg' + (ok ? ' ok' : ''); }
  function field(label, input) { return h('label', { class: 'auth-f' }, [h('span', { text: label }), input]); }

  /* ----- вход / регистрация ----- */
  function renderAuth(view) {
    var isReg = view === 'register';
    var msg = msgBox();
    var name = h('input', { class: 'auth-input', type: 'text', maxlength: '40', autocomplete: 'name' });
    var email = h('input', { class: 'auth-input', type: 'email', autocomplete: 'email', maxlength: '254' });
    var pass = h('input', { class: 'auth-input', type: 'password', autocomplete: isReg ? 'new-password' : 'current-password', maxlength: '100' });
    var consent = h('input', { type: 'checkbox' });
    var submit = h('button', { class: 'auth-btn-main', type: 'submit', text: isReg ? 'Зарегистрироваться' : 'Войти' });

    var form = h('form', { class: 'auth-form', novalidate: '' }, [
      h('h3', { text: isReg ? 'Создать аккаунт' : 'Вход в аккаунт' }),
      h('p', { class: 'auth-sub', text: isReg
        ? 'Аккаунт нужен, чтобы ИИ-официант помнил ваши вкусы и аллергены на любом устройстве.'
        : 'Войдите, чтобы ИИ-официант учитывал ваши предпочтения.' }),
      isReg ? field('Имя', name) : null,
      field('Email', email),
      field('Пароль (не короче 8 символов)', pass),
      isReg ? h('label', { class: 'auth-check' }, [consent, h('span', { text: 'Согласен(на) на хранение email, имени, аллергенов и заметок о вкусах. Эти данные передаются ИИ-сервису при подборе блюд.' })]) : null,
      msg, submit,
      h('button', { class: 'auth-link', type: 'button', onclick: function () { render(isReg ? 'login' : 'register'); },
        text: isReg ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться' })
    ]);

    if (isReg && !state.registrationOpen) setMsg(msg, 'Регистрация временно недоступна. Попробуйте позже.');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (isReg && !consent.checked) { setMsg(msg, 'Нужно согласие на хранение данных профиля'); return; }
      submit.disabled = true;
      setMsg(msg, 'Подождите…', true);
      var body = isReg
        ? { name: name.value, email: email.value, password: pass.value, consent: consent.checked }
        : { email: email.value, password: pass.value };
      api('POST', isReg ? '/api/auth/register' : '/api/auth/login', body)
        .then(function (d) { state.user = d.user; updateNavButton(); render(); })
        .catch(function (err) { setMsg(msg, err.message); submit.disabled = false; });
    });
    el.card.appendChild(form);
    setTimeout(function () { (isReg ? name : email).focus(); }, 30);
  }

  /* ----- профиль ----- */
  function applyUser(d) { state.user = d.user; updateNavButton(); }

  function renderProfile() {
    var u = state.user;
    var root = h('div', { class: 'auth-profile' });

    root.appendChild(h('h3', {}, [h('span', { text: 'Здравствуйте, ' }), h('span', { 'data-no-i18n': '', text: u.name }), h('span', { text: '!' })]));
    root.appendChild(h('p', { class: 'auth-sub', 'data-no-i18n': '', text: u.email }));

    // аллергены
    var allMsg = msgBox();
    var chips = h('div', { class: 'auth-chips' });
    state.allergens.forEach(function (a) {
      var cb = h('input', { type: 'checkbox' });
      cb.checked = u.prefs.allergens.indexOf(a.id) >= 0;
      cb.addEventListener('change', function () {
        var list = [].slice.call(chips.querySelectorAll('input')).map(function (x, i) { return x.checked ? state.allergens[i].id : null; }).filter(Boolean);
        api('PUT', '/api/me/profile', { allergens: list }).then(function (d) { applyUser(d); setMsg(allMsg, 'Сохранено', true); })
          .catch(function (err) { setMsg(allMsg, err.message); });
      });
      chips.appendChild(h('label', { class: 'auth-chip' }, [cb, h('span', { text: a.icon + ' ' }), h('span', { text: a.label })]));
    });
    root.appendChild(h('h4', { text: 'Мои аллергены' }));
    root.appendChild(h('p', { class: 'auth-sub', text: 'Блюда с этими аллергенами не попадут в подбор и советы ИИ — на любом устройстве.' }));
    root.appendChild(chips); root.appendChild(allMsg);

    // заметки о вкусах
    var noteMsg = msgBox();
    var noteList = h('ul', { class: 'auth-notes', 'data-no-i18n': '' });
    u.prefs.notes.forEach(function (n) {
      noteList.appendChild(h('li', {}, [
        h('span', { text: n.text }),
        h('button', { type: 'button', class: 'auth-del', 'aria-label': 'Удалить', text: '×', onclick: function () {
          api('DELETE', '/api/me/notes/' + encodeURIComponent(n.id)).then(function (d) { applyUser(d); render(); })
            .catch(function (err) { setMsg(noteMsg, err.message); });
        } })
      ]));
    });
    var noteInput = h('textarea', { class: 'auth-input', rows: '2', maxlength: '200', placeholder: 'Например: люблю сладкое, не ем кинзу, предпочитаю не острое' });
    root.appendChild(h('h4', { text: 'Мои вкусы и отзывы для ИИ-официанта' }));
    root.appendChild(h('p', { class: 'auth-sub', text: 'ИИ-официант учитывает эти заметки при каждом подборе. В чате можно просто написать «запомни, что я не люблю острое» — он сохранит предпочтение сам.' }));
    if (u.prefs.notes.length) root.appendChild(noteList);
    root.appendChild(noteInput);
    root.appendChild(h('div', { class: 'auth-row' }, [
      h('button', { class: 'auth-btn-main', type: 'button', text: 'Сохранить заметку', onclick: function () {
        if (!noteInput.value.trim()) { setMsg(noteMsg, 'Введите заметку'); return; }
        api('POST', '/api/me/notes', { text: noteInput.value }).then(function (d) { applyUser(d); render(); })
          .catch(function (err) { setMsg(noteMsg, err.message); });
      } })
    ]));
    root.appendChild(noteMsg);

    // оценки
    var rateMsg = msgBox();
    root.appendChild(h('h4', { text: 'Мои оценки блюд' }));
    root.appendChild(h('p', { class: 'auth-sub' }, [
      h('span', { text: 'Понравилось: ' }), h('span', { 'data-no-i18n': '', text: String(u.prefs.likedCount) }),
      h('span', { text: ' · Не понравилось: ' }), h('span', { 'data-no-i18n': '', text: String(u.prefs.dislikedCount) })
    ]));
    root.appendChild(h('button', { class: 'auth-btn-ghost', type: 'button', text: 'Сбросить оценки в аккаунте', onclick: function () {
      api('POST', '/api/me/ratings/reset').then(function (d) { applyUser(d); render(); }).catch(function (err) { setMsg(rateMsg, err.message); });
    } }));
    root.appendChild(rateMsg);

    // выход и удаление
    var delMsg = msgBox();
    var delPass = h('input', { class: 'auth-input', type: 'password', autocomplete: 'current-password', placeholder: 'Пароль для подтверждения' });
    var delBox = h('div', { class: 'auth-del-box', style: 'display:none' }, [
      h('p', { class: 'auth-sub', text: 'Аккаунт, аллергены, заметки и оценки будут удалены безвозвратно.' }),
      delPass,
      h('button', { class: 'auth-btn-danger', type: 'button', text: 'Удалить навсегда', onclick: function () {
        api('DELETE', '/api/me', { password: delPass.value }).then(function () { state.user = null; updateNavButton(); close(); })
          .catch(function (err) { setMsg(delMsg, err.message); });
      } }),
      delMsg
    ]);
    root.appendChild(h('div', { class: 'auth-foot' }, [
      h('button', { class: 'auth-btn-ghost', type: 'button', text: 'Выйти', onclick: function () {
        api('POST', '/api/auth/logout').then(function () { state.user = null; updateNavButton(); close(); });
      } }),
      h('button', { class: 'auth-link', type: 'button', text: 'Удалить аккаунт', onclick: function () { delBox.style.display = ''; } })
    ]));
    root.appendChild(delBox);
    el.card.appendChild(root);
  }

  /* ---------- Подсказка в разделе чата ---------- */
  function buildHint() {
    var chat = document.getElementById('chat');
    var box = chat && chat.querySelector('.chat-box');
    if (!box) return;
    el.hint = h('div', { class: 'auth-hint' }, [
      h('span', { text: 'Войдите, чтобы ИИ-официант запоминал ваши вкусы и аллергены.' }),
      h('button', { type: 'button', class: 'auth-link', text: 'Войти или зарегистрироваться', onclick: function () { open('login'); } })
    ]);
    box.parentNode.insertBefore(el.hint, box);
  }

  /* ---------- Уведомление «ИИ запомнил» ---------- */
  function toast(note) {
    var t = h('div', { class: 'auth-toast', role: 'status' }, [
      h('span', { text: '🧠 Запомнила: ' }), h('span', { 'data-no-i18n': '', text: note })
    ]);
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 20);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 400); }, 5000);
  }

  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var p = origFetch(input, init);
      if (/\/api\/chat/.test(url)) {
        p.then(function (r) {
          r.clone().json().then(function (d) {
            if (d && d.remembered && state.user) {
              toast(d.remembered);
              api('GET', '/api/auth/me').then(function (m) { if (m.user) { state.user = m.user; if (state.open) render(); } }).catch(function () {});
            }
          }).catch(function () {});
        }).catch(function () {});
      }
      return p;
    };
  }

  /* ---------- Старт ---------- */
  function init() {
    var nav = document.querySelector('.navlinks');
    el.btn = h('button', { type: 'button', class: 'auth-nav-btn', onclick: function () { open(state.user ? undefined : 'login'); } });
    if (nav) {
      var anchor = nav.querySelector('.lang-switch') || document.getElementById('themeToggle') || nav.querySelector('.nav-btn');
      nav.insertBefore(el.btn, anchor || null);
    } else {
      el.btn.classList.add('floating');
      document.body.appendChild(el.btn);
    }
    buildHint();
    updateNavButton();

    // «Сбросить мои оценки» на странице сбрасывает и оценки в аккаунте
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('#resetFb');
      if (t && state.user) api('POST', '/api/me/ratings/reset').then(applyUser).catch(function () {});
    }, true);

    api('GET', '/api/config').then(function (c) { state.allergens = c.allergens || []; }).catch(function () {});
    api('GET', '/api/auth/me').then(function (d) { state.user = d.user; state.registrationOpen = d.registrationOpen !== false; updateNavButton(); }).catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
