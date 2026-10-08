// Эмодзи для иконок блюд (ключ = id блюда из меню)
const DISH_EMOJI = {
  capu: "☕",
  matcha: "🍵",
  lemonade: "🥒",
  cocoa: "🍫",
  seaberry: "🫖",
  chilicoffee: "🌶️",
  cheesecake: "🍰",
  eclair: "🥐",
  brownie: "🍨",
  fruitsalad: "🍓",
  shakshuka: "🍳",
  wings: "🍗",
  broth: "🥣",
  tomyum: "🍲",
  lagman: "🍜",
  sandwich: "🥪",
  alfredo: "🍝",
  arrabbiata: "🍅",
  salmonbowl: "🥗"
};

// Возвращает эмодзи блюда или первую букву названия, если эмодзи не задан
function getDishIcon(item) {
  return DISH_EMOJI[item.id] || item.name.charAt(0);
}

/* ===== КАК ПОДКЛЮЧИТЬ =====

1) Подключи файл до основного скрипта:
   <script src="dish-emoji.js"></script>

2) Там, где в иконку ставится первая буква, замени на:

   // было: iconEl.textContent = item.name[0];
   iconEl.textContent = getDishIcon(item);

   Или в шаблонной строке:

   const icon = item.image
     ? `<img src="${item.image}" alt="${item.name}">`
     : `<span class="dish-emoji">${getDishIcon(item)}</span>`;

3) CSS (подправь класс под свой):

   .dish-emoji {
     font-size: 26px;
     line-height: 1;
   }
*/
