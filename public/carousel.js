// Карусель блюд в hero. Берёт меню с сервера и крутит его по кругу.
(function () {
  const track = document.getElementById('dishTrack');
  const rail = document.getElementById('dishRail');
  if (!track || !rail) return;

  // Пробуем адреса по очереди — какой-то из них у вас точно рабочий.
  // Если знаете точный адрес из server.js, оставьте только его.
  const URLS = ['/api/dishes', '/api/menu', '/data/menu.json'];

  const FALLBACK = { default: '🍽️' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function load() {
    for (const url of URLS) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const data = await r.json();
        const list = Array.isArray(data) ? data : (data.dishes || data.items || data.menu || []);
        if (list.length) return list;
      } catch (e) { /* пробуем следующий адрес */ }
    }
    return [];
  }

  function photoUrl(d) {
    const p = d.photo || d.image || d.photoUrl || d.img;
    if (!p) return '';
    return /^(https?:)?\//.test(p) ? p : '/uploads/' + p;
  }

  function card(d) {
    const photo = photoUrl(d);
    const inner = photo
      ? `<img src="${esc(photo)}" alt="${esc(d.name)}" loading="lazy">`
      : esc(d.emoji || FALLBACK.default);
    return `<a class="dish-card" href="#menu" title="${esc(d.name)}">
      <div class="dish-plate">${inner}</div>
      <div class="dish-name">${esc(d.name)}</div>
      <div class="dish-price">${esc(d.price)} ₸</div>
    </a>`;
  }

  load().then(all => {
    let dishes = all.filter(d => d.available !== false && d.available !== 0);
    if (!dishes.length) { rail.remove(); return; }

    // блюда с фото — первыми, максимум 14
    dishes.sort((a, b) => !!photoUrl(b) - !!photoUrl(a));
    dishes = dishes.slice(0, 14);

    // повторяем набор, чтобы лента не обрывалась на широких экранах
    let set = dishes;
    while (set.length < 10) set = set.concat(dishes);

    const html = set.map(card).join('');
    track.innerHTML = html + html;                         // два набора = бесшовный цикл
    track.style.setProperty('--dur', set.length * 4 + 's'); // ~4 секунды на блюдо
  });
})();
