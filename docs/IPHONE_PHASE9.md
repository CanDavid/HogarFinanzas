# Validación en iPhone — Fase 9

La Fase 9 solo quedará completada cuando David y Esther terminen esta matriz. No requiere una nueva migración ni un nuevo despliegue de Google Apps Script: el Web App sigue en la versión de la Fase 7, la copia de seguridad es un fichero local y la corrección de sincronización solo cambia cómo el cliente envía las operaciones que ya conocía.

Antes de empezar, ambos deben abrir la PWA con conexión, aceptar la actualización si aparece, cerrarla y volver a abrirla. Esperad a ver **Todo sincronizado**.

No compartáis el fichero exportado si contiene importes financieros reales; podéis validar con vuestros datos existentes o con movimientos de prueba reconocibles, y borrar el fichero después.

## 1. Exportar copia

1. En David, abre **Ajustes → Copia de seguridad**.
2. Pulsa **Exportar copia**. Debe descargarse un archivo `hogar-finanzas-copia-AAAA-MM-DD.json` con la fecha de hoy.
3. Abre el archivo (por ejemplo, desde la app Archivos) y comprueba que contiene tus cuentas, categorías y movimientos reales, sin errores visibles.

## 2. Restaurar solo está disponible sin datos locales

1. En un iPhone con datos ya sincronizados, entra en **Ajustes → Copia de seguridad → Restaurar**.
2. Debe explicar que la restauración solo está disponible en una casa recién inicializada y **no** debe mostrar el selector de archivo.

## 3. Restaurar en un dispositivo vacío

1. En Safari, borra los datos del sitio de Hogar Finanzas (Ajustes de Safari → Avanzado → Datos de sitios web) o instala la PWA en un dispositivo/perfil sin datos, y **no inicies sesión todavía si ya tienes datos reales que no quieres perder** — usa un hogar de prueba o coordina con Esther antes de restaurar sobre datos reales.
2. Entra en la sesión y ve a **Ajustes → Copia de seguridad → Restaurar**; debe aparecer el selector de archivo.
3. Elige el archivo exportado en el paso 1. Debe aparecer un resumen con el número de cuentas, categorías, movimientos, recurrentes, presupuestos, previstos, distribuciones, objetivos, aportaciones/retiradas y cierres, **sin** haber restaurado nada todavía.
4. Pulsa **Confirmar restauración**. Al terminar, tus cuentas, movimientos, objetivos y cierres deben aparecer con los mismos importes y fechas que en el original.
5. Si en el original existía una cuenta o categoría archivada, o un objetivo completado, comprueba que reaparecen en su estado archivado/completado correcto (no activos "por error").
6. Sincroniza. Los cambios deben subir sin quedarse bloqueados aunque haya cientos de movimientos (verás el contador de pendientes bajar progresivamente en el banner superior, no un error inmediato).

## 4. Convergencia entre los dos iPhone

1. Tras sincronizar el dispositivo restaurado, abre Esther y sincroniza.
2. Esther debe ver exactamente los mismos datos restaurados, sin duplicados ni movimientos repetidos.
3. La autoría de los movimientos restaurados debe figurar como quien hizo la restauración (es un efecto esperado, no un error).

## 5. Ficheros inválidos

1. Intenta restaurar un archivo de texto cualquiera (no JSON) o un JSON sin relación con Hogar Finanzas. Debe mostrar un error claro, sin pantalla en blanco.
2. Si tienes a mano una copia de una versión anterior de la app (si existiera), debe rechazarse indicando que no es compatible.

## 6. Rendimiento con histórico largo

1. Con datos reales de varios meses, abre **Análisis** y recorre 12 meses y **A medida** con un rango amplio.
2. Debe sentirse ágil, sin bloqueos perceptibles al cambiar de periodo.

## 7. Accesibilidad

1. Activa VoiceOver y navega Movimientos: al pulsar "Añadir" o "Filtros", el foco debe moverse al formulario/panel abierto, no quedarse donde estaba.
2. Comprueba que el banner de sincronización anuncia sus cambios de estado sin tener que tocarlo.
3. Revisa que los botones de "Eliminar", "Archivar/Desarchivar" y los de cabecera tienen un área táctil cómoda, sin pulsaciones fallidas.
4. En modo oscuro, revisa que los textos secundarios (leyendas, subtítulos) se leen con comodidad.

## Resultado a comunicar

Indica si todos los bloques han salido bien. Si alguno falla, incluye: iPhone de David o Esther, bloque/paso, cifra o comportamiento esperado, cifra o comportamiento mostrado y texto exacto del error.
