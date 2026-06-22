# Guerreros realistas con IA 3D — guía paso a paso

Objetivo: reemplazar los personajes caricaturescos por **guerreros realistas**
generados con IA, **rigged + animados**, en formato `.glb`, listos para el juego.

> ⚠️ Lo más importante: el modelo debe venir **con esqueleto (rig) y animaciones**
> (idle, caminar, correr, atacar). Un mesh estático bonito **no sirve** — caminaría
> congelado. Por eso usamos el paso de **"Animate / Rig"** de la herramienta.

---

## Opción A (recomendada): Meshy o Tripo — todo en uno, exporta `.glb` animado

1. **Genera el cuerpo** en [meshy.ai](https://www.meshy.ai) o [tripo3d.ai](https://www.tripo3d.ai):
   - *Text to 3D* o *Image to 3D*.
   - Prompt sugerido (ajústalo a tu estilo):
     > `full-body medieval knight in ornate steel plate armor, holding a longsword, game character, A-pose, symmetric, clean topology, PBR textures`
   - Para cada Nación puedes variar: *mago con túnica y bastón*, *bárbaro con hacha y pieles*, *asesina con armadura ligera y dagas*, etc.
2. **Texturiza / refina** (botón de texturas PBR — esto da el look metálico realista).
3. **Rig + animaciones**: usa la función **"Animate"** (Meshy) / **"Rigging + Animation"** (Tripo).
   - Marca que es **humanoide**.
   - Aplica al menos: **Idle, Walking, Running, Attack/Slash** (y Death si está).
4. **Exporta** → formato **`.glb`** → marca **"incluir animaciones / include animations"**.

## Opción B: mesh con IA + animaciones con Mixamo (si la IA no anima bien)
1. Genera el mesh en Meshy/Tripo → exporta **`.glb`** (o FBX).
2. Súbelo a [mixamo.com](https://www.mixamo.com) (gratis, cuenta Adobe) → **Auto-Rig** (coloca los marcadores).
3. Aplica animaciones (Idle, Walking, Running, "Sword And Shield Slash", "Standing React Death")
   y **descarga cada una "with skin"**.
4. ⚠️ Mixamo exporta **FBX** y una animación por archivo. Necesitas unirlas en un solo
   `.glb`. Sin Blender local: usa un convertidor online (busca "FBX to GLB" / `gltf.report`)
   o Blender en tu PC (Import FBX × N → une las Actions → Export glTF). **Por eso la Opción A
   es más simple.**

---

## Verifica ANTES de enviármelo
Pon el archivo en la carpeta del juego y corre:

```bash
node tools/inspect-glb.js mi-guerrero.glb
```

Debe decir **`✅ LISTO para integrar`** (tiene esqueleto, idle y caminar) y te mostrará
el **mapeo de animaciones** que usaré. Si dice `✗ sin esqueleto` o `✗ sin animaciones`,
vuelve al paso de Animate/Rig.

Pautas para que rinda bien en navegador:
- **Tamaño**: ideal **< 8 MB** por personaje (baja el conteo de polígonos / resolución de
  textura si pesa mucho). El validador te avisa.
- **Texturas embebidas** en el `.glb` (no sueltas).
- **Normal map** = se ve mucho más realista (Meshy/Tripo lo incluyen con PBR).

---

## Integración (lo hago yo)
Cuando tengas 1+ `.glb` validados, ponlos en `assets/models/warriors/` (o pásamelos) y dime
a qué héroe va cada uno (brunn=tanque, kael/drako=guerrero, gorr/lyra=mago, sylth=asesina).
Yo los enchufo en `js/herogltf.js` (`HERO_MODELS`) con el mapeo de animaciones, ajusto
escala/orientación, y verifico con capturas. Puedes empezar con **uno solo** para ver el salto.
