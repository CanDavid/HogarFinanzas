# Validación en iPhone — Fase 8

La Fase 8 solo quedará completada cuando David y Esther terminen esta matriz. No requiere actualizar Google Apps Script: el análisis se calcula en cada iPhone con los datos que ya están sincronizados.

Antes de empezar, ambos deben abrir la PWA con conexión, aceptar la actualización si aparece, cerrarla y volver a abrirla. Esperad a ver **Todo sincronizado** y comprobad que **Análisis** ya no muestra una pantalla informativa.

No compartáis capturas con importes financieros reales. Podéis validar con vuestros datos existentes o con movimientos de prueba reconocibles.

## 1. Periodos y resultado

1. En David, abre **Análisis** y recorre **3 meses**, **6 meses**, **12 meses** y **Este año**.
2. Comprueba que las fechas de la tarjeta superior corresponden al selector y que el último día es hoy.
3. Pulsa **A medida**, elige un intervalo que empiece y termine a mitad de mes y comprueba que solo suma movimientos dentro de esas fechas.
4. Invierte las fechas: debe aparecer un error claro y no una pantalla en blanco. Corrígelas para continuar.
5. Para un intervalo sencillo, verifica: **resultado real = ingresos − gastos**. Una transferencia y un ajuste de saldo no deben cambiar esas cifras.

## 2. Gasto mensual y categorías

1. Elige un periodo con gastos en al menos dos meses.
2. En **Gasto mensual**, compara cada importe con Movimientos filtrado al mismo mes y tipo Gasto.
3. Las barras deben guardar proporción, pero cada mes también debe mostrar su importe exacto.
4. En **Gasto por categoría**, comprueba que el orden va de mayor a menor y que importe y porcentaje cuadran con el gasto total.
5. Un movimiento sin categoría, si existe por datos antiguos, debe agruparse como **Sin categoría** sin romper la pantalla.

## 3. Presupuesto frente a gasto

1. Abre un mes que tenga presupuestos y despliega su bloque.
2. Comprueba una categoría con la fórmula: **disponible = presupuesto − gasto variable real**.
3. Los gastos recurrentes o creados desde Previsto no deben entrar en esta comparación, aunque sí cuentan en el gasto mensual total.
4. Si una categoría excede el presupuesto, debe indicar **Excedido en …** y el porcentaje; no debe depender solo del color.

## 4. Patrimonio en cierres

1. Selecciona un periodo con al menos dos meses cerrados.
2. Compara los puntos e importes con los snapshots que aparecen en Plan para esos cierres.
3. Un mes reabierto no debe aparecer hasta que vuelva a cerrarse.
4. La lectura de patrimonio debe indicar aumento, disminución o igualdad entre el primer y último cierre visibles.

## 5. Ahorro y objetivos

1. En un mes sencillo, verifica: **ahorro neto = ingresos reales − gastos reales**. Si es negativo debe mostrarse como negativo.
2. Cuando los ingresos sean mayores que cero, verifica: **tasa orientativa = max(ahorro neto, 0) / ingresos × 100**, redondeada al entero más cercano.
3. Comprueba que **Neto acumulado del año** usa desde el 1 de enero hasta hoy, aunque el selector sea de 3 meses.
4. En **Objetivos activos**, compara asignado, meta y porcentaje con la pestaña Objetivos.
5. El valor **en el periodo** debe incluir solo aportaciones o retiradas fechadas dentro del intervalo; un objetivo completado o archivado no debe aparecer.

## 6. Lecturas, offline y presentación

1. Comprueba que las lecturas concuerdan con los importes: diferencia frente al mes anterior, exceso de presupuesto y variación de patrimonio cuando haya datos.
2. Las lecturas deben presentarse como cálculos locales, sin consejo de inversión ni afirmaciones inventadas cuando falte historial.
3. Activa modo avión, cierra por completo la PWA y vuelve a abrir **Análisis**. Periodos y cifras deben seguir disponibles.
4. Repite una revisión básica en Esther tras sincronizar: ambos deben ver los mismos totales y cierres.
5. Revisa con el tamaño de texto habitual, zoom si lo usáis y modo oscuro. No debe haber importes cortados, botones superpuestos, desplazamiento horizontal ni pantalla en blanco.

## Resultado a comunicar

Indica si todos los bloques han salido bien. Si alguno falla, incluye: iPhone de David o Esther, bloque/paso, periodo elegido, estado de conexión, cifra esperada, cifra mostrada y texto exacto del error.

No pruebes exportación, importación ni copias: pertenecen a la Fase 9 y no están implementadas.
