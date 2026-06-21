# Pseudocódigo — Refinamiento: Éxito vs Cristalización vs Quema

> Lógica de probabilidad del sistema de forja hardcore (Sección 6 y 10 del GDD).
> Tres resultados: **Éxito** (sube de nivel), **Cristalización** (se bloquea, recuperable)
> y **Quema** (destrucción permanente, solo en el salto a +15; deja 1 *Cristal del Sello*).

---

## Tabla de probabilidades por nivel
```
NIVEL_ACTUAL -> NIVEL_OBJETIVO :  P(Éxito)   RESULTADO_SI_FALLA
   +1 .. +5  (a +2 .. +6)      :  100%→95%   NADA (no retrocede)
   +6 .. +9  (a +7 .. +10)     :   80%→60%   CRISTALIZACIÓN
  +10 .. +12 (a +11 .. +13)    :   50%→40%   CRISTALIZACIÓN
  +13 .. +14 (a +14 .. +15*)   :   35%→30%   CRISTALIZACIÓN
  +14 -> +15  (salto final)    :   50%       QUEMA (destrucción)
```

```
TABLA_EXITO = {
  1:1.00, 2:1.00, 3:1.00, 4:0.97, 5:0.95,
  6:0.80, 7:0.74, 8:0.67, 9:0.60,
  10:0.50, 11:0.45, 12:0.40,
  13:0.35, 14:0.30,        // 14 = intento +14→+15
}
// Nota: el intento parte de NIVEL_ACTUAL; la clave es NIVEL_ACTUAL.
PROB_EXITO_MAS15 = 0.50    // caso especial +14 -> +15
```

---

## Función principal
```
FUNCIÓN intentarRefinar(item, inventario):

    # 0) Validaciones
    SI item.estado == "CRISTALIZADO":
        DEVOLVER Resultado(NO_PERMITIDO, "Debes RESTAURAR el objeto antes de refinar")
    SI item.nivel >= 15:
        DEVOLVER Resultado(NO_PERMITIDO, "Nivel máximo alcanzado")

    nivel   = item.nivel                 # p.ej. 14 para intentar +15
    receta  = materialesRequeridos(nivel)
    SI NO inventario.contiene(receta):
        DEVOLVER Resultado(SIN_MATERIALES, receta)

    inventario.consumir(receta)          # los materiales se gastan SIEMPRE, falle o no

    # 1) ¿Es el salto final a +15? (única fase con QUEMA)
    SI nivel == 14:
        p = PROB_EXITO_MAS15             # 0.50
        SI tirada() < p:
            item.nivel = 15
            item.estado = "ASCENDIDO"    # resplandor divino + pasivas
            DEVOLVER Resultado(EXITO, item)
        SINO:
            # QUEMA: destrucción permanente
            cristal = generarCristalDelSello(item)   # botín de consuelo (reciclaje)
            inventario.añadir(cristal)
            item.destruir()
            DEVOLVER Resultado(QUEMA, cristal)

    # 2) Resto de niveles: ÉXITO o CRISTALIZACIÓN (nunca destrucción)
    p = TABLA_EXITO[nivel]
    SI tirada() < p:
        item.nivel = nivel + 1
        item.actualizarStatsYAura()
        DEVOLVER Resultado(EXITO, item)
    SINO:
        # Por debajo de +6 el fallo no penaliza; a partir de +6, cristaliza
        SI nivel >= 6:
            item.estado = "CRISTALIZADO"    # bloqueado, NO se pierde
            DEVOLVER Resultado(CRISTALIZACION, item)
        SINO:
            DEVOLVER Resultado(FALLO_SIN_PENALIZACION, item)


FUNCIÓN tirada():
    DEVOLVER aleatorio()          # número real en [0, 1)
```

---

## Restaurar un objeto cristalizado
```
FUNCIÓN restaurar(item, inventario):
    SI item.estado != "CRISTALIZADO":
        DEVOLVER Resultado(NO_PERMITIDO)
    coste = 1 × MaterialDeDios   # a elección del jugador (Sección 10.4 del GDD)
    SI NO inventario.contiene(coste):
        DEVOLVER Resultado(SIN_MATERIALES, coste)
    inventario.consumir(coste)
    item.estado = "NORMAL"       # conserva su nivel; puede volver a refinarse
    DEVOLVER Resultado(RESTAURADO, item)
```

---

## Notas de diseño y balance
- **La Quema solo existe en +14→+15.** En el resto, lo peor es la Cristalización (recuperable) → el riesgo de pérdida TOTAL se concentra en el último gran salto, creando tensión sin frustrar el progreso temprano.
- **Esperanza matemática del +15:** con 50 % por intento, el número medio de intentos para lograr un +15 es 2, pero cada fallo **destruye** el arma y obliga a re-forjarla desde +0 → cada +15 del servidor es un logro real (economía de prestigio).
- **Nada se pierde del todo:** la Quema deja un *Cristal del Sello* (máxima calidad) que realimenta la **Cristalomancia** (Sección 6.4), suavizando el golpe sin quitarle peso.
- **Anti-explotación:** los materiales se consumen SIEMPRE (éxito o fallo), evitando "save-scumming" si en el futuro hay persistencia/online.
- **Gancho narrativo:** la Princesa comenta los fallos de Quema (ver `dialogos-princesa-sello.md`).

> Implementación de referencia: la tabla coincide con la del GDD §10.4. En el prototipo web podría vivir en un futuro `js/forge.js`.
```
estado(item) ∈ { NORMAL, CRISTALIZADO, ASCENDIDO(+15), DESTRUIDO }
```
