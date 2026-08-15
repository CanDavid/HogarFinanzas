# Aceptación en iPhone — Fase 5

Prerrequisitos: `migratePhase5` ejecutada, Web App `5.0.2-phase5` desplegada y PWA `5.0.4` actualizada en ambos iPhone. Sincroniza ambos antes de empezar. Usa datos de prueba identificables y no compartas aquí la clave doméstica ni tokens.

## 0 bis. Claridad de edición y proyección — PWA 5.0.4

1. Edita un movimiento, cambia su importe y confirma que el botón dice **Guardar cambios**, sin mostrar el importe anterior.
2. Guarda y comprueba que el movimiento conserva el importe escrito en el campo.
3. En **Plan**, comprueba que la tarjeta muestra la operación numérica y que existen las métricas **Ingresos pendientes**, **Gastos reales totales** y **Variable pendiente de gastar**.
4. Con los datos de la captura de prueba, verifica: `125 + 0 − 4.360 − 0 − 1.833 = −6.068 €`.

Resultado esperado: el botón no presenta una cifra desfasada y todos los términos usados para el disponible estimado pueden comprobarse directamente en pantalla.

## 0. Regresión del hotfix 5.0.2

1. Abre la PWA con conexión en ambos iPhone, acepta la actualización y ciérrala/ábrela una vez si no aparece el aviso.
2. En David, crea un presupuesto y deja que termine la sincronización automática sin pulsar varias veces el indicador.
3. Confirma que el presupuesto continúa visible en David y que no aparece un error en la primera sincronización.
4. Sincroniza Esther y confirma que recibe el mismo presupuesto.
5. Edita el importe desde Esther, sincroniza ambos y comprueba que el último valor permanece en los dos.

Resultado esperado: reaparece el presupuesto anterior si seguía local o pendiente, ningún presupuesto nuevo desaparece y no hay cambios rechazados. Los meses convertidos por Sheets y sus operaciones pendientes se reparan automáticamente.

## 1. Actualización y plan compartido

1. Abre la PWA con conexión en ambos iPhone y acepta la actualización si aparece.
2. Entra en **Plan** y confirma que muestra el mes actual, el selector de mes y las secciones **Previstos**, **Presupuestos** y **Distribución**.
3. Comprueba que las recurrencias activas del mes aparecen una sola vez como pendientes y con la etiqueta **Recurrente**.
4. En el iPhone de David, añade un gasto previsto manual con cuenta, categoría y fecha del mes. Sincroniza ambos.

Resultado esperado: Esther ve exactamente el mismo previsto; no hay pantalla blanca ni cambios rechazados.

## 2. Omitir, reactivar y realizar

1. Esther pulsa **Omitir** sobre una ocurrencia recurrente pendiente y sincroniza.
2. David sincroniza: debe verla como **Omitido** y la proyección ya no debe incluir su importe.
3. David pulsa **Reactivar** y sincroniza; Esther debe volver a verla pendiente.
4. Esther pulsa **Marcar pagado** o **Marcar recibido** sobre el previsto manual y sincroniza ambos.
5. Comprueba en **Movimientos** que existe un único movimiento con esos datos y en **Plan** figura **Realizado**.

Resultado esperado: los estados convergen y el movimiento realizado no se contabiliza a la vez como real y pendiente.

## 3. Presupuesto variable

1. David abre **Presupuestos**, elige una categoría de gasto y guarda un importe reconocible.
2. Esther sincroniza y confirma el mismo presupuesto, consumido y disponible.
3. Registra un gasto real en esa categoría, sincroniza y revisa Plan en ambos iPhone.
4. Edita el presupuesto desde Esther; sincroniza David.
5. Guarda importe `0` y confirma tras sincronizar que esa categoría deja de aparecer como presupuesto activo.

Resultado esperado: consumido y restante son correctos; si el gasto supera el límite, el restante queda en 0 y se conserva el porcentaje real de consumo.

## 4. Distribución mensual y fórmula

1. En **Distribución**, David asigna parte del resultado proyectado a **Ahorro** y **Inversión**.
2. Esther sincroniza y comprueba los mismos importes y el valor **Sin asignar**.
3. Confirma que guardar la distribución no crea movimientos ni cambia saldos o patrimonio.
4. Revisa con cantidades sencillas que el disponible estimado responde a: ingresos reales + pendientes − gastos reales − fijos pendientes − presupuesto variable restante.
5. Si hay transferencias o ajustes ese mes, confirma que no aparecen como ingreso o gasto del plan.

## 5. Concurrencia e idempotencia

1. Con ambos iPhone sincronizados, abre la misma ocurrencia recurrente pendiente en los dos.
2. Sin sincronizar entre medias, pulsa **Marcar pagado/recibido** en ambos.
3. Sincroniza primero uno, después el otro y finalmente ambos otra vez.
4. Repite una edición simultánea sobre el mismo presupuesto desde ambos iPhone con importes diferentes.

Resultado esperado: hay un único movimiento para la ocurrencia, ningún cambio rechazado y el presupuesto converge al último cambio aceptado.

## 6. Persistencia offline

1. Pon un iPhone en modo avión.
2. Crea o edita un previsto, omite una ocurrencia y cambia un presupuesto o la distribución.
3. Cierra completamente la PWA, ábrela aún sin conexión y confirma que todos los cambios permanecen como pendientes.
4. Recupera conexión, sincroniza y después sincroniza el otro iPhone.

Resultado esperado: no se pierde ningún cambio, ambos dispositivos convergen y no aparecen duplicados ni rechazos permanentes.

## Cierre

Comunica el resultado de cada bloque y cualquier incidencia indicando dispositivo, identidad, conexión, acción y mensaje visible. No borres datos de Safari ante un fallo: la cola local ayuda a diagnosticarlo. La Fase 6 no se inicia hasta que esta matriz esté validada.
