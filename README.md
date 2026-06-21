# Elemental Legacy: The Broken Seal — Prototipo

Prototipo jugable (HTML5 + JavaScript, sin dependencias) de un MMORPG de acción con **combate elemental** y un **pilar educativo de acertijos** para niños y adultos.

## ▶ Cómo jugar

**Opción A — servidor local (recomendado):**
```bash
python3 -m http.server 8123 --directory .
# abre http://localhost:8123 en tu navegador
```

**Opción B — abrir el archivo:** abre `index.html` con doble clic en tu navegador.

> En VS Code Remote-SSH, usa la opción A y abre el puerto reenviado (pestaña **PORTS**).

## 🎮 Controles
- **Mover:** WASD / Flechas · **Apuntar:** ratón
- **Skills:** `1` `2` `3` `4` · **Básico:** clic izquierdo
- **Cambiar elemento del rival:** `Q` / `E` · **Salir:** `Esc`

## ✨ Contenido
- **6 héroes** (uno por Nación) con arquetipos: 🛡️ Tanque, 🔥 Berserker, 🔮 Mago, 🏹 Asesina, 💥 Verdugo, ✨ Sanadora — cada uno con un Poder pasivo y 4 skills.
- **Sistema elemental de 6:** Fuego ▸ Viento ▸ Rayo ▸ Tierra ▸ Agua ▸ Madera ▸ (Fuego). Ventaja/desventaja ±25 %, **crítico**, **velocidad de ataque** y **daño mágico** (penetra ½ armadura).
- **🧩 Cámara de Acertijos:** 20 retos en 5 categorías — Lógica, Cálculo mental, Lógica matemática, Física y geometría, Oído y memoria (incluye minijuegos de **memoria visual** y **secuencias de sonido**). Resolverlos desbloquea materiales, equipo y **Reliquias** (poderes equipables). El progreso se guarda en el navegador.

## 🗂️ Estructura
```
index.html              · estructura + navegación
css/style.css           · estilos
js/elements.js          · anillo elemental y ventaja
js/characters.js        · los 6 héroes (stats + skills)
js/entity.js            · vida, crítico, armadura, estados, curación
js/combat.js            · ejecución de skills y daño
js/game.js              · bucle, arena, IA, HUD
js/puzzles.js           · acertijos + recompensas
js/main.js              · pantallas, acertijos interactivos, bóveda
GDD-Elemental-Legacy.md · documento de diseño del juego
```

## 📄 Diseño
El diseño completo (lore, naciones, clases, raids, forja, acertijos) está en [`GDD-Elemental-Legacy.md`](GDD-Elemental-Legacy.md).

---
*Prototipo en desarrollo. Las cifras de balance son iniciales y se ajustarán con playtesting.*
