/* =========================================================================
   MoodMenu — админ-панель. Пароль хранится только в sessionStorage
   (до закрытия вкладки) и отправляется в заголовке x-admin-password.
   Фото уходит на сервер через FormData (multipart/form-data).
   ========================================================================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let CONFIG, MENU = [], editingId = null, currentImage = null;
const pwd = () => sessionStorage.getItem("mm_pwd") || "";
const authHeaders = () => ({ "x-admin-password": pwd() });

async function login() {
  const value = $("#pwd").value || pwd();
  sessionStorage.setItem("mm_pwd", value);
  const r = await fetch("/api/admin/check", { method: "POST", headers: authHeaders() });
  if (!r.ok) { sessionStorage.removeItem("mm_pwd"); $("#loginMsg").textContent = "Неверный пароль"; $("#loginMsg").className = "msg err"; return; }
  $("#loginPanel").style.display = "none";
  $("#adminArea").style.display = "block";
  await load();
}

async function load() {
  [CONFIG, MENU] = await Promise.all([fetch("/api/config").then(r => r.json()), fetch("/api/menu").then(r => r.json())]);
  $("#catSel").innerHTML = CONFIG.categories.map(c => `<option>${esc(c)}</option>`).join("");
  $("#moodChecks").innerHTML = CONFIG.moods.map(m => `<label><input type="checkbox" name="tag" value="${esc(m.id)}"> ${m.icon} ${esc(m.label)}</label>`).join("");
  renderList();
}

function renderList() {
  $("#adminList").innerHTML = MENU.map(d => `
    <div class="admin-item">
      ${d.image ? `<img class="thumb-img" src="${esc(d.image)}" alt="">` : `<div class="thumb">${esc(d.name.charAt(0).toUpperCase())}</div>`}
      <div class="info">
        <b>${esc(d.name)}</b> — ${d.price} ₸ ${d.available === false ? "· <i>нет в наличии</i>" : ""}
        <small>${esc(d.category)} · ${d.temp === "hot" ? "горячее" : "холодное"}${d.sweet ? " · сладкое" : ""}${d.spice ? " · " + "🌶".repeat(d.spice) : ""}</small>
        <small>Настроения: ${d.tags.length ? esc(d.tags.join(", ")) : "—"}</small>
        <div class="row-actions">
          <button class="btn ghost" data-edit="${esc(d.id)}">Изменить</button>
          <button class="btn danger" data-del="${esc(d.id)}">Удалить</button>
        </div>
      </div>
    </div>`).join("") || '<p class="hint">Меню пусто.</p>';
  document.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => startEdit(b.dataset.edit));
  document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => del(b.dataset.del));
}

function resetForm() {
  editingId = null; currentImage = null;
  $("#dishForm").reset();
  $("#preview").removeAttribute("src");
  $("#formTitle").textContent = "Новое блюдо";
  $("#cancelBtn").style.display = "none";
  $("#formMsg").textContent = "";
}

function startEdit(id) {
  const d = MENU.find(x => x.id === id);
  if (!d) return;
  editingId = id; currentImage = d.image;
  const f = $("#dishForm");
  const el = f.elements;
  el.name.value = d.name; el.price.value = d.price; el.desc.value = d.desc;
  el.category.value = d.category; el.spice.value = d.spice; el.temp.value = d.temp;
  el.sweet.checked = !!d.sweet; el.available.checked = d.available !== false;
  document.querySelectorAll('input[name="tag"]').forEach(c => c.checked = d.tags.includes(c.value));
  if (d.image) $("#preview").src = d.image; else $("#preview").removeAttribute("src");
  $("#photo").value = ""; $("#removePhoto").checked = false;
  $("#formTitle").textContent = "Редактирование: " + d.name;
  $("#cancelBtn").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Предпросмотр выбранного фото до отправки на сервер
$("#photo").addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) $("#preview").src = URL.createObjectURL(file);
});

$("#dishForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const fd = new FormData();
  ["name", "price", "desc", "category", "spice", "temp"].forEach(k => fd.append(k, f.elements[k].value));
  fd.append("sweet", f.elements.sweet.checked);
  fd.append("available", f.elements.available.checked);
  fd.append("tags", JSON.stringify([...document.querySelectorAll('input[name="tag"]:checked')].map(c => c.value)));
  if ($("#photo").files[0]) fd.append("photo", $("#photo").files[0]);
  if ($("#removePhoto").checked) fd.append("removePhoto", "true");

  const r = await fetch(editingId ? "/api/menu/" + editingId : "/api/menu", { method: editingId ? "PUT" : "POST", headers: authHeaders(), body: fd });
  const data = await r.json();
  const msg = $("#formMsg");
  if (!r.ok) { msg.textContent = data.error || "Ошибка"; msg.className = "msg err"; return; }
  msg.className = "msg"; msg.textContent = "Сохранено ✓";
  resetForm();
  await load();
  $("#formMsg").textContent = "Сохранено ✓";
});

async function del(id) {
  if (!confirm("Удалить это блюдо?")) return;
  const r = await fetch("/api/menu/" + id, { method: "DELETE", headers: authHeaders() });
  if (r.ok) { if (editingId === id) resetForm(); await load(); }
}

$("#cancelBtn").onclick = resetForm;
$("#loginBtn").onclick = login;
$("#pwd").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
if (pwd()) login();
