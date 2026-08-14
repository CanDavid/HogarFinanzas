# Configuración de Google — Fase 1

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
5. Verifica que se crearon las 11 pestañas y que `Users` contiene David y Esther.

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

Al cambiar `Code.gs`, crea una versión nueva de la implementación y vuelve a desplegarla manteniendo el mismo deployment. Confirma primero salud y login en Windows; después prueba Safari.

## Diagnóstico seguro

- `not_initialized`: faltó ejecutar el inicializador.
- `invalid_credentials`: usuario/clave incorrectos.
- `invalid_token` o `expired_token`: cerrar sesión y volver a entrar.
- Sin respuesta legible tras la redirección: registrar navegador, URL de origen y error CORS exacto; no activar JSONP ni `no-cors`.
- Nunca pegues datos financieros, claves o tokens en issues públicos.
