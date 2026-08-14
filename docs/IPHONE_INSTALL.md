# Instalación y aceptación en iPhone — Fase 1

Prerrequisitos: Apps Script desplegado, Pages publicado, conexión inicial a Internet y un iPhone para David y otro para Esther.

## Instalar

1. Abre la URL de GitHub Pages en Safari, no dentro de otro navegador.
2. Pulsa **Compartir → Añadir a pantalla de inicio → Añadir**.
3. Abre **Hogar Finanzas** desde el nuevo icono.
4. Selecciona el usuario correspondiente, despliega configuración si necesitas pegar la URL `/exec`, introduce la clave y entra.

## Matriz de aceptación

Marca cada fila y comunica el resultado antes de cerrar la fase.

| Caso | iPhone David | iPhone Esther | Resultado esperado |
|---|---:|---:|---|
| Instalación y apertura standalone | ☐ | ☐ | Abre sin barra de Safari |
| Login | ☐ | ☐ | Identidad correcta, sin pedir Google |
| David crea gasto | ☐ | ☐ | Esther lo recibe tras sincronizar |
| Esther crea ingreso | ☐ | ☐ | David lo recibe una sola vez |
| Editar movimiento remoto | ☐ | ☐ | Ambos convergen al último aceptado |
| Eliminar movimiento | ☐ | ☐ | Desaparece en ambos y no reaparece |
| Crear sin conexión | ☐ | ☐ | Se ve localmente y queda pendiente |
| Cerrar/reabrir sin conexión | ☐ | ☐ | Datos y pendiente persisten |
| Reconectar ambos | ☐ | ☐ | Convergen sin duplicados |
| Modo claro/oscuro y texto grande | ☐ | ☐ | Contenido legible y utilizable |

## Edición concurrente

1. Ambos abren el mismo movimiento.
2. Sin sincronizar entre medias, David cambia el concepto y guarda.
3. Esther cambia el concepto y guarda después.
4. Sincroniza ambos. Debe quedar el último cambio aceptado por el servidor, sin crash ni duplicado.

## Tombstone

1. Un dispositivo abre un movimiento para editar.
2. El otro lo elimina y sincroniza.
3. El primero intenta guardar y sincroniza.
4. El movimiento no debe reaparecer; debe indicarse el error permanente.

## Si algo falla

Anota modelo/iOS, conexión, usuario, paso exacto, mensaje visible y hora aproximada. No envíes capturas que muestren clave, token o descripciones/importes reales. Si Safari bloquea la respuesta del Web App, detener la Fase 1: no se habilita ningún workaround inseguro.
