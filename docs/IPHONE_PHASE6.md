# Validación en iPhone — Fase 6

La Fase 6 está implementada, pero solo quedará completada cuando David y Esther terminen esta matriz. Antes de empezar, ambos deben abrir la PWA con conexión, esperar **Todo sincronizado** y comprobar que aparece la pestaña **Objetivos** funcional.

## 0. Patrimonio de referencia

1. En el iPhone de David, abre **Inicio → Ver patrimonio**.
2. Comprueba que el patrimonio total coincide con la suma de las cuentas marcadas como incluidas y que la liquidez solo incluye las cuentas líquidas.
3. Comprueba los bloques de ahorro e inversión y el desglose por cuenta.
4. Anota el patrimonio total: los objetivos de los siguientes bloques nunca deben modificarlo.

## 1. Alta y sincronización compartida

1. David crea un objetivo llamado `Viaje prueba`, importe `1.000 €`, fecha futura, icono y nota, con importe inicial `100 €`.
2. Espera **Todo sincronizado**.
3. Esther sincroniza y comprueba nombre, meta, fecha, nota, progreso `10 %` e historial de `100 €` creado por David.
4. En ambos iPhone, **Patrimonio total** debe seguir mostrando exactamente la cifra anotada; **Asignado a objetivos** debe ser `100 €` y **Sin asignar**, patrimonio menos `100 €`.

## 2. Aportar, retirar y exceso

1. Esther abre el objetivo, pulsa **+ Aportar**, registra `250 €` y sincroniza.
2. David sincroniza: ambos deben mostrar `350 €` asignados y el mismo historial, sin duplicados.
3. David pulsa **− Retirar**, registra `50 €` y sincroniza. Ambos deben converger en `300 €`.
4. Intenta retirar `301 €`: la app debe impedirlo y conservar `300 €`.
5. Aporta `750 €`: debe mostrar `1.050 €`, `105 %` y **Supera la meta en 50 €**, sin cambiar patrimonio.

## 3. Edición y estados

1. Edita nombre, importe objetivo, fecha, icono y nota. Comprueba la actualización en el otro iPhone.
2. Pulsa **Completar**: el objetivo conserva su asignación y deja de mostrar el formulario de aportación/retirada.
3. Pulsa **Reabrir**: vuelve a permitir aportaciones y retiradas.
4. Archívalo: desaparece de activos, aparece en **Archivados** y su asignación deja de restar del patrimonio sin asignar.
5. Pulsa **Desarchivar**: vuelve a activo con todo el historial y vuelve a reservar la misma cantidad.

## 4. Concurrencia

1. Con el objetivo en `300 €`, deja ambos iPhone sincronizados.
2. Sin sincronizar entre medias, David retira `200 €` y Esther retira `200 €`.
3. Sincronizad ambos. Solo una retirada puede quedar aceptada: el servidor debe rechazar la que dejaría el objetivo en negativo.
4. Ambos deben acabar viendo `100 €`, el mismo historial y ningún duplicado. Si aparece **cambio rechazado**, confirma que la cifra converge; registra el texto exacto antes de continuar.

## 5. Offline y reapertura

1. En un iPhone activa modo avión y crea un objetivo con importe inicial; cierra por completo la PWA y vuelve a abrirla.
2. Comprueba que el objetivo, su importe y el cambio pendiente siguen visibles.
3. Aporta y retira offline sin dejar el total negativo; vuelve a cerrar y abrir.
4. Recupera conexión y sincroniza ambos iPhone. Deben converger sin duplicados y mantener todo el historial.

## 6. Presentación y accesibilidad

1. Revisa Inicio, Objetivos, detalle y Patrimonio con el tamaño de texto habitual de cada iPhone.
2. Comprueba que no hay importes cortados, botones superpuestos ni desplazamiento horizontal.
3. Verifica modo oscuro si alguno lo usa.
4. Confirma que **+ Aportar** y **− Retirar** permiten introducir importes en iPhone sin necesitar la tecla de signo negativo.

## Resultado a comunicar

Indica si todos los bloques han salido bien. Si alguno falla, incluye: iPhone de David o Esther, bloque/paso, texto exacto del error, cifra esperada y cifra mostrada. No introduzcas datos financieros reales en capturas públicas.

No pruebes cierres mensuales: pertenecen a la Fase 7 y todavía no están implementados.
