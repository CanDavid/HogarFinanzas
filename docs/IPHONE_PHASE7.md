# Validación en iPhone — Fase 7

La Fase 7 solo quedará completada cuando David y Esther terminen esta matriz. Antes de empezar, ambos deben abrir la PWA con conexión, aceptar la actualización si aparece, cerrarla y volver a abrirla. Esperad a ver **Todo sincronizado** y comprobad en **Plan** que aparece **Cerrar mes**.

Usad datos de prueba reconocibles y el mes actual. No compartáis capturas con importes financieros reales.

## 0. Preparación controlada

1. En David, crea un previsto manual de ingreso llamado `Ingreso cierre prueba` por `100 €` y uno de gasto llamado `Gasto cierre prueba` por `30 €`, ambos en el mes actual.
2. Configura un presupuesto de prueba de `50 €` y una distribución de ahorro `10 €` e inversión `5 €`.
3. Sincroniza ambos iPhone y comprueba que Esther ve exactamente los mismos datos.
4. Anota si el mes siguiente ya tenía presupuesto o distribución: el cierre nunca debe sobrescribir configuración existente.

## 1. Checklist y cancelación

1. En David, abre **Plan → Cerrar mes**.
2. Comprueba que el checklist muestra movimientos, ingresos pendientes, gastos pendientes, resultado real, patrimonio, ahorro, inversión y reserva de objetivos.
3. Pulsa **Cancelar**. El mes debe seguir abierto y editable, sin crear ningún cierre.
4. Abre de nuevo el cierre y selecciona **Mantenerlos como no realizados**.

## 2. Cierre compartido y arrastre

1. David confirma el cierre y espera **Todo sincronizado**.
2. Debe aparecer **Mes cerrado**, revisión 1, autor David, fecha, snapshot y botón **Reabrir mes**.
3. Revisa **Previstos**, **Presupuestos** y **Distribución**: se pueden consultar, pero no añadir, editar, omitir, materializar ni guardar.
4. En **Movimientos**, los registros del mes muestran **Cerrado** y no permiten editar ni eliminar.
5. Esther sincroniza y debe ver el mismo cierre, revisión y cifras, también en solo lectura.
6. Navega al mes siguiente. El presupuesto positivo y la distribución deben haberse copiado si no existían; si ya había configuración, debe conservarse intacta. Las recurrencias deben seguir apareciendo desde sus reglas, sin duplicados.

## 3. Bloqueo ante un segundo móvil desactualizado

1. Reabre el mes desde David y sincroniza ambos.
2. Pon el iPhone de Esther sin conexión. Después vuelve a cerrar el mes desde David y espera **Todo sincronizado** solo en David.
3. Todavía sin conexión, crea en Esther un movimiento `Conflicto cierre prueba` dentro del mes.
4. Reconecta Esther y sincroniza. El servidor debe rechazar ese movimiento porque el mes ya está cerrado; puede mostrarse una vez **1 cambio rechazado**.
5. Sincroniza de nuevo. El movimiento de conflicto debe desaparecer, no debe quedar ningún cambio pendiente y ambos iPhone deben mostrar el mismo mes cerrado. El movimiento nunca debe aparecer en David.

## 4. Reapertura y decisión de omitir

1. Esther pulsa **Reabrir mes** y sincroniza. David sincroniza: ambos deben mostrar **Reabierto · revisión 1** y recuperar todas las acciones de edición.
2. Abre **Cerrar mes**, elige **Marcarlos como omitidos** y confirma.
3. Debe quedar **Mes cerrado · revisión 2**, con Esther como autora del cierre.
4. Reabre una vez más y comprueba que los dos previstos de prueba aparecen como **Omitido** y pueden reactivarse. Reactívalos si deseas conservarlos o elimínalos como limpieza.
5. Vuelve a cerrar. La revisión debe aumentar a 3 y el snapshot debe reflejar el estado final, sin crear una segunda fila de cierre.

## 5. Persistencia offline

1. Con el mes cerrado, activa modo avión, cierra por completo la PWA y vuelve a abrirla.
2. El cierre, snapshot y modo de solo lectura deben seguir visibles.
3. Reabre offline, cierra y vuelve a abrir la PWA: el estado reabierto debe persistir localmente y quedar como cambio pendiente.
4. Vuelve a conectar y sincroniza primero ese iPhone y después el otro. Ambos deben converger en el mismo estado y revisión, sin duplicados ni cola bloqueada.
5. Para dejar un checkpoint estable, cerrad de nuevo el mes y sincronizad ambos.

## 6. Variación y presentación

1. Tras tener un mes anterior cerrado, abre **Inicio** en un mes posterior. Bajo Patrimonio debe aparecer la variación desde el último cierre anterior con signo y nombre del mes.
2. Revisa cierre y snapshot con el tamaño de texto habitual de ambos iPhone y, si procede, modo oscuro.
3. Confirma que no hay importes cortados, botones superpuestos, pantalla en blanco ni desplazamiento horizontal.

## Resultado a comunicar

Indica si todos los bloques han salido bien. Si alguno falla, incluye: iPhone de David o Esther, bloque/paso, estado de conexión, texto exacto del error, revisión esperada y revisión mostrada.

No pruebes gráficos ni tendencias: pertenecen a la Fase 8 y no están implementados.
