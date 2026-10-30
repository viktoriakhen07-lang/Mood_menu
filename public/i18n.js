/* MoodMenu — переключатель языка: русский / қазақша / English.
   Как работает: скрипт находит на странице тексты на русском и заменяет их по словарю.
   Новые элементы, которые создаёт app.js / admin.js, переводятся автоматически.
   Названия и описания блюд приходят с сервера (/api/menu-i18n). Что не нашлось в словаре — остаётся по-русски. */
(function () {
  'use strict';
  var KEY = 'mm-lang';
  var LANGS = ['ru', 'kk', 'en'];
  var LABELS = { ru: 'RU', kk: 'ҚАЗ', en: 'EN' };
  var state = { lang: 'ru' };

  /* ---------- Словарь: [русский, қазақша, English] ---------- */
  var ROWS = [
    // Шапка и навигация
    ['MoodMenu — подбор блюда по настроению', 'MoodMenu — көңіл-күйге қарай тағам таңдау', 'MoodMenu — dish picker by mood'],
    ['Навигация', 'Навигация', 'Navigation'],
    ['Подбор', 'Таңдау', 'Picker'],
    ['ИИ-официант', 'ЖИ-даяшы', 'AI waiter'],
    ['Меню', 'Мәзір', 'Menu'],
    ['Админка', 'Әкімші', 'Admin'],
    ['Подберём блюдо под ваше настроение', 'Көңіл-күйіңізге сай тағам таңдаймыз', 'We\u2019ll pick a dish for your mood'],
    ['Скажите, какое у вас настроение и сколько готовы потратить — подберём блюдо из нашего меню.', 'Көңіл-күйіңіз қандай екенін және қанша жұмсауға дайын екеніңізді айтыңыз — біз мәзірімізден тағам таңдап береміз.', 'Tell us your mood and how much you\u2019re ready to spend \u2014 we\u2019ll pick a dish from our menu.'],
    ['Подобрать блюдо', 'Тағам таңдау', 'Find a dish'],
    ['✓ Учитываем аллергии', '✓ Аллергияны ескереміз', '✓ We consider allergies'],
    ['✓ Комбо под ваш бюджет', '✓ Бюджетіңізге сай комбо', '✓ Combos for your budget'],
    ['✓ Советует ИИ-официант', '✓ ЖИ-даяшы кеңес береді', '✓ AI waiter gives advice'],
    // Подбор
    ['Подберите блюдо', 'Тағам таңдаңыз', 'Choose a dish'],
    ['Ответьте на несколько вопросов — остальное сделаем мы.', 'Бірнеше сұраққа жауап беріңіз — қалғанын біз жасаймыз.', 'Answer a few questions \u2014 we\u2019ll do the rest.'],
    ['Какое у вас настроение?', 'Көңіл-күйіңіз қандай?', 'What\u2019s your mood?'],
    ['Сколько готовы потратить?', 'Қанша жұмсауға дайынсыз?', 'How much are you ready to spend?'],
    ['например, 2500', 'мысалы, 2500', 'e.g. 2500'],
    ['Можно оставить пустым — тогда бюджет не учитываем. Если сумма позволяет, предложим комбо.', 'Бос қалдыруға болады — онда бюджетті ескермейміз. Сома жеткілікті болса, комбо ұсынамыз.', 'You can leave it empty \u2014 then we ignore the budget. If the amount allows, we\u2019ll suggest a combo.'],
    ['Как относитесь к острому?', 'Ащы тағамға қатынасыңыз қандай?', 'How do you feel about spicy food?'],
    ['Люблю любое 🌶🌶🌶', 'Кез келгенін жақсы көремін 🌶🌶🌶', 'I like any 🌶🌶🌶'],
    ['До средней остроты 🌶🌶', 'Орташа ащыға дейін 🌶🌶', 'Up to medium spicy 🌶🌶'],
    ['Только слабо острое 🌶', 'Тек аздап ащы 🌶', 'Only mildly spicy 🌶'],
    ['Совсем не острое', 'Мүлдем ащы емес', 'Not spicy at all'],
    ['Есть аллергия? Включите то, что нужно исключить', 'Аллергияңыз бар ма? Алып тастау керек нәрсені қосыңыз', 'Have an allergy? Switch on what to exclude'],
    ['Блюда с отмеченными аллергенами не попадут ни в подбор, ни в советы ИИ. Состав в меню заполняет администратор, при сильной аллергии уточняйте у официанта.', 'Белгіленген аллергендері бар тағамдар таңдауға да, ЖИ кеңестеріне де кірмейді. Мәзірдегі құрамды әкімші толтырады, аллергия күшті болса, даяшыдан нақтылаңыз.', 'Dishes with the selected allergens won\u2019t appear in the picker or AI suggestions. Ingredients are entered by the administrator; with a severe allergy, please check with the waiter.'],
    ['Сбросить мои оценки блюд 👍👎', 'Тағамдарға қойған бағаларымды тазарту 👍👎', 'Reset my dish ratings 👍👎'],
    ['Подбираем…', 'Таңдап жатырмыз…', 'Picking\u2026'],
    // Чат
    ['Поговорить с ИИ-официантом', 'ЖИ-даяшымен сөйлесу', 'Chat with the AI waiter'],
    ['Напишите своими словами, чего хочется — официант предложит блюда и учтёт ваши оценки.', 'Не қалайтыныңызды өз сөзіңізбен жазыңыз — даяшы тағамдар ұсынып, бағаларыңызды ескереді.', 'Write in your own words what you feel like \u2014 the waiter will suggest dishes and take your ratings into account.'],
    ['Напишите, как у вас дела…', 'Жағдайыңыз қалай екенін жазыңыз…', 'Tell us how you\u2019re doing\u2026'],
    ['Отправить', 'Жіберу', 'Send'],
    // Меню
    ['Наше меню', 'Біздің мәзір', 'Our menu'],
    ['Выберите категорию или остроту, чтобы сузить список.', 'Тізімді тарылту үшін санатты немесе ащылық деңгейін таңдаңыз.', 'Choose a category or spice level to narrow the list.'],
    ['Все', 'Барлығы', 'All'],
    ['Любая острота', 'Кез келген ащылық', 'Any spice level'],
    ['Нет в наличии', 'Қолжетімсіз', 'Out of stock'],
    ['нет в наличии', 'қолжетімсіз', 'out of stock'],
    ['Состав:', 'Құрамы:', 'Ingredients:'],
    ['Аллергены:', 'Аллергендер:', 'Allergens:'],
    ['Горячее', 'Ыстық', 'Hot'],
    ['Холодное', 'Суық', 'Cold'],
    ['Сладкое', 'Тәтті', 'Sweet'],
    // Подвал
    ['Сайт подбора блюд по настроению. Учебный проект.', 'Көңіл-күйге қарай тағам таңдау сайты. Оқу жобасы.', 'A mood-based dish picker website. A student project.'],
    ['Разделы', 'Бөлімдер', 'Sections'],
    ['Подбор блюда', 'Тағам таңдау', 'Dish picker'],
    ['Для персонала', 'Қызметкерлерге арналған', 'For staff'],
    // Настроения
    ['Бодрость', 'Сергектік', 'Energy'],
    ['Уют', 'Жайлылық', 'Coziness'],
    ['Свежесть', 'Балғындық', 'Freshness'],
    ['Хочу сладкого', 'Тәтті қалаймын', 'Craving sweets'],
    ['Что-то сытное', 'Тойымды бір нәрсе', 'Something hearty'],
    ['Грустно', 'Көңілсіз', 'Sad'],
    ['Устал(а)', 'Шаршадым', 'Tired'],
    ['Стресс / тревога', 'Стресс / алаңдау', 'Stress / anxiety'],
    ['Злюсь', 'Ашулымын', 'Angry'],
    ['Скучно', 'Жалықтым', 'Bored'],
    // Категории и острота
    ['Напитки', 'Сусындар', 'Drinks'],
    ['Десерты', 'Десерттер', 'Desserts'],
    ['Закуски', 'Тіскебасарлар', 'Starters'],
    ['Супы', 'Сорпалар', 'Soups'],
    ['Основные блюда', 'Негізгі тағамдар', 'Main dishes'],
    ['Не острое', 'Ащы емес', 'Not spicy'],
    ['Слабо острое', 'Аздап ащы', 'Mildly spicy'],
    ['Средне острое', 'Орташа ащы', 'Medium spicy'],
    ['Очень острое', 'Өте ащы', 'Very spicy'],
    // Аллергены
    ['Глютен', 'Глютен', 'Gluten'],
    ['Молоко', 'Сүт', 'Milk'],
    ['Яйца', 'Жұмыртқа', 'Eggs'],
    ['Орехи', 'Жаңғақ', 'Tree nuts'],
    ['Арахис', 'Жержаңғақ', 'Peanuts'],
    ['Рыба', 'Балық', 'Fish'],
    ['Морепродукты', 'Теңіз өнімдері', 'Seafood'],
    ['Соя', 'Соя', 'Soy'],
    ['Мёд', 'Бал', 'Honey'],
    ['Цитрусы', 'Цитрустар', 'Citrus'],
    // Админ-панель
    ['MoodMenu — админка', 'MoodMenu — әкімші панелі', 'MoodMenu \u2014 admin panel'],
    ['← На сайт', '← Сайтқа', '\u2190 To the site'],
    ['Управление меню', 'Мәзірді басқару', 'Menu management'],
    ['Добавляйте блюда, указывайте состав и аллергены, задавайте категорию, остроту и настроения.', 'Тағамдар қосыңыз, құрамы мен аллергендерін көрсетіңіз, санатын, ащылығын және көңіл-күйлерін беріңіз.', 'Add dishes, specify the ingredients and allergens, set the category, spice level and moods.'],
    ['Вход', 'Кіру', 'Log in'],
    ['Пароль администратора', 'Әкімші құпиясөзі', 'Administrator password'],
    ['значение ADMIN_PASSWORD из файла .env', 'ADMIN_PASSWORD мәні (.env файлынан)', 'ADMIN_PASSWORD value from the .env file'],
    ['Войти', 'Кіру', 'Sign in'],
    ['Неверный пароль', 'Құпиясөз қате', 'Wrong password'],
    ['Неверный пароль администратора', 'Әкімші құпиясөзі қате', 'Wrong administrator password'],
    ['Новое блюдо', 'Жаңа тағам', 'New dish'],
    ['Название', 'Атауы', 'Name'],
    ['Цена, ₸', 'Бағасы, ₸', 'Price, \u20B8'],
    ['Описание', 'Сипаттамасы', 'Description'],
    ['Состав (через запятую)', 'Құрамы (үтір арқылы)', 'Ingredients (comma-separated)'],
    ['например: эспрессо, молоко, сахар', 'мысалы: эспрессо, сүт, қант', 'e.g. espresso, milk, sugar'],
    ['Аллергены в блюде', 'Тағамдағы аллергендер', 'Allergens in the dish'],
    ['Категория', 'Санаты', 'Category'],
    ['Острота', 'Ащылығы', 'Spice level'],
    ['0 — не острое', '0 — ащы емес', '0 \u2014 not spicy'],
    ['1 — слабо 🌶', '1 — аздап 🌶', '1 \u2014 mild 🌶'],
    ['2 — средне 🌶🌶', '2 — орташа 🌶🌶', '2 \u2014 medium 🌶🌶'],
    ['3 — очень 🌶🌶🌶', '3 — өте ащы 🌶🌶🌶', '3 \u2014 very spicy 🌶🌶🌶'],
    ['Подача', 'Берілуі', 'Serving'],
    ['Горячее 🔥', 'Ыстық 🔥', 'Hot 🔥'],
    ['Холодное ❄️', 'Суық ❄️', 'Cold ❄️'],
    ['Сладкое 🍬', 'Тәтті 🍬', 'Sweet 🍬'],
    ['В наличии', 'Бар', 'In stock'],
    ['Подходит для настроений', 'Қандай көңіл-күйге сәйкес', 'Suits these moods'],
    ['Фото блюда (необязательно, пока вместо него показывается смайлик)', 'Тағам суреті (міндетті емес, ол болмаса смайлик көрсетіледі)', 'Dish photo (optional; an emoji is shown instead for now)'],
    ['JPG, PNG или WEBP, до 5 МБ.', 'JPG, PNG немесе WEBP, 5 МБ-қа дейін.', 'JPG, PNG or WEBP, up to 5 MB.'],
    ['Удалить текущее фото', 'Қазіргі суретті жою', 'Delete the current photo'],
    ['Сохранить', 'Сақтау', 'Save'],
    ['Отмена', 'Бас тарту', 'Cancel'],
    ['Блюда в меню', 'Мәзірдегі тағамдар', 'Dishes on the menu'],
    ['Изменить', 'Өзгерту', 'Edit'],
    ['Редактировать', 'Өңдеу', 'Edit'],
    ['Удалить', 'Жою', 'Delete']
  ];

  var PATTERNS = [
    [/^Итого:?\s*(.+)$/, { kk: 'Барлығы: $1', en: 'Total: $1' }]
  ];

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  var DICT = Object.create(null);
  ROWS.forEach(function (r) { DICT[norm(r[0])] = { kk: r[1], en: r[2] }; });
  var dyn = { kk: Object.create(null), en: Object.create(null) }; // названия, описания и составы блюд с сервера

  function translate(src, lang) {
    var core = norm(src);
    if (!core) return null;
    var out = null;
    if (DICT[core]) out = DICT[core][lang];
    else if (dyn[lang][core]) out = dyn[lang][core];
    else {
      for (var i = 0; i < PATTERNS.length; i++) {
        var m = core.match(PATTERNS[i][0]);
        if (m) { out = core.replace(PATTERNS[i][0], PATTERNS[i][1][lang]); break; }
      }
    }
    if (!out) return null;
    var w = src.match(/^(\s*)[\s\S]*?(\s*)$/);
    return w[1] + out + w[2];
  }

  /* ---------- Замена текста и атрибутов с запоминанием оригинала ---------- */
  var textRec = new WeakMap();
  var attrRec = new WeakMap();
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  var SKIP_SEL = '[data-no-i18n], .bubble.me, .lang-switch';

  function skipped(el) {
    return !el || SKIP_TAGS[el.nodeName] || (el.closest && el.closest(SKIP_SEL));
  }

  function processText(node) {
    var parent = node.parentNode;
    if (!parent || skipped(parent)) return;
    var rec = textRec.get(node);
    var cur = node.data;
    var src = rec && cur === rec.out ? rec.src : cur;
    var out = state.lang === 'ru' ? src : (translate(src, state.lang) || src);
    if (!rec && out === cur) return;
    if (out !== cur) node.data = out;
    textRec.set(node, { src: src, out: out });
  }

  function processAttr(el, name) {
    if (!el.getAttribute || skipped(el) || !el.hasAttribute(name)) return;
    var map = attrRec.get(el);
    if (!map) { map = {}; attrRec.set(el, map); }
    var rec = map[name];
    var cur = el.getAttribute(name);
    var src = rec && cur === rec.out ? rec.src : cur;
    var out = state.lang === 'ru' ? src : (translate(src, state.lang) || src);
    if (!rec && out === cur) return;
    if (out !== cur) el.setAttribute(name, out);
    map[name] = { src: src, out: out };
  }

  function processElementAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) processAttr(el, ATTRS[i]);
  }

  function walk(root) {
    if (root.nodeType === 3) { processText(root); return; }
    if (root.nodeType !== 1 || SKIP_TAGS[root.nodeName]) return;
    processElementAttrs(root);
    var tw = document.createTreeWalker(root, 1 | 4, null);
    var n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) processText(n);
      else if (!SKIP_TAGS[n.nodeName]) processElementAttrs(n);
    }
  }

  function fullPass() { walk(document.documentElement); }

  /* ---------- Переводы блюд с сервера ---------- */
  function loadDishes(lang) {
    if (lang === 'ru') return Promise.resolve();
    return fetch('/api/menu-i18n?lang=' + lang)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        (d.items || []).forEach(function (it) {
          ['name', 'desc', 'ingredients'].forEach(function (f) {
            var s = it.ru && it.ru[f], t = it.tr && it.tr[f];
            if (s && t) dyn[lang][norm(s)] = t;
          });
        });
      })
      .catch(function () { /* без перевода блюд остаётся русский текст */ });
  }

  /* ---------- Переключатель ---------- */
  var switchEl = null;

  function updateButtons() {
    if (!switchEl) return;
    var btns = switchEl.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-lang') === state.lang ? 'true' : 'false');
    }
  }

  function setLang(lang, save) {
    if (LANGS.indexOf(lang) < 0) lang = 'ru';
    state.lang = lang;
    document.documentElement.lang = lang;
    if (save) { try { localStorage.setItem(KEY, lang); } catch (e) {} }
    fullPass();
    updateButtons();
    if (lang !== 'ru') {
      loadDishes(lang).then(function () { if (state.lang === lang) fullPass(); });
    }
  }

  function buildSwitch() {
    switchEl = document.createElement('div');
    switchEl.className = 'lang-switch';
    switchEl.setAttribute('role', 'group');
    switchEl.setAttribute('aria-label', 'Language');
    LANGS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-lang', l);
      b.textContent = LABELS[l];
      b.addEventListener('click', function () { setLang(l, true); });
      switchEl.appendChild(b);
    });
    var nav = document.querySelector('.navlinks');
    if (nav) {
      var anchor = document.getElementById('themeToggle') || nav.querySelector('.nav-btn');
      nav.insertBefore(switchEl, anchor || null);
    } else {
      switchEl.classList.add('floating');
      document.body.appendChild(switchEl);
    }
  }

  function detect() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (LANGS.indexOf(saved) >= 0) return saved;
    var nav = String(navigator.language || '').toLowerCase();
    if (nav.indexOf('kk') === 0) return 'kk';
    if (nav.indexOf('en') === 0) return 'en';
    return 'ru';
  }

  /* Добавляем выбранный язык в запросы чата и подбора, чтобы ИИ отвечал на нём. */
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (init && typeof init.body === 'string' && /\/api\/(chat|recommend)/.test(url)) {
          var b = JSON.parse(init.body);
          if (b && typeof b === 'object' && !Array.isArray(b)) {
            b.lang = state.lang;
            init = Object.assign({}, init, { body: JSON.stringify(b) });
          }
        }
      } catch (e) { /* отправляем как есть */ }
      return origFetch(input, init);
    };
  }

  function init() {
    buildSwitch();
    var obs = new MutationObserver(function (list) {
      if (state.lang === 'ru') return;
      list.forEach(function (m) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') processText(m.target);
        else if (m.type === 'attributes') processAttr(m.target, m.attributeName);
      });
    });
    obs.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
    setLang(detect(), false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
