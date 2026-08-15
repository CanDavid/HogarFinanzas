# Aceptación en iPhone — Fase 4

Prerrequisitos: `migratePhase4` ejecutada, Web App `4.0.0-phase4` desplegada y PWA actualizada en ambos iPhone. Sincroniza ambos antes de empezar. Usa importes y conceptos de prueba, nunca compartas aquí la clave doméstica ni el token.

## 1. Actualización y regla compartida

1. En ambos iPhone, abre la PWA con conexión y confirma que en **Ajustes** aparece **Recurrentes**.
2. En el iPhone de David, crea un gasto normal activando **Se repite**: frecuencia mensual, próxima fecha futura y sin fecha final.
3. Confirma que el movimiento actual aparece con la etiqueta **Recurrente**.
4. Sincroniza el iPhone de Esther. En **Ajustes → Recurrentes** debe aparecer una sola regla con los mismos datos y próximas fechas.

Resultado esperado: una regla compartida y un único movimiento actual, sin errores ni pantalla en blanco.

## 2. Edición, pausa y reactivación

1. Esther edita el concepto o importe de la regla y sincroniza.
2. David sincroniza y comprueba el cambio.
3. David pulsa **Pausar**. Esther sincroniza: la regla debe mostrarse pausada y sin acciones para registrar fechas.
4. Esther pulsa **Reactivar**. David sincroniza: la regla vuelve a estar activa.

Resultado esperado: el estado converge en ambos sentidos; pausar no elimina movimientos ya registrados.

## 3. Ocurrencia idempotente entre ambos iPhone

1. Con ambos iPhone sincronizados, abre la misma regla en los dos.
2. Sin volver a sincronizar entre medias, pulsa **Registrar** para la misma fecha en ambos dispositivos.
3. Sincroniza primero uno y después el otro; vuelve a sincronizar ambos.
4. En **Movimientos**, selecciona periodo **Todo** y filtro **Recurrentes**.

Resultado esperado: existe exactamente un movimiento para esa regla y fecha. Ningún teléfono muestra cambios rechazados.

## 4. Persistencia offline

1. Pon un iPhone en modo avión.
2. Crea una regla recurrente distinta o registra una próxima ocurrencia.
3. Cierra completamente la PWA, vuelve a abrirla aún sin red y confirma que el cambio permanece y figura pendiente.
4. Recupera la conexión y sincroniza. En el otro iPhone sincroniza también.

Resultado esperado: el cambio offline no se pierde y ambos dispositivos convergen sin duplicados.

## 5. Calendario y fecha final

1. Crea una regla mensual cuya próxima fecha sea el día 31 de un mes y añade una fecha final que permita al menos dos ocurrencias.
2. Comprueba que los meses más cortos usan su último día válido y que no aparecen fechas posteriores al final.
3. Crea brevemente una regla trimestral o anual y confirma que el texto de frecuencia y próximas fechas son correctos; después puedes pausarla.

## Cierre

Comunica el resultado de cada bloque y cualquier incidencia indicando dispositivo, versión de iOS, identidad, conexión, acción y mensaje visible. No borres los datos de Safari para intentar arreglar un fallo: la cola offline es evidencia necesaria. La Fase 5 no se inicia hasta que esta matriz esté validada.
