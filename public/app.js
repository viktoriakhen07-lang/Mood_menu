/* =========================================================================
   MoodMenu — фронтенд страницы гостя.
   Всё данные берём с сервера: /api/config (настроения, категории),
   /api/menu (меню), а подбор делает POST /api/recommend.
   ========================================================================= */

const $ = s => document.querySelector(s);

// Защита от вставки HTML: названия блюд вводит администратор.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peppers = n => (n > 0 ? "🌶".repeat(n) : "");

let CONFIG = { moods: [], categories: [], spiceLevels: [] };
let MENU = [];
const state = { mood: null, category: "Все", spice: "all" };

// Фото блюда или заглушка с первой буквой, если фото ещё не загружено.
function thumb(d) {
  return d.image
    ? `<img class="thumb-img" src="${esc(d.image)}" alt="${esc(d.name)}" loading="lazy">`
    : `<div class="thumb">${esc(d.name.charAt(0).toUpperCase())}</div>`;
}

function badges(d) {
  return `<div class="badges">
    <span class="badge">${d.temp === "hot" ? "🔥 горячее" : "❄️ холодное"}</span>
    ${d.sweet ? '<span class="badge">🍬 сладкое</span>' : ""}
    ${d.spice > 0 ? `<span class="badge">${peppers(d.spice)} ${esc(CONFIG.spiceLevels[d.spice] || "")}</span>` : ""}
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
          <div class="item">${thumb(d)}
            <div>
              <h4>${esc(d.name)}<span class="pep">${peppers(d.spice)}</span></h4>
              <div class="price">${d.price} ₸</div>
              <p>${esc(d.desc)}</p>
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
      <div class="reason">${esc(d.reason)}</div>
      ${badges(d)}
    </div>
  </div>`;
}

/* ---------- Подбор ---------- */
$("#pickBtn").addEventListener("click", async () => {
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
      body: JSON.stringify({ mood: state.mood, budget: $("#budgetInput").value, maxSpice: $("#spiceSelect").value }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Ошибка сервера");

    if (!data.picks.length) {
      $("#resultStatus").textContent = data.message || "Ничего не нашлось.";
    } else {
      $("#resultStatus").textContent = data.picks.length > 1 ? "Мы бы предложили такое комбо:" : "Мы бы предложили:";
      $("#pickList").innerHTML = data.picks.map(pickCardHtml).join("");
      if (data.picks.length > 1) $("#totalLine").textContent = `Итого: ${data.total} ₸`;
      $("#resultNote").textContent = data.source === "ai" ? "Подобрано ИИ." : "Подобрано по правилам настроения.";
    }
  } catch (e) {
    $("#resultStatus").textContent = "Не удалось подобрать: " + e.message;
  }
  btn.disabled = false;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
});


/* ---------- Чат с Gemini ----------
   История диалога хранится здесь, в браузере, и целиком отправляется на
   /api/chat при каждом сообщении — сервер ничего не запоминает между запросами.
   Как только ИИ решает, что информации достаточно, в ответе приходят блюда
   (picks), и мы показываем их карточками прямо под его репликой. */
const chatHistory = [];
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
$("#chatForm").addEventListener("submit", async e => {
  e.preventDefault();
  const input = $("#chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addBubble("user", text);
  chatHistory.push({ role: "user", text });
  $("#chatSend").disabled = true; input.disabled = true;
  const typing = addBubble("model", "…");
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: chatHistory }) });
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
  $("#chatSend").disabled = false; input.disabled = false; input.focus();
  $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
});

/* ---------- Запуск ---------- */
(async function init() {
  [CONFIG, MENU] = await Promise.all([fetch("/api/config").then(r => r.json()), fetch("/api/menu").then(r => r.json())]);
  renderMoods();
  renderFilters();
  renderMenu();
  startChat();
})();
