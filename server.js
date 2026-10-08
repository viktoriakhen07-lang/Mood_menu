/* =========================================================================
   MoodMenu — бэкенд (Node.js + Express)

   Что делает сервер:
   1. Отдаёт сайт из папки /public и загруженные фото из /uploads.
   2. Хранит меню в файле data/menu.json (без базы данных — для учебного
      проекта этого достаточно).
   3. API для администратора: добавить / изменить / удалить блюдо и
      загрузить его фото (защищено паролем ADMIN_PASSWORD).
   4. API подбора блюд POST /api/recommend:
        - отбирает блюда по бюджету и допустимой остроте;
        - считает баллы по правилам настроения (MOODS ниже);
        - просит Claude выбрать лучшие 1–3 позиции (ключ API лежит ТОЛЬКО
          на сервере, в .env — в браузер он никогда не попадает);
        - если ключа нет или ИИ не ответил — берёт лучшие по баллам.
   ========================================================================= */

require("dotenv").config();
const { setGlobalDispatcher, Agent } = require("undici");
setGlobalDispatcher(new Agent({ connect: { family: 4, timeout: 30000 } }));
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const DATA_FILE = path.join(__dirname, "data", "menu.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- Справочники --------------------------------------------------
   Настроения. `rule` — функция, которая выставляет блюду баллы под это
   настроение; `hint` — подсказка для ИИ. Чтобы добавить новое настроение,
   достаточно дописать сюда ещё одну строку (и тег в блюдах, если нужно).
*/
const MOODS = [
  { id: "бодрость", label: "Бодрость", icon: "⚡", hint: "хочется взбодриться: кофеин, яркие вкусы, лёгкая острота",
    rule: d => (d.category === "Напитки" ? 1 : 0) + (d.spice === 1 ? 1 : 0) },
  { id: "уют", label: "Уют", icon: "🕯️", hint: "тепло и мягкость: горячие, сливочные, нежные блюда",
    rule: d => (d.temp === "hot" ? 2 : 0) + (d.spice === 0 ? 1 : 0) },
  { id: "свежесть", label: "Свежесть", icon: "🌿", hint: "лёгкое и прохладное: холодные напитки, фрукты, цитрус",
    rule: d => (d.temp === "cold" ? 2 : 0) + (d.spice === 0 ? 1 : 0) },
  { id: "сладкое", label: "Хочу сладкого", icon: "🍰", hint: "десерты и сладкие напитки",
    rule: d => (d.sweet ? 3 : 0) },
  { id: "сытно", label: "Что-то сытное", icon: "🍽️", hint: "плотные блюда: основные блюда, супы, закуски",
    rule: d => (["Основные блюда", "Супы", "Закуски"].includes(d.category) ? 3 : 0) },
  { id: "грустно", label: "Грустно", icon: "💧", hint: "нужно утешение: СЛАДКОЕ или ГОРЯЧИЕ блюда, без сильной остроты",
    rule: d => (d.sweet ? 3 : 0) + (d.temp === "hot" ? 2 : 0) - (d.spice >= 2 ? 3 : 0) },
  { id: "устал", label: "Устал(а)", icon: "😮‍💨", hint: "силы на нуле: горячее и сытное, можно кофеин",
    rule: d => (d.temp === "hot" ? 2 : 0) + (["Основные блюда", "Супы"].includes(d.category) ? 2 : 0) - (d.spice >= 3 ? 2 : 0) },
  { id: "стресс", label: "Стресс / тревога", icon: "😣", hint: "нужно успокоиться: тёплые мягкие напитки и лёгкая еда, не острое",
    rule: d => (d.temp === "hot" && d.category === "Напитки" ? 2 : 0) + (d.spice === 0 ? 2 : -2) },
  { id: "злюсь", label: "Злюсь", icon: "😤", hint: "выпустить пар (острое уровня 2–3) или остыть (холодный напиток)",
    rule: d => (d.spice >= 2 ? 3 : 0) + (d.temp === "cold" && d.category === "Напитки" ? 2 : 0) },
  { id: "скучно", label: "Скучно", icon: "🥱", hint: "хочется чего-то яркого и необычного, подойдёт острое",
    rule: d => (d.spice >= 1 ? 2 : 0) },
];
const MOOD_IDS = MOODS.map(m => m.id);
const CATEGORIES = ["Напитки", "Десерты", "Закуски", "Супы", "Основные блюда"];
const SPICE_LEVELS = ["Не острое", "Слабо острое", "Средне острое", "Очень острое"];

/* ---------- Работа с файлом меню ---------------------------------------- */
const readMenu = () => JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const writeMenu = menu => fs.writeFileSync(DATA_FILE, JSON.stringify(menu, null, 2), "utf8");

/* ---------- Загрузка фото (multer) --------------------------------------
   Принимаем только jpg/png/webp до 5 МБ. Файл сохраняется под случайным
   именем в /uploads, а в меню записывается путь вида /uploads/abc123.jpg.
*/
const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(8).toString("hex") + EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(EXT[file.mimetype] ? null : new Error("Только JPG, PNG или WEBP"), !!EXT[file.mimetype]),
});

function removeImageFile(imagePath) {
  if (!imagePath || !imagePath.startsWith("/uploads/")) return;
  const file = path.join(UPLOAD_DIR, path.basename(imagePath));
  fs.unlink(file, () => {});
}

/* ---------- Проверка администратора ------------------------------------- */
function requireAdmin(req, res, next) {
  if (req.get("x-admin-password") !== ADMIN_PASSWORD) return res.status(401).json({ error: "Неверный пароль администратора" });
  next();
}

/* ---------- Приведение данных формы к виду блюда ------------------------ */
function parseDish(body) {
  const name = String(body.name || "").trim();
  const price = Number(body.price);
  if (!name) throw new Error("Укажите название блюда");
  if (!Number.isFinite(price) || price < 0) throw new Error("Укажите корректную цену");
  const category = CATEGORIES.includes(body.category) ? body.category : CATEGORIES[0];
  let tags = body.tags;
  if (typeof tags === "string") { try { tags = JSON.parse(tags); } catch { tags = tags.split(","); } }
  tags = (Array.isArray(tags) ? tags : []).map(t => String(t).trim()).filter(t => MOOD_IDS.includes(t));
  return {
    name,
    desc: String(body.desc || "").trim(),
    price: Math.round(price),
    category,
    spice: Math.min(3, Math.max(0, parseInt(body.spice, 10) || 0)),
    temp: body.temp === "cold" ? "cold" : "hot",
    sweet: body.sweet === true || body.sweet === "true" || body.sweet === "on",
    tags,
    available: body.available === undefined ? true : !(body.available === false || body.available === "false"),
  };
}

const app = express();
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, "public")));

/* ---------- API: справочники и меню ------------------------------------- */
app.get("/api/config", (req, res) => {
  res.json({
    moods: MOODS.map(({ id, label, icon }) => ({ id, label, icon })),
    categories: CATEGORIES,
    spiceLevels: SPICE_LEVELS,
    aiEnabled: !!API_KEY,
    chatEnabled: !!GEMINI_KEY,
  });
});

app.get("/api/menu", (req, res) => res.json(readMenu()));

app.post("/api/admin/check", requireAdmin, (req, res) => res.json({ ok: true }));

app.post("/api/menu", requireAdmin, upload.single("photo"), (req, res) => {
  try {
    const dish = { id: crypto.randomBytes(5).toString("hex"), ...parseDish(req.body), image: req.file ? "/uploads/" + req.file.filename : null };
    const menu = readMenu();
    menu.push(dish);
    writeMenu(menu);
    res.status(201).json(dish);
  } catch (e) {
    if (req.file) removeImageFile("/uploads/" + req.file.filename);
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/menu/:id", requireAdmin, upload.single("photo"), (req, res) => {
  try {
    const menu = readMenu();
    const i = menu.findIndex(d => d.id === req.params.id);
    if (i < 0) throw new Error("Блюдо не найдено");
    const old = menu[i];
    let image = old.image;
    if (req.file) { removeImageFile(old.image); image = "/uploads/" + req.file.filename; }
    else if (req.body.removePhoto === "true") { removeImageFile(old.image); image = null; }
    menu[i] = { ...old, ...parseDish(req.body), id: old.id, image };
    writeMenu(menu);
    res.json(menu[i]);
  } catch (e) {
    if (req.file) removeImageFile("/uploads/" + req.file.filename);
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/menu/:id", requireAdmin, (req, res) => {
  const menu = readMenu();
  const dish = menu.find(d => d.id === req.params.id);
  if (!dish) return res.status(404).json({ error: "Блюдо не найдено" });
  removeImageFile(dish.image);
  writeMenu(menu.filter(d => d.id !== dish.id));
  res.json({ ok: true });
});

/* ---------- Подбор блюд ------------------------------------------------- */

// Баллы блюда под настроение: правила настроения + бонус за совпадение тега.
function score(dish, mood) {
  return mood.rule(dish) + (dish.tags.includes(mood.id) ? 3 : 0);
}

// Достаём JSON из ответа модели (на случай, если вокруг него есть текст).
function extractJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function askClaude(mood, budget, candidates) {
  const list = candidates.map(d => ({
    id: d.id, name: d.name, desc: d.desc, price: d.price, category: d.category,
    spice: d.spice, temp: d.temp === "hot" ? "горячее" : "холодное", sweet: d.sweet, score: d.score,
  }));
  const prompt = `Ты — дружелюбный ассистент кафе. Гость выбрал настроение «${mood.label}» (${mood.hint}).
Бюджет: ${Number.isFinite(budget) ? budget + " тенге" : "не ограничен"}.
Доступные блюда (уже отфильтрованы по бюджету и остроте; score — предварительная оценка по правилам): ${JSON.stringify(list)}

Выбери 1–3 блюда. Можно собрать комбо (например, напиток + десерт), но сумма цен не должна превышать бюджет. Выбирай ТОЛЬКО блюда из списка, по полю id. Если гость грустит — выбирай сладкое или горячее. Ответь строго JSON без текста вокруг:
{"picks":[{"id":"...","reason":"одна короткая тёплая фраза на русском, почему подходит именно сейчас"}]}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) throw new Error("Claude API: HTTP " + r.status);
    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    return extractJson(text);
  } finally {
    clearTimeout(timer);
  }
}

// Резерв без ИИ: лучшее блюдо + (если влезает в бюджет) дополнение из другой категории.
function rulePicks(sorted, budget) {
  const picks = [];
  let total = 0;
  for (const d of sorted) {
    if (picks.length >= 2) break;
    if (picks.some(p => p.category === d.category)) continue;
    if (total + d.price > budget) continue;
    picks.push({ ...d, reason: "Подходит под ваше настроение и бюджет." });
    total += d.price;
  }
  return picks;
}

app.post("/api/recommend", async (req, res) => {
  const mood = MOODS.find(m => m.id === req.body.mood);
  if (!mood) return res.status(400).json({ error: "Выберите настроение" });
  const rawBudget = req.body.budget;
  const budget = rawBudget === "" || rawBudget == null || !Number.isFinite(Number(rawBudget)) ? Infinity : Number(rawBudget);
  const parsedSpice = parseInt(req.body.maxSpice, 10);
  const maxSpice = Number.isNaN(parsedSpice) ? 3 : Math.min(3, Math.max(0, parsedSpice));

  const pool = readMenu()
    .filter(d => d.available !== false && d.spice <= maxSpice)
    .map(d => ({ ...d, score: score(d, mood) }));
  const affordable = pool.filter(d => d.price <= budget);
  if (!affordable.length) {
    const cheapest = pool.length ? Math.min(...pool.map(d => d.price)) : null;
    return res.json({ picks: [], total: 0, source: "none", message: cheapest ? `В рамках этой суммы блюд нет. Самое доступное стоит ${cheapest} ₸.` : "Подходящих блюд нет." });
  }
  const sorted = [...affordable].sort((a, b) => b.score - a.score || a.price - b.price);
  const candidates = sorted.slice(0, 12); // ИИ видит лучших кандидатов, чтобы запрос был коротким

  let picks = null;
  let source = "rules";
  if (API_KEY) {
    try {
      const ai = await askClaude(mood, budget, candidates);
      if (ai && Array.isArray(ai.picks)) {
        let total = 0;
        const chosen = [];
        for (const p of ai.picks) {
          const d = candidates.find(c => c.id === p.id);
          if (!d || chosen.some(c => c.id === d.id) || total + d.price > budget || chosen.length >= 3) continue; // проверяем, что ИИ не выдумал блюдо и не вышел за бюджет
          chosen.push({ ...d, reason: String(p.reason || "").slice(0, 300) });
          total += d.price;
        }
        if (chosen.length) { picks = chosen; source = "ai"; }
      }
    } catch (e) {
      console.warn("ИИ недоступен, используем правила:", e.message);
    }
  }
  if (!picks) picks = rulePicks(sorted, budget);

  res.json({ picks, total: picks.reduce((s, d) => s + d.price, 0), source });
});


/* ---------- Чат с Gemini --------------------------------------------------
   Браузер присылает всю историю диалога [{role:"user"|"model", text}].
   Мы добавляем системную инструкцию (роль, правила настроений и актуальное
   меню), просим Gemini вернуть JSON {reply, budget, picks} и проверяем:
   блюда реально существуют, есть в наличии, сумма не выше названного бюджета.
   Ключ GEMINI_API_KEY хранится только на сервере.
*/
const chatHits = new Map(); // ip -> время последних сообщений (простая защита от спама)
function rateLimited(ip) {
  const now = Date.now();
  const arr = (chatHits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  chatHits.set(ip, arr);
  return arr.length > 20;
}

function chatSystemPrompt(menu) {
  const list = menu.filter(d => d.available !== false).map(d => ({
    id: d.id, name: d.name, desc: d.desc, price: d.price, category: d.category,
    spice: d.spice, temp: d.temp === "hot" ? "горячее" : "холодное", sweet: d.sweet,
  }));
  return `Ты — дружелюбный официант-ассистент кафе MoodMenu. Общайся коротко и тепло, на языке гостя.
Твоя задача: в живом диалоге узнать настроение гостя, примерную сумму, которую он готов потратить, и отношение к острому, а затем подобрать блюда из меню.

Правила диалога:
- Задавай не больше одного вопроса за раз. Обычно хватает 2–3 вопросов; если гость уже всё рассказал — не переспрашивай.
- Пока не знаешь хотя бы настроение гостя, возвращай "picks": [].
- Когда информации достаточно, предложи 1–3 блюда (можно комбо, например напиток + десерт) и коротко объясни выбор.
- Если назвал сумму — запиши её числом в поле "budget" (тенге), иначе null. Сумма цен выбранных блюд не должна превышать бюджет.
- Учитывай остроту: если гость не любит острое, выбирай spice = 0.
- Выбирай ТОЛЬКО блюда из меню, по полю id. Не выдумывай блюда и цены.
- Если гость пишет не про еду, вежливо верни разговор к меню.

Как подбирать под настроение:
${MOODS.map(m => `- ${m.label}: ${m.hint}`).join("\n")}
Если гостю грустно — предлагай сладкое или горячие блюда, без сильной остроты, и прояви немного заботы.

Меню (JSON): ${JSON.stringify(list)}

Ответ — строго JSON: {"reply": "текст гостю", "budget": число или null, "picks": [{"id": "...", "reason": "почему подходит"}]}`;
}
async function fetchRetry(url, opts, tries = 3) {
  let r;
  for (let i = 0; i < tries; i++) {
    r = await fetch(url, opts);
    if (r.status !== 503) return r;
    await new Promise(res => setTimeout(res, 1000 * (i + 1)));
  }
  return r;
}
app.post("/api/chat", async (req, res) => {
  if (!GEMINI_KEY) return res.status(503).json({ error: "Чат выключен: в файле .env не задан GEMINI_API_KEY." });
  if (rateLimited(req.ip)) return res.status(429).json({ error: "Слишком много сообщений. Подождите минуту." });

  const msgs = Array.isArray(req.body.messages) ? req.body.messages.slice(-20) : [];
  const contents = msgs
    .filter(m => m && typeof m.text === "string" && m.text.trim())
    .map(m => ({ role: m.role === "model" ? "model" : "user", parts: [{ text: m.text.slice(0, 500) }] }));
  while (contents.length && contents[0].role === "model") contents.shift(); // Gemini ждёт, что диалог начинает гость
  if (!contents.length || contents[contents.length - 1].role !== "user") return res.status(400).json({ error: "Напишите сообщение." });

  const menu = readMenu();
  const ctrl = new AbortController();
 const timer = setTimeout(() => ctrl.abort(), 40000);
  try {
    const r = await fetchRetry(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: chatSystemPrompt(menu) }] },
        contents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              reply: { type: "STRING" },
              budget: { type: "NUMBER", nullable: true },
              picks: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, reason: { type: "STRING" } }, required: ["id", "reason"] } },
            },
            required: ["reply", "picks"],
          },
        },
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.warn("Gemini HTTP", r.status, detail.slice(0, 300));
      return res.status(502).json({ error: r.status === 429 ? "Лимит запросов Gemini исчерпан, попробуйте позже." : `Gemini вернул ошибку (HTTP ${r.status}). Проверьте ключ и название модели.` });
    }
    const data = await r.json();
    const text = ((data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || []).map(p => p.text || "").join("");
    if (!text) return res.json({ reply: "Давайте поговорим о еде 🙂 Какое у вас сейчас настроение?", picks: [], total: 0 });

    let out;
    try { out = JSON.parse(text); } catch { out = extractJson(text) || { reply: text, picks: [] }; }

    const budget = Number.isFinite(Number(out.budget)) && out.budget !== null ? Number(out.budget) : Infinity;
    const picks = [];
    let total = 0;
    for (const p of Array.isArray(out.picks) ? out.picks : []) {
      const d = menu.find(m => m.id === p.id && m.available !== false);
      if (!d || picks.some(x => x.id === d.id) || picks.length >= 3 || total + d.price > budget) continue;
      picks.push({ ...d, reason: String(p.reason || "").slice(0, 300) });
      total += d.price;
    }
    res.json({ reply: String(out.reply || "").slice(0, 1500) || "Вот что я бы предложил:", picks, total });
  } catch (e) {
    console.warn("Gemini недоступен:", e.message, e.cause);
    res.status(502).json({ error: "Не удалось связаться с Gemini. Проверьте интернет и ключ." });
  } finally {
    clearTimeout(timer);
  }
});

// Ошибки загрузки файлов и прочие — в виде JSON
app.use((err, req, res, next) => res.status(400).json({ error: err.message || "Ошибка" }));

app.listen(PORT, () => {
  console.log(`MoodMenu: http://localhost:${PORT}   (админка: /admin.html)`);
  console.log(API_KEY ? "Подбор: Claude API включён" : "Подбор: ключ Claude не задан — работает подбор по правилам");
  console.log(GEMINI_KEY ? `Чат: Gemini включён (${GEMINI_MODEL})` : "Чат: GEMINI_API_KEY не задан — чат выключен");
});
