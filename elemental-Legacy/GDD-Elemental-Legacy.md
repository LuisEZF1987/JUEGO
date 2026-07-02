# Documento de Diseño de Juego (GDD)
# *Elemental Legacy: The Broken Seal*

> **Versión:** 1.2 — Borrador de Diseño Técnico
> **Fecha:** 2026-06-21
> **Autor / Rol:** Dirección Creativa & Lead Game Design
> **Género:** MMORPG de mundo abierto · Acción-aventura · Progresión hardcore
> **Plataformas objetivo:** PC (principal), consola de nueva generación
> **Idioma del documento:** Español (referencia interna del equipo)

> **Cambios v1.2:** el 6.º elemento pasa de Luz a **Madera** (vida/naturaleza), coherente con la Princesa como *Sello Viviente*. Aethelgard reconvertido en Guardián del Árbol Madre. **Madera (elemento)** se distingue de **Madera de Roble** (material base de carpintería).
> **Cambios v1.1:** sistema elemental ampliado a **6 elementos / 6 Naciones / 6 Primordiales**. Razas 1:1 con elementos. Nuevo sistema de **Cristales de Legado** (reciclaje de equipo dañado) y **Cristalomancia** (fabricación con cristales + materiales base).

---

## Índice
1. [Resumen ejecutivo / Visión](#1-resumen-ejecutivo--visión)
2. [Pilares de Mundo y Gameplay](#2-pilares-de-mundo-y-gameplay)
3. [Lore: El Dilema del Sello](#3-lore-el-dilema-del-sello)
4. [Ciclo Elemental y Sistema de Chakra](#4-ciclo-elemental-y-sistema-de-chakra)
5. [Razas y Clases (24 builds)](#5-razas-y-clases-24-builds)
6. [Forja de Legado, Cristales y Cristalomancia](#6-forja-de-legado-cristales-y-cristalomancia)
7. [Bestiario: Los 6 Primordiales](#7-bestiario-los-6-primordiales) **★ Entregable 1**
8. [Ciclo de Raids de los Primordiales](#8-ciclo-de-raids-de-los-primordiales)
9. [Jutsus de Alianza](#9-jutsus-de-alianza) **★ Entregable 2**
10. [Crafteo de la Espada de Grado Deidad](#10-crafteo-de-la-espada-de-grado-deidad) **★ Entregable 3**
11. [Apéndices](#11-apéndices)

---

## 1. Resumen ejecutivo / Visión

**Elemental Legacy: The Broken Seal** es un MMORPG de mundo abierto que fusiona cuatro experiencias de referencia en un único bucle de juego cohesionado:

| Referencia | Aporte al diseño |
|---|---|
| **GTA V** | Mundo abierto masivo, ciudades vivas, NPCs con rutinas, reputación dinámica |
| **The Legend of Zelda** | Combate con fijado (Z-Targeting), mazmorras de acertijos ambientales, reliquias de progresión |
| **Super Mario** | Navegación vertical, plataformas y parkour como puerta de acceso a los dominios divinos |
| **Naruto** | Gestión de Chakra y ciclo estratégico de debilidades elementales |

**Promesa de jugador:** *"Rompe el Sello, libera a los Dioses por error y forja un legado capaz de volver a encadenarlos."*

El núcleo emocional es la **progresión de alto riesgo**: el equipo de Grado Deidad puede destruirse al perfeccionarlo, pero **ningún material se pierde del todo** — el equipo dañado se recicla en **Cristales** que vuelven a la forja. Cada arma +15 sigue siendo un símbolo de estatus real en el servidor.

### Bucle de juego principal
1. **Explorar** el mundo abierto y completar mazmorras estilo Zelda (acertijos + reliquias).
2. **Combatir** usando ventaja elemental y gestión de Chakra.
3. **Derrotar Primordiales** (raids de 24 h) para obtener materiales divinos.
4. **Forjar y refinar** equipo de Grado Deidad asumiendo el riesgo de Cristalización/Quema.
5. **Reciclar** el equipo dañado en Cristales y **fabricar** equipo nuevo vía Cristalomancia.
6. **Repetir** con builds y alianzas de raza más fuertes, escalando hacia el Nv 150–160.

---

## 2. Pilares de Mundo y Gameplay

### 2.1 Mundo Abierto (estilo GTA V)
- **6 Naciones elementales**, una por cada elemento del ciclo (Fuego, Viento, Rayo, Tierra, Agua y **Madera**). El mapa es continuo, sin pantallas de carga entre regiones.
  - La **Nación del Bosque Eterno** (elemento Madera) es la capital diplomática y sede del antiguo Sello: hogar de los **Humanos** y de la **Princesa**.
- **Ciudades vivas:** comercio, gremios, tablones de contratos, eventos públicos dinámicos.
- **NPCs con rutinas:** ciclo día/noche que altera horarios de trabajo, patrullas de guardias y disponibilidad de misiones.
- **Sistema de reputación por Nación:** las acciones del jugador suben/bajan reputación, desbloqueando comerciantes exclusivos o provocando hostilidad de facción.

### 2.2 Aventura y Combate (estilo Zelda)
- **Z-Targeting (fijado de objetivos):** bloqueo de cámara sobre un enemigo, con esquivas direccionales y parry de ventana corta.
- **Mazmorras de acertijos ambientales:** uso de elementos (quemar, electrificar, mover tierra, hacer crecer raíces) para resolver puzzles.
- **Reliquias de progresión:** objetos clave (tipo "gancho", "botas de viento") que abren rutas previamente inaccesibles.

### 2.3 Navegación (estilo Mario)
- **Plataformas y parkour:** los **Dominios de los Dioses** se acceden superando tramos de plataformas verticales (saltos de precisión, paredes, corrientes de aire, lianas).
- El parkour funciona como **gate de dificultad**: si no dominas el movimiento, no llegas al jefe.

### 2.4 Estrategia Elemental (estilo Naruto)
- **Chakra** como recurso gestionable de habilidades elementales.
- **Ciclo de debilidades** de 6 elementos (ver Sección 4).

### 2.5 Pilar Educativo (Cámaras de Acertijos)
El juego integra un **pilar de aprendizaje** pensado para que **niños y adultos razonen, calculen y colaboren**. Repartidas por el mundo (y accesibles desde el menú en el prototipo), las **Cámaras de Acertijos** plantean retos clasificados en **5 categorías de inteligencia**:

| Categoría | Qué entrena | Ejemplos |
|---|---|---|
| 🧠 **Lógica** | Deducción y pensamiento lateral | Silogismos, cruce del río, deducción de pistas |
| ➗ **Cálculo mental** | Operaciones rápidas de cabeza | Sumas/divisiones, cálculo encadenado |
| 🔢 **Lógica matemática** | Patrones y propiedades numéricas | Series, duplicación, Fibonacci |
| 📐 **Física y geometría** | Formas, ángulos y leyes físicas | Hexágonos, ángulos del triángulo, caída en vacío |
| 🎧 **Oído y memoria** | Secuencias visuales y de sonido | Memoria tipo *Simón*, repetir tonos grave/agudo |

- **Dificultad por edad:** cada acertijo es *Aprendiz*, *Intermedio* o *Maestro*; algunos están marcados **👥 En equipo** (requieren combinar pistas que tienen distintas personas → fomentan la colaboración familiar).
- **Recompensas reales:** resolverlos desbloquea **materiales** (para la forja), **armas/armaduras** y **Reliquias** (poderes equipables que mejoran al héroe: +crítico, +vida, +Chakra, +curación, etc.). El progreso se guarda por jugador.
- **Diseño inclusivo:** el objetivo es que, sobre todo los niños, **saquen algo valioso del juego** (lógica, memoria, cálculo) mientras avanzan en la aventura.

---

## 3. Lore: El Dilema del Sello

### 3.1 La Trama
El jugador emprende la campaña heroica para derrotar al Guardián **Aethelgard** y rescatar a la **Princesa**. Al cumplir la gesta, descubre la verdad terrible: **la Princesa era el Sello Viviente**. Su liberación rompe el equilibrio ancestral y desata a los **5 Hermanos Primordiales**, Dioses Malignos que llevaban eones encadenados.

> El "héroe" se convierte, sin saberlo, en el causante del fin del mundo conocido.

### 3.2 El sexto Primordial — Aethelgard, el Guardián Caído
Los **5 Hermanos Primordiales** son los Dioses Malignos del ciclo (Fuego, Viento, Rayo, Tierra, Agua). **Aethelgard**, Guardián del elemento **Madera** y centinela del **Árbol Madre** que sostenía el Sello, era su **carcelero**: no un hermano de sangre, sino el guardián del equilibrio. Al romperse el Sello, la savia corrupta del Árbol lo **pudre y corrompe**, y el antiguo Guardián cae como el **6.º Primordial** — el más poderoso, jefe culminante del endgame (Nv 160).

> Así, los raids enfrentan a **6 Primordiales**: los 5 Hermanos + Aethelgard corrompido (Madera).

### 3.3 Evolución del Mundo — "Fase de Oscuridad"
Tras el rescate, el mundo entra en un estado alterado **permanente**:
- **El cielo cambia para siempre** (paleta de oscuridad, auroras corruptas, eclipse perpetuo).
- **Los enemigos se vuelven más fuertes** (escalado global de stats; nuevas variantes corruptas).
- **La Princesa, ahora sin poderes**, acompaña al jugador como **guía narrativa** con el objetivo de volver a sellar a los Dioses.
- Se desbloquean los **eventos de Sellado** y la cadena de **raids de los Primordiales**.

La Fase de Oscuridad es el "endgame": convierte el mundo de aventura en un mundo de supervivencia y raid.

---

## 4. Ciclo Elemental y Sistema de Chakra

### 4.1 Ciclo de debilidades (anillo de 6)
**Regla canónica:** `Fuego > Viento > Rayo > Tierra > Agua > Madera > Fuego`

```
Fuego ─▶ Viento ─▶ Rayo ─▶ Tierra ─▶ Agua ─▶ Madera ─┐
  ▲                                                    │
  └────────────────────────────────────────────────────┘
   (cada elemento VENCE al siguiente; Madera vence a Fuego y cierra el anillo)
```

| Elemento atacante | Fuerte contra | Débil contra |
|---|---|---|
| Fuego | Viento | Madera |
| Viento | Rayo | Fuego |
| Rayo | Tierra | Viento |
| Tierra | Agua | Rayo |
| Agua | Madera | Tierra |
| Madera | Fuego | Agua |

> **Justificación de lore (Madera):** la *Madera Primordial* no es leña seca, sino **savia viva y corteza ignífuga** que **sofoca y absorbe las llamas** (Madera > Fuego); a su vez, el **Agua la pudre y arrastra** (Agua > Madera). Encaja con la naturaleza de vida del **Sello Viviente**.

### 4.2 Modificadores de daño
- **Ventaja elemental:** **+25 %** de daño.
- **Desventaja elemental:** **−25 %** de daño.
- **Neutral / mismo elemento:** daño base (×1.0).
- La ventaja elemental se aplica *después* del cálculo de crítico (ver Verdugo).

### 4.3 Sistema de Chakra
- Recurso central de las habilidades elementales (separado de la estamina de movimiento).
- **Regeneración base:** 5 % de la barra por segundo fuera de combate; 2 % en combate.
- **Místico** posee la barra más grande (×2 respecto a otras clases) y mayor regeneración.
- El Chakra alimenta tanto las habilidades individuales como los **Jutsus de Alianza** (Sección 9).

---

## 5. Razas y Clases (24 builds)

### 5.1 Las 6 Razas — afinidad 1:1 con los elementos
Cada raza encarna **un elemento del anillo** (+10 % daño con ese elemento) y un rasgo racial:

| Raza | Elemento | Rasgo racial |
|---|---|---|
| **Orcos** | Fuego | *Furia de Sangre*: +15 % daño bajo el 30 % de HP |
| **Elfos** | Viento | *Paso Ligero*: +20 % velocidad de movimiento y mejor parkour |
| **Cíclopes** | Rayo | *Ojo Atronador*: +10 % alcance de hechizos y de visión |
| **Enanos** | Tierra | *Piel de Roca*: +15 % armadura, inmunes a knockback leve |
| **Dracónidos** | Agua | *Aliento del Leviatán*: respiración subacuática + 15 % daño con Agua |
| **Humanos** | Madera | *Savia del Sello*: +10 % daño con Madera y +10 % a la curación recibida (vínculo con la Princesa, el Sello Viviente) |

### 5.2 Las 4 Especializaciones (clases)
Disponibles para **todas** las razas (6 × 4 = **24 builds**):

| Clase | Rol | Recurso | Función núcleo |
|---|---|---|---|
| **Místico** | DPS mágico / AoE | Chakra (barra grande) | Hechizos de área, control elemental, daño sostenido a distancia |
| **Baluarte** | Tanque | Furia/Aggro | Alta defensa, **escudos elementales**, control de agresividad (taunt) |
| **Verdugo** | DPS físico | Energía | **Daño crítico** y **velocidad de ataque**, burst cuerpo a cuerpo |
| **Erudito** | Soporte | Chakra (eficiente) | **Curación**, buffs de equipo y **reducción de cooldowns** |

> La composición ideal de raid combina razas para habilitar **Jutsus de Alianza** (Sección 9) y para cubrir el elemento débil de cada Primordial, no solo roles.

### 5.3 Arquetipos jugables (trade-offs de rol)
Cada héroe encarna un **arquetipo clásico de RPG** con compensaciones claras: quien aguanta mucho pega flojo; quien pega fuerte es frágil; el mago tiene gran poder mágico pero poca vida; el sanador apenas hace daño; los ágiles viven del crítico y la velocidad. Estadísticas implementadas en el prototipo: **Vida, Armadura, Poder, Crítico (prob. + multiplicador), Velocidad de ataque, Chakra, Curación**. El daño **mágico ignora la mitad de la armadura**.

| Héroe inicial | Elemento | Arquetipo | Trade-off principal |
|---|---|---|---|
| **Brunn** (Enano) | Tierra | **Tanque** (Baluarte) | Vida/armadura altísimas · pegada baja · lento |
| **Kael** (Orco) | Fuego | **Berserker** (Verdugo) | Daño cuerpo a cuerpo enorme · frágil |
| **Gorr** (Cíclope) | Rayo | **Mago** (Místico) | Gran poder mágico (penetra ½ armadura) · muy frágil · gran Chakra |
| **Sylth** (Elfo) | Viento | **Asesina** (Verdugo) | Crítico y velocidad máximos · a distancia · papel mojado |
| **Drako** (Dracónido) | Agua | **Verdugo** (DPS crítico) | Crítico/velocidad altos cuerpo a cuerpo · poco aguante |
| **Lyra** (Humana) | Madera | **Sanadora** (Erudito) | Curación y escudos potentes · daño muy bajo |

> Estos 6 son los personajes iniciales (uno por Nación). El sistema admite **más personajes por raza** a futuro, reutilizando las 4 especializaciones (Místico/Baluarte/Verdugo/Erudito).

---

## 6. Forja de Legado, Cristales y Cristalomancia

### 6.1 Construcción de equipo (sin block-building)
- **No existe construcción de bloques.** El jugador no "edifica" estructuras; **forja** armas y armaduras recolectando **materiales raros** (principalmente de los Dioses) y combinándolos con **materiales base** (madera de roble, hierro, oro, cuero, adamantita).
- La progresión de gear es **vertical** (refinamiento) y **horizontal** (sets elementales por dominio).

### 6.2 Refinamiento (+1 → +15)
Cada intento de refinamiento puede producir tres resultados:

| Estado | Efecto |
|---|---|
| **Éxito** | El objeto sube de nivel: mejora sus estadísticas **y su aura visual**. |
| **Cristalización** | El objeto se **bloquea** (inutilizable). **No se pierde**: se restaura, o se desmantela en Cristales (ver 6.3). |
| **Quema (Destrucción)** | Solo en el salto final a **+15**: si falla, el objeto se **destruye permanentemente**; de sus restos cristaliza 1 **Cristal del Sello** (ver 6.3). |

- **+15** es la meta hardcore: el equipo emite un **resplandor divino** y otorga **habilidades pasivas únicas**.
- La probabilidad de Quema al intentar +15 es del **50 %** (ver tabla exacta en Sección 10).

> Filosofía de diseño: el riesgo de destrucción crea **economía de prestigio**. Un +15 es escaso y reconocible por su aura — pero el sistema de Cristales evita la pérdida total y mantiene al jugador en el bucle.

### 6.3 Cristales de Legado — daño, desmantelado y reciclaje
**¿Qué pasa con un arma dañada?** Su esencia se condensa en **Cristales de Legado**, cuya **calidad depende del nivel que tenía el objeto** al dañarse.

- **Cristalización** (fallo en +6…+14): el objeto se bloquea. El jugador elige:
  1. **Restaurar** — gasta 1 material de Dios → desbloquea y conserva su nivel; puede seguir refinando.
  2. **Desmantelar** — destruye el objeto a propósito y obtiene **Cristales de Legado** acordes a su nivel.
- **Quema** (fallo en +15): el arma se **destruye permanentemente** (no se recupera el arma ni su nivel); de sus restos cristaliza **1 Cristal del Sello** — el cristal de máxima calidad, "esquirla de consuelo" que reabre la cadena de Grado Deidad.

**Tabla de calidades de Cristal de Legado:**

| Cristal de Legado | Color | Origen (nivel del objeto al dañarse) | ¿Hereda elemento? |
|---|---|---|---|
| **Tosco** | Gris | Equipo común / +1–+5 | No |
| **Refinado** | Azul | +6–+9 | Sí (del objeto) |
| **Divino** | Morado | +10–+12 | Sí |
| **Primordial** | Dorado | +13–+14 | Sí |
| **del Sello** | Rojo | +15 quemado / elemento Madera | Sí (puro) |

> **Nota de nomenclatura:** los *Cristales de Legado* (reciclaje) son distintos de los **consumibles de refinamiento** (Polvo de Refinamiento, Cristal de Refinamiento, Esencia de Forja, Esencia Divina) que se gastan *durante* el refinamiento en la Sección 10.

### 6.4 Cristalomancia — fabricar con Cristales + materiales base
**Estación:** *Mesa de Cristalomancia* (una por Nación). Permite convertir Cristales de Legado en equipo nuevo.

**Fórmula general:**
```
1 Cristal de Legado   →  define RAREZA y hereda ELEMENTO
+ materiales base     →  definen TIPO (arma o armadura) y subtipo
= Equipo fabricado
```

**Qué produce cada calidad de cristal + materiales base:**

| Cristal usado | Materiales base combinados | Resultado (rareza) | Notas |
|---|---|---|---|
| **Tosco** (gris) | Madera de Roble + Hierro | Común → Inusual | Equipo de inicio (arcos de roble, hojas de hierro) |
| **Refinado** (azul) | Hierro + Cuero curtido | Raro | Hereda el elemento del cristal |
| **Divino** (morado) | Oro + Adamantita | Épico | + 1 ranura de gema elemental |
| **Primordial** (dorado) | Adamantita Estelar + 1 material de Dios | Legendario | Base apta para **ascender** a Grado Deidad |
| **del Sello** (rojo) | Núcleo de Deidad + Esencia del Sello | Base de **Grado Deidad** | Reabre la cadena de la Espada de Grado Deidad |

- **Arma vs armadura** lo decide la combinación de materiales base:
  - *Hierro + Hierro* → espada · *Madera de Roble + Hierro + cuerda* → arco · *Adamantita + Oro* → maza/escudo.
  - *Cuero + Hierro* → armadura ligera · *Adamantita + Oro* → armadura pesada · *Tela + Cristal* → túnica de Místico.
- **El elemento** del equipo lo **hereda del cristal** (un Cristal Divino de Fuego → equipo de Fuego), lo que permite armar builds del ciclo elemental a voluntad.
- **Cierre del bucle hardcore:** un arma cristalizada o quemada no es pérdida total — su Cristal se reinvierte en equipo nuevo de rareza acorde, y un Cristal del Sello puede relanzar la fabricación de un arma de Grado Deidad.

---

## 7. Bestiario: Los 6 Primordiales
### ★ Entregable 1 — Tabla detallada (Nv 60–160)

Los **5 Hermanos Primordiales** (Dioses Malignos) más **Aethelgard, el Guardián Caído** (Madera) conforman los **6 jefes de raid**. Cada uno encarna un elemento del anillo; su **debilidad** es el elemento que lo vence. Se enfrentan en orden ascendente de nivel.

### 7.1 Tabla principal de combate

| # | Nombre / Epíteto | Elemento | Nv | HP base | Dominio (bioma) | Débil a | Mecánica de combate distintiva |
|---|---|---|---|---|---|---|---|
| 1 | **Pyrothar, el Corazón de Magma** | Fuego | 60 | ~8 M | Caldera Volcánica | **Madera** | Oleadas de magma; DoT de quemadura ambiental; suelo incandescente |
| 2 | **Sylvaris, la Tormenta Silente** | Viento | 85 | ~25 M | Templo Flotante | **Fuego** | Knockback de ráfagas; **fases aéreas** que exigen parkour para alcanzarla |
| 3 | **Vortigan, el Juicio del Trueno** | Rayo | 110 | ~60 M | Picos de la Cima Cargada | **Viento** | Cadenas de rayo que saltan entre jugadores; zonas electrificadas móviles |
| 4 | **Terrgoth, el Yunque del Mundo** | Tierra | 130 | ~120 M | Cañón de Adamantita | **Rayo** | Terremotos en línea; pilares destructibles; **armadura altísima** |
| 5 | **Nereon, el Abismo Devorador** | Agua | 150 | ~250 M | Fosa Abisal | **Tierra** | Inundación por fases; maremotos; **control de aggro masivo** (swap forzado) |
| 6 | **Aethelgard, el Guardián Caído** | Madera | 160 | ~400 M | Raíz del Árbol Madre | **Agua** | Raíces que aprisionan, esporas que purgan buffs, centinelas de corteza; **Juicio del Árbol** (Tetris extremo) |

### 7.2 Tabla de raid, sellado y botín

| # | Primordial | Raid recomendado | Enrage | Fase de Sellado (estilo Tetris) | Botín clave (material Deidad) | Drops secundarios |
|---|---|---|---|---|---|---|
| 1 | Pyrothar | 20 jugadores | 12 min | Velocidad **media** — **5 piezas** para extinguir el núcleo | **Brasa Eterna** | Lingotes de Adamantita, Polvo de Refinamiento |
| 2 | Sylvaris | 24 jugadores | 13 min | Cinta **acelerada** — **7 piezas** entre tornados | **Pluma de Tempestad** | Cristal de Refinamiento, esencias de Viento |
| 3 | Vortigan | 30 jugadores | 15 min | **Doble tablero** — **8 piezas** para descargar pararrayos | **Fragmento de Trueno** | Esencia de Forja, esencias de Rayo |
| 4 | Terrgoth | 36 jugadores | 16 min | Piezas **"pesadas"** de caída rápida — **9 piezas** sin huecos | **Corazón Pétreo** | Esencia de Forja, Esencia Divina |
| 5 | Nereon | 40 jugadores | 18 min | Máxima velocidad + **líneas dobles** — **10 piezas** | **Lágrima Abisal** | Esencia Divina, fragmentos del Sello |
| 6 | Aethelgard | 40 jugadores | 20 min | **Triple tablero** — exige *perfect clear* en ventanas cortas | **Savia Eterna** | Corona del Sello, Núcleo de Deidad (boost) |

### 7.3 Reglas de balance compartidas
- **Ventaja elemental:** llevar daño del elemento débil del jefe otorga el **+25 %** estándar. Coordinar al grupo hacia el elemento correcto es clave para vencer el enrage. (Nota: para Pyrothar, el elemento débil ahora es **Madera**.)
- **Escalado de respawn (cada 24 h):** al reaparecer, el Primordial gana **+5 % HP acumulativo**, un **afijo nuevo** (p. ej. *Reflejo Elemental*, *Frenesí*, *Coraza Adaptativa*) y una **tabla de botín mejorada**.
- **Fase de Sellado obligatoria:** la barra de HP no puede bajar del 1 % hasta completar el minijuego de Tetris en los "momentos clave". Fallar el encaje **reactiva** al jefe a HP parcial.
- **Mecánicas cruzadas de pilares:** Sylvaris exige **parkour** (Mario), las mazmorras de acceso usan **acertijos** (Zelda) y el **ciclo elemental** (Naruto) decide el DPS efectivo.

---

## 8. Ciclo de Raids de los Primordiales

### 8.1 Respawn de 24 horas
- Cada Dios derrotado **reaparece cada 24 h** con **mayor dificultad y mejores premios** (ver 7.3).
- Temporizador visible en el mapa del mundo y en el calendario de gremio.

### 8.2 Sistema de Botín (loot físico)
- Al morir, el Primordial **suelta los premios físicamente al suelo**. Los jugadores deben **recogerlos rápidamente** antes de que despawneen (ventana de **60 s**).
- **Ranking de daño:** un marcador registra el daño total por jugador durante el encuentro.
  - **Top 1–3:** Cofre Dorado (mayor probabilidad de material Deidad).
  - **Top 4–10:** Cofre Plateado (incluye el **Núcleo de Deidad** garantizado para el Top-10).
  - **Resto del raid:** botín del suelo estándar.
- Diseño anti-griefing: el material clave del jefe (p. ej. Brasa Eterna) tiene **asignación personal**, mientras que los consumibles comunes caen al suelo de forma abierta.

### 8.3 Sellado (estilo Tetris)
- En **momentos clave** de la batalla, todo el raid entra a un **minijuego de encaje de piezas a alta velocidad**.
- Completar las líneas requeridas **sella** progresivamente al Primordial; fallar lo **enfurece** temporalmente (+20 % daño durante 15 s).
- La dificultad del Tetris escala con el jefe (5 → 10 piezas, doble tablero, triple tablero y *perfect clear* en Aethelgard).

---

## 9. Jutsus de Alianza
### ★ Entregable 2 — 3 ataques combinados entre razas

Los **Jutsus de Alianza** son habilidades cooperativas que **solo pueden ejecutar combinaciones específicas de raza + clase** actuando en sincronía. Consumen **Chakra de ambos lanzadores**, comparten **cooldown** y rinden al máximo si se activan en un **"momento clave"** del Sellado.

### Jutsu 1 — **Cataclismo Rúnico**
- **Alianza:** **Enano (Baluarte)** + **Cíclope (Místico)**
- **Ejecución:** el Baluarte ancla un **dominio rúnico de Tierra**; el Místico lo **detona** desde la distancia.
- **Efecto:** AoE de Tierra que inflige daño masivo y **aturde 3 s**; otorga al equipo un **escudo del 15 % de su HP** durante 6 s.
- **Costo:** **60 %** de Chakra de **cada** lanzador. · **Cooldown:** **90 s** (compartido). · **Ventana:** ambos a **≤ 8 m** con el dominio activo.
- **Nota elemental:** se usa por su **control (stun + escudo)**; la Tierra es débil a Rayo, así que no aporta ventaja de daño contra Vortigan.

### Jutsu 2 — **Danza del Eclipse**
- **Alianza:** **Elfo (Verdugo)** + **Humano (Erudito)**
- **Ejecución:** el Erudito **marca** al objetivo con un sello de **savia (Madera)**; el Verdugo descarga una **ráfaga crítica** sobre la marca.
- **Efecto:** durante **8 s**, el grupo gana **+40 % de prob. de crítico** y **+25 % de velocidad de ataque**; al expirar, libera una **nova de curación** (restaura 20 % de HP).
- **Costo:** **50 %** de Chakra c/u. · **Cooldown:** **75 s** (compartido). · **Ventana:** la marca (dura 4 s) debe estar activa al ejecutar.
- **Sinergia elemental:** la marca de **Madera** suma el **+25 %** de ventaja al daño contra **Pyrothar (Fuego)**.

### Jutsu 3 — **Furia del Dragón Ancestral**
- **Alianza:** **Orco (Verdugo)** + **Dracónido (Místico)**
- **Ejecución:** el Dracónido canaliza un **aliento dracónico** que el Orco enciende con su Furia de Sangre (elemento **Fuego** del Orco).
- **Efecto:** **cono de Fuego masivo** (**fuerte vs Viento**) + **DoT de quemadura** 10 s. En un **"momento clave" del Sellado**, el daño se multiplica **×1.5**.
- **Costo:** **70 %** de Chakra c/u. · **Cooldown:** **120 s** (compartido). · **Ventana:** ambos alineados con el cono.
- **Sinergia elemental:** óptimo contra **Sylvaris (Viento)**, **débil a Fuego** → suma el **+25 %** al ×1.5 del Sellado.

> **Tabla resumen**

| Jutsu | Razas (clases) | Costo Chakra | Cooldown | Efecto núcleo |
|---|---|---|---|---|
| Cataclismo Rúnico | Enano (Baluarte) + Cíclope (Místico) | 60 % c/u | 90 s | AoE Tierra + stun 3 s + escudo 15 % |
| Danza del Eclipse | Elfo (Verdugo) + Humano (Erudito) | 50 % c/u | 75 s | +40 % crít, +25 % vel. atq, nova de cura |
| Furia del Dragón Ancestral | Orco (Verdugo) + Dracónido (Místico) | 70 % c/u | 120 s | Cono de Fuego + DoT, ×1.5 en Sellado |

---

## 10. Crafteo de la Espada de Grado Deidad
### ★ Entregable 3 — Proceso exacto de materiales

La **Espada de Grado Deidad** es el arma cúspide de DPS. Su fabricación exige materiales de **los 6 Primordiales**, y su perfeccionamiento a **+15** es la prueba hardcore definitiva (riesgo de Quema).

### 10.1 Cadena de fabricación
```
Espada de Acero Rúnico (base)
        │  + materiales de los 6 Primordiales
        ▼
Espada de Grado Deidad (+0)
        │  refinamiento +1 → +15
        ▼
Espada de Grado Deidad +15 (resplandor divino + pasivas)
```

### 10.2 Paso 1 — Forjar el arma base
**Espada de Acero Rúnico** (en cualquier yunque de ciudad):
- 30× Lingote de Hierro Templado
- 10× Núcleo Rúnico (mazmorras estilo Zelda)
- 5.000 de oro

*(Alternativa: una base **Legendaria** fabricada vía Cristalomancia con un Cristal Primordial también sirve para ascender.)*

### 10.3 Paso 2 — Ascender a Grado Deidad (+0)
Requiere un **Altar de Forja Divina** (capital de la Nación del Bosque Eterno) y los siguientes materiales:

| Material | Cantidad | Fuente |
|---|---|---|
| Espada de Acero Rúnico | 1 | Paso 1 |
| **Núcleo de Deidad** | 1 | Cofre de ranking **Top-10** de cualquier Primordial (garantizado) |
| Lingote de Adamantita Estelar | 20 | Minería en zonas Nv 100+ |
| **Brasa Eterna** | 3 | Pyrothar (Fuego) |
| **Pluma de Tempestad** | 3 | Sylvaris (Viento) |
| **Fragmento de Trueno** | 3 | Vortigan (Rayo) |
| **Corazón Pétreo** | 3 | Terrgoth (Tierra) |
| **Lágrima Abisal** | 3 | Nereon (Agua) |
| **Savia Eterna** | 3 | Aethelgard (Madera) |
| **Esencia del Sello** | 1 | Drop de evento de la **Fase de Oscuridad** |

> Obtener los 6 materiales de Primordial obliga a derrotar **a los 6 jefes** al menos una vez — la receta es, por diseño, una *checklist* de endgame completo.

### 10.4 Paso 3 — Refinamiento (+1 → +15)
Cada intento se realiza en el Altar y consume materiales específicos. **Tabla exacta:**

| Tramo | Prob. de Éxito | Resultado en fallo | Material por intento | Oro por intento |
|---|---|---|---|---|
| **+1 → +5** | 100 % → 95 % | Sin penalización (no retrocede) | 5× Polvo de Refinamiento | 1.000 |
| **+6 → +9** | 80 % → 60 % | **Cristalización** (se bloquea) | 3× Cristal de Refinamiento | 5.000 |
| **+10 → +12** | 50 % → 40 % | **Cristalización** | 2× Esencia de Forja + 1× material de Primordial | 15.000 |
| **+13 → +14** | 35 % → 30 % | **Cristalización** | 1× Esencia Divina | 30.000 |
| **+14 → +15** | **50 % Éxito** | **🔥 Quema: destrucción permanente** (deja 1 Cristal del Sello) | 1× Esencia del Sello + 1× Núcleo de Deidad | 100.000 |

**Reglas de estado (recordatorio de Sección 6):**
- **Cristalización:** el objeto **se bloquea**. Se **restaura** con 1 material de Primordial, o se **desmantela** en Cristales de Legado (calidad según su nivel — ver 6.3).
- **Quema:** **solo** en el salto **+14 → +15**. Si falla (50 %), la espada **se destruye permanentemente**; de sus restos cristaliza **1 Cristal del Sello**, que puede relanzar una nueva base de Grado Deidad vía Cristalomancia (6.4).

### 10.5 Paso 4 — Espada de Grado Deidad +15 (recompensa)
Al alcanzar +15, el arma adquiere **resplandor divino** (efecto visual único, visible a distancia) y desbloquea **pasivas únicas**:

| Pasiva | Efecto |
|---|---|
| **Aura del Sellador** | +10 % de daño contra Primordiales y sus invocaciones |
| **Filo Elemental** | El daño del arma se convierte automáticamente al elemento de **mayor ventaja** contra el objetivo (garantiza el +25 %) |
| **Vínculo Roto** | 5 % de **robo de vida** sobre el daño infligido |

> Una Espada de Grado Deidad +15 es, estadística y narrativamente, el arma capaz de **volver a sellar a los Dioses** — el objetivo final de la Fase de Oscuridad.

---

## 11. Apéndices

### 11.1 Glosario rápido
- **Chakra:** recurso de habilidades elementales y Jutsus de Alianza.
- **Madera (elemento):** 6.º elemento del anillo (vida/naturaleza). **No** confundir con *Madera de Roble*, material base de carpintería usado en la Cristalomancia.
- **Z-Targeting:** sistema de fijado de objetivos heredado del pilar Zelda.
- **Cristalización:** estado de bloqueo recuperable de un objeto refinado.
- **Quema:** destrucción permanente del objeto en el salto a +15 (deja 1 Cristal del Sello).
- **Cristales de Legado:** cristales de reciclaje obtenidos de equipo dañado; calidad según el nivel del objeto.
- **Cristalomancia:** fabricación de equipo combinando un Cristal de Legado + materiales base.
- **Sellado:** minijuego de Tetris para encadenar a los Primordiales.
- **Fase de Oscuridad:** estado de endgame permanente del mundo.

### 11.2 Tabla de referencia de ventaja elemental (6×6)
Filas = atacante · Columnas = defensor.

| Atacante \ Defensor | Fuego | Viento | Rayo | Tierra | Agua | Madera |
|---|---|---|---|---|---|---|
| **Fuego** | ×1.0 | **+25 %** | ×1.0 | ×1.0 | ×1.0 | **−25 %** |
| **Viento** | **−25 %** | ×1.0 | **+25 %** | ×1.0 | ×1.0 | ×1.0 |
| **Rayo** | ×1.0 | **−25 %** | ×1.0 | **+25 %** | ×1.0 | ×1.0 |
| **Tierra** | ×1.0 | ×1.0 | **−25 %** | ×1.0 | **+25 %** | ×1.0 |
| **Agua** | ×1.0 | ×1.0 | ×1.0 | **−25 %** | ×1.0 | **+25 %** |
| **Madera** | **+25 %** | ×1.0 | ×1.0 | ×1.0 | **−25 %** | ×1.0 |

### 11.3 Roadmap de contenido (alto nivel)
1. **Lanzamiento:** campaña hasta el rescate de la Princesa + apertura de la Fase de Oscuridad.
2. **Temporada 1:** ciclo de raids de los 6 Primordiales (incl. Aethelgard) + Forja de Legado + Cristalomancia.
3. **Temporada 2:** afijos de respawn avanzados, sets de armadura de Grado Deidad, PvP de facciones.
4. **Expansión:** nuevos dominios secundarios de cada Nación y desafíos de "perfect clear" cooperativos.

---

*Fin del documento — v1.2. Las cifras de balance (HP, %, cooldowns, probabilidades) son valores de diseño iniciales sujetos a ajuste tras playtesting.*
