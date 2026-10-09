/* =========================================================================
   MoodMenu — фронтенд страницы гостя.
   Данные берём с сервера: /api/config, /api/menu; подбор — POST /api/recommend,
   чат — POST /api/chat. Аллергены и оценки блюд (👍/👎) хранятся в браузере
   (localStorage) и отправляются на сервер с каждым запросом.
   ========================================================================= */

const $ = s => document.querySelector(s);

// Защита от вставки HTML: названия блюд вводит администратор.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peppers = n => (n > 0 ? "🌶".repeat(n) : "");

// Память браузера: если она недоступна, просто работаем без сохранения.
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ничего */ } },
};

let CONFIG = { moods: [], categories: [], spiceLevels: [], allergens: [] };
let MENU = [];
const state = {
  mood: null, category: "Все", spice: "all",
  allergens: new Set(store.get("mm_allergens")),
  liked: new Set(store.get("mm_liked")),
  disliked: new Set(store.get("mm_disliked")),
};
const saveState = () => {
  store.set("mm_allergens", [...state.allergens]);
  store.set("mm_liked", [...state.liked]);
  store.set("mm_disliked", [...state.disliked]);
};
// Что отправляем на сервер вместе с запросом.
const prefs = () => ({ allergens: [...state.allergens], liked: [...state.liked], disliked: [...state.disliked] });

/* ---------- Карточки блюд ---------- */
// Смайлик блюда (или фото, если администратор его загрузил).
function thumb(d) {
  return d.image
    ? `<img class="thumb-img" src="${esc(d.image)}" alt="${esc(d.name)}" loading="lazy">`
    : `<div class="thumb" aria-hidden="true">${dishEmoji(d)}</div>`;
}

const hitsAllergen = d => (d.allergens || []).some(a => state.allergens.has(a));
const ingHtml = d => (d.ingredients ? `<div class="ing"><b>Состав:</b> ${esc(d.ingredients)}</div>` : "");

function badges(d) {
  const al = d.allergens || [];
  return `<div class="badges">
    <span class="badge">${d.temp === "hot" ? "🔥 горячее" : "❄️ холодное"}</span>
    ${d.sweet ? '<span class="badge">🍬 сладкое</span>' : ""}
    ${d.spice > 0 ? `<span class="badge">${peppers(d.spice)} ${esc(CONFIG.spiceLevels[d.spice] || "")}</span>` : ""}
    ${al.length ? `<span class="badge ${hitsAllergen(d) ? "warn" : ""}">⚠ ${esc(al.join(", "))}</span>` : ""}
  </div>`;
}

// Кнопки 👍/👎 под советом.
function feedbackHtml(d) {
  const l = state.liked.has(d.id), x = state.disliked.has(d.id);
  return `<div class="feedback" data-id="${esc(d.id)}">
    <span>Хороший совет?</span>
    <button type="button" class="fb ${l ? "on" : ""}" data-fb="like" aria-pressed="${l}" aria-label="Нравится">👍</button>
    <button type="button" class="fb ${x ? "on" : ""}" data-fb="dislike" aria-pressed="${x}" aria-label="Не нравится">👎</button>
  </div>`;
}

/* ---------- Настроения ---------- */
function renderMoods() {
  const root = $("#moodChoices");
  root.innerHTML = "";
  CONFIG.moods.forEach(m => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.innerHTML = `<span class="ico">${m.icon}</span>${esc(m.label)}`;
    b.onclick = () => {
      state.mood = m.id;
      [...root.children].forEach(el => el.classList.toggle("active", el === b));
      $("#pickBtn").disabled = false;
    };
    root.appendChild(b);
  });
}

/* ---------- Аллергены: переключатели ---------- */
function renderAllergens() {
  const root = $("#allergyChoices");
  root.innerHTML = (CONFIG.allergens || []).map(a => `
    <label class="switch">
      <input type="checkbox" value="${esc(a.id)}" ${state.allergens.has(a.id) ? "checked" : ""}>
      <span class="track"></span>
      <span class="lbl"><span class="ico">${a.icon}</span>${esc(a.label)}</span>
    </label>`).join("");
  root.querySelectorAll("input").forEach(i => i.onchange = () => {
    i.checked ? state.allergens.add(i.value) : state.allergens.delete(i.value);
    saveState();
    renderMenu();
  });
}

/* ---------- Фильтры меню: категории и острота ---------- */
function renderFilters() {
  const root = $("#filters");
  const cats = ["Все", ...CONFIG.categories.filter(c => MENU.some(d => d.category === c))];
  const spiceOpts = [["all", "Любая острота"], ["0", "Не острое"], ["1", "🌶 Слабо"], ["2", "🌶🌶 Средне"], ["3", "🌶🌶🌶 Очень"]];
  root.innerHTML = cats.map(c => `<button type="button" class="chip sm ${state.category === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")
    + `<select class="select" id="spiceFilter" style="max-width:190px">${spiceOpts.map(([v, l]) => `<option value="${v}" ${state.spice === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  root.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { state.category = b.dataset.cat; renderFilters(); renderMenu(); });
  $("#spiceFilter").onchange = e => { state.spice = e.target.value; renderMenu(); };
}

/* ---------- Меню ---------- */
function renderMenu() {
  const list = MENU.filter(d => d.available !== false
    && (state.category === "Все" || d.category === state.category)
    && (state.spice === "all" || d.spice === Number(state.spice)));
  const cats = [...new Set(list.map(d => d.category))];
  $("#menuRoot").innerHTML = cats.length ? cats.map(cat => `
    <div class="cat">
      <div class="cat-name">${esc(cat)}</div>
      <div class="items">
        ${list.filter(d => d.category === cat).map(d => `
          <div class="item${hitsAllergen(d) ? " blocked" : ""}">${thumb(d)}
            <div>
              <h4>${esc(d.name)}<span class="pep">${peppers(d.spice)}</span></h4>
              <div class="price">${d.price} ₸</div>
              <p>${esc(d.desc)}</p>
              ${ingHtml(d)}
              ${badges(d)}
            </div>
          </div>`).join("")}
      </div>
    </div>`).join("") : '<p class="hint">По этим фильтрам ничего не найдено.</p>';
}

// Карточка рекомендованного блюда (используется и в подборе, и в чате).
function pickCardHtml(d) {
  return `<div class="pick-card">${thumb(d)}
    <div class="meta">
      <div class="name-row"><h3>${esc(d.name)}<span class="pep">${peppers(d.spice)}</span></h3><span class="price">${d.price} ₸</span></div>
      <div class="desc">${esc(d.desc)}</div>
      ${ingHtml(d)}
      <div class="reason">${esc(d.reason)}</div>
      ${badges(d)}
      ${feedbackHtml(d)}
    </div>
  </div>`;
}

/* ---------- Подбор ---------- */
async function runPick(note = "") {
  const btn = $("#pickBtn");
  btn.disabled = true;
  const box = $("#resultBox");
  box.classList.add("show");
  $("#resultStatus").textContent = "Подбираем…";
  $("#pickList").innerHTML = "";
  $("#totalLine").textContent = "";
  $("#resultNote").textContent = "";
  try {
    const r = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: state.mood, budget: $("#budgetInput").value, maxSpice: $("#spiceSelect").value, ...prefs() }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Ошибка сервера");
    if (!data.picks.length) {
      $("#resultStatus").textContent = data.message || "Ничего не нашлось.";
      $("#resultNote").textContent = note;
    } else {
      $("#resultStatus").textContent = data.picks.length > 1 ? "Мы бы предложили такое комбо:" : "Мы бы предложили:";
      $("#pickList").innerHTML = data.picks.map(pickCardHtml).join("");
      if (data.picks.length > 1) $("#totalLine").textContent = `Итого: ${data.total} ₸`;
      $("#resultNote").textContent = (note ? note + " " : "") + (data.source === "ai" ? "Подобрано ИИ." : "Подобрано по правилам настроения.");
    }
  } catch (e) {
    $("#resultStatus").textContent = "Не удалось подобрать: " + e.message;
  }
  btn.disabled = false;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
$("#pickBtn").addEventListener("click", () => runPick());

/* ---------- Оценки 👍/👎 ---------- */
function setFeedback(id, val) {
  state.liked.delete(id);
  state.disliked.delete(id);
  if (val === "like") state.liked.add(id);
  if (val === "dislike") state.disliked.add(id);
  saveState();
}
function markButtons(group, id) {
  group.querySelectorAll(".fb").forEach(x => {
    const on = (x.dataset.fb === "like" ? state.liked : state.disliked).has(id);
    x.classList.toggle("on", on);
    x.setAttribute("aria-pressed", String(on));
  });
}

document.addEventListener("click", e => {
  const b = e.target.closest(".fb");
  if (!b) return;
  const group = b.closest(".feedback");
  const id = group.dataset.id;
  const d = MENU.find(x => x.id === id);
  if (!d) return;
  const val = b.dataset.fb;

  // В чате оценка уходит ИИ сообщением, и он сам отвечает на неё.
  if (b.closest("#chatLog")) {
    if (chatBusy) return;
    setFeedback(id, val);
    markButtons(group, id);
    sendChat(val === "like" ? `👍 Мне понравилось: «${d.name}».` : `👎 Мне не понравилось: «${d.name}». Предложи что-нибудь другое.`);
    return;
  }

  // В обычном подборе: повторное нажатие снимает оценку, 👎 запускает новый подбор без этого блюда.
  const was = (val === "like" ? state.liked : state.disliked).has(id);
  setFeedback(id, was ? null : val);
  markButtons(group, id);
  if (was) return;
  if (val === "dislike") runPick(`Учли оценку: «${d.name}» больше не предлагаем.`);
  else $("#resultNote").textContent = `Спасибо! Запомнили, что вам понравилось «${d.name}».`;
});

$("#resetFb").onclick = () => {
  state.liked.clear();
  state.disliked.clear();
  saveState();
  $("#resetFb").textContent = "Оценки сброшены ✓";
};

/* ---------- Чат с Gemini ----------
   История диалога хранится здесь, в браузере, и целиком отправляется на
   /api/chat вместе с аллергенами и оценками. Сервер ничего не запоминает. */
const chatHistory = [];
let chatBusy = false;

function addBubble(role, text) {
  const el = document.createElement("div");
  el.className = "bubble " + (role === "user" ? "me" : "bot");
  el.textContent = text;
  $("#chatLog").appendChild(el);
  $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
  return el;
}

function startChat() {
  const greeting = "Привет! Я ИИ-официант 👋 Расскажите, как настроение и сколько хотите потратить — подберу что-нибудь вкусное.";
  if (!CONFIG.chatEnabled) {
    addBubble("model", "Чат пока выключен: добавьте GEMINI_API_KEY в файл .env и перезапустите сервер. Подбор по кнопке выше работает и без него.");
    $("#chatInput").disabled = true; $("#chatSend").disabled = true;
    return;
  }
  addBubble("model", greeting);
  chatHistory.push({ role: "model", text: greeting });
}

async function sendChat(text) {
  if (chatBusy || !text) return;
  chatBusy = true;
  const input = $("#chatInput");
  addBubble("user", text);
  chatHistory.push({ role: "user", text });
  $("#chatSend").disabled = true; input.disabled = true;
  const typing = addBubble("model", "…");
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: chatHistory, ...prefs() }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Ошибка сервера");
    typing.textContent = data.reply;
    chatHistory.push({ role: "model", text: data.reply });
    if (data.picks && data.picks.length) {
      const wrap = document.createElement("div");
      wrap.className = "pick-list chat-picks";
      wrap.innerHTML = data.picks.map(pickCardHtml).join("") + (data.picks.length > 1 ? `<div class="total-line">Итого: ${data.total} ₸</div>` : "");
      $("#chatLog").appendChild(wrap);
    }
  } catch (err) {
    typing.textContent = "Не получилось ответить: " + err.message;
    chatHistory.pop(); // убираем неотправленное сообщение, чтобы можно было повторить
  }
  chatBusy = false;
  $("#chatSend").disabled = false; input.disabled = false; input.focus();
  $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
}

$("#chatForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = $("#chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  sendChat(text);
});

/* ---------- Запуск ---------- */
(async function init() {
  [CONFIG, MENU] = await Promise.all([fetch("/api/config").then(r => r.json()), fetch("/api/menu").then(r => r.json())]);
  renderMoods();
  renderAllergens();
  renderFilters();
  renderMenu();
  startChat();
})();
