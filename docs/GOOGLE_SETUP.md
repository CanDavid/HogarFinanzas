# Configuración de Google — Fases 1 a 5

Estas acciones requieren la cuenta Google que será propietaria de la hoja. No publiques la clave doméstica, tokens ni contenido de la hoja.

## 1. Crear el contenedor

1. Crea una hoja de cálculo vacía en Google Sheets, por ejemplo `Hogar Finanzas Datos`.
2. En la hoja abre **Extensiones → Apps Script**.
3. Sustituye el contenido de `Code.gs` por el archivo versionado `apps-script/Code.gs`.
4. En **Configuración del proyecto**, activa la visualización del manifiesto y sustituye `appsscript.json` por el archivo versionado.
5. Guarda el proyecto.

## 2. Inicializar

1. Recarga la hoja de cálculo para que aparezca el menú **Hogar Finanzas**.
2. Elige **Hogar Finanzas → Inicializar o cambiar clave**.
3. Introduce en el diálogo una clave doméstica única de al menos 10 caracteres y acepta.
4. Autoriza el script cuando Google lo solicite.
5. Verifica que se crearon las 13 pestañas y que `Users` contiene David y Esther.

La clave no se copia en el código ni se guarda en una celda.

La inicialización configura `SPREADSHEET_ID`, hash/sal de clave y secreto de tokens en Script Properties. Volver a ejecutarla cambia la clave y revoca de hecho las sesiones anteriores.

## 3. Desplegar el Web App

1. Pulsa **Implementar → Nueva implementación → Aplicación web**.
2. Ejecutar como: **yo**.
3. Quién tiene acceso: **cualquier usuario**, sin exigir login Google.
4. Implementa y copia la URL terminada en `/exec`; nunca uses la URL `/dev`.
5. Abre la URL en una pestaña. Debe responder JSON con `service: Hogar Finanzas`.

El acceso HTTP anónimo es intencionado: las acciones privadas siguen exigiendo clave/token firmado. No compartas el enlace innecesariamente.

## 4. Conectar la PWA

Se puede pegar la URL desde **Configuración del servidor** en la pantalla de login. Para dejarla precargada en Pages, crea la variable de repositorio `VITE_APPS_SCRIPT_URL` con la URL pública y vuelve a ejecutar el workflow Pages. No es un secreto.

## 5. Actualizaciones

La cuenta propietaria tiene habilitada la Apps Script API y `clasp` autorizado localmente. La herramienta oficial se ejecuta con `npx` fijada a la versión `3.3.0`, sin incorporarla al bundle ni a las dependencias del producto. La credencial se guarda fuera de Git; `.clasp.json` solo contiene el identificador público del proyecto.

1. `npm run apps-script:status` muestra exclusivamente `Code.gs` y `appsscript.json` como archivos rastreados.
2. `npm run apps-script:deploy -- versionX.Y.Z-phaseN` sube los archivos, crea una versión inmutable y actualiza el deployment existente conservando la misma URL `/exec`.
3. Abre la URL y confirma el health check antes de probar la PWA.

Si se pierde la autorización local, ejecuta `npm run apps-script:login` y completa OAuth con la cuenta propietaria. No se deben copiar `.clasprc.json`, tokens ni credenciales al repositorio.

### Migración a Fase 2

1. Publica la PWA nueva y deja que ambos iPhone actualicen el app shell antes de crear datos nuevos.
2. Sustituye `Code.gs`, guarda y ejecuta **Hogar Finanzas → Migrar a Fase 2** desde la hoja.
3. Autoriza si Google lo solicita. La migración amplía cabeceras, conserva filas y crea las categorías iniciales sin duplicarlas.
4. Crea una versión nueva de la implementación manteniendo la misma URL `/exec`.
5. Comprueba que el health check devuelve `2.0.0-phase2`.

No vuelvas a ejecutar **Inicializar o cambiar clave** para esta migración: no es necesario renovar la clave ni las sesiones.

### Migración a Fase 3

1. Sustituye `Code.gs` por la versión de Fase 3 y guarda el proyecto.
2. Recarga la hoja y ejecuta **Hogar Finanzas → Migrar a Fase 3**.
3. Comprueba que devuelve `schemaVersion: 3`; la migración añade `note` al final de `Transactions` sin alterar las filas existentes.
4. Crea una versión nueva de la implementación manteniendo la misma URL `/exec`.
5. Abre la URL y confirma que el health check devuelve `3.0.1-phase3`.
6. Después actualiza/reabre la PWA en ambos iPhone. No guardes notas nuevas antes de confirmar la versión del Web App, porque el backend anterior no conserva ese campo.

No ejecutes **Inicializar o cambiar clave**: `migratePhase3` conserva clave, sesiones y datos.

### Migración a Fase 4

La automatización autorizada puede ejecutar `migratePhase4` desde el proyecto y después `npm run apps-script:deploy`; el segundo comando sube los archivos y promueve la implementación existente sin cambiar su URL. Si se realiza manualmente:

1. Sustituye `Code.gs` por la versión de Fase 4 y guarda el proyecto.
2. Recarga la hoja y ejecuta **Hogar Finanzas → Migrar a Fase 4**.
3. Comprueba `schemaVersion: 4`, `transactionColumns: 18` y `recurringRuleColumns: 17`. La migración añade los vínculos recurrentes a `Transactions` y amplía `RecurringRules` sin alterar filas previas.
4. Crea una versión nueva en la misma implementación para conservar la URL `/exec`.
5. Confirma que el health check devuelve `4.0.0-phase4` antes de crear recurrencias desde los iPhone.

No ejecutes **Inicializar o cambiar clave**: `migratePhase4` conserva la clave, las sesiones y todos los datos existentes.

### Migración a Fase 5

La automatización autorizada puede ejecutar `migratePhase5` desde el editor y promover después la implementación con `npm run apps-script:deploy -- version5.0.0-phase5`. Si se realiza manualmente:

1. Sustituye `Code.gs` por la versión de Fase 5 y guarda el proyecto.
2. Recarga la hoja y ejecuta **Hogar Finanzas → Migrar a Fase 5**.
3. Comprueba `schemaVersion: 5`, `transactionColumns: 19`, `budgetColumns: 10`, `plannedItemColumns: 17` y `monthlyPlanColumns: 10`.
4. Verifica que existen `Budgets`, `PlannedItems` y `MonthlyPlans`; las filas previas de `Transactions` y el resto de hojas deben conservarse.
5. Crea una versión nueva en la misma implementación y confirma que el health check devuelve la versión de Fase 5 vigente (`5.0.2-phase5` o posterior) antes de usar Plan en los iPhone.

No ejecutes **Inicializar o cambiar clave**: `migratePhase5` conserva la clave, las sesiones y todos los datos existentes.

## Diagnóstico seguro

- `not_initialized`: faltó ejecutar el inicializador.
- `invalid_credentials`: usuario/clave incorrectos.
- `invalid_token` o `expired_token`: cerrar sesión y volver a entrar.
- Sin respuesta legible tras la redirección: registrar navegador, URL de origen y error CORS exacto; no activar JSONP ni `no-cors`.
- Nunca pegues datos financieros, claves o tokens en issues públicos.
