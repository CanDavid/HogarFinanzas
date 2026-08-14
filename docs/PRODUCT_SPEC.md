# Especificación funcional y de diseño — Hogar Finanzas

## 1. Visión del producto

Hogar Finanzas es una aplicación nativa de iPhone para que dos personas de un mismo hogar lleven juntas el control financiero doméstico de forma simple, visual y útil para decidir.

La aplicación no pretende ser una contabilidad profesional ni un agregador bancario. Su objetivo es responder rápidamente a cinco preguntas:

1. ¿Cuánto dinero tenemos ahora?
2. ¿Cómo vamos este mes respecto a lo previsto?
3. ¿Qué gastos quedan todavía por llegar?
4. ¿Cuánto podemos destinar a ahorro, inversión, viajes u otros objetivos?
5. ¿Estamos mejorando o empeorando respecto a meses anteriores?

Principio rector: registrar un movimiento debe ser rápido; interpretar la situación financiera debe ser todavía más rápido.

## 2. Usuarios y permisos

### 2.1 Tipos de usuario

- **Propietario del hogar**: crea el hogar compartido e invita al segundo miembro.
- **Miembro del hogar**: acepta la invitación y participa con permisos de lectura y escritura.

En la primera versión ambos tienen prácticamente los mismos permisos funcionales. Solo el propietario puede dejar de compartir el hogar o gestionar la invitación original.

### 2.2 Identidad visible dentro de la app

Cada miembro tiene:

- nombre visible elegido durante el alta;
- identificador interno UUID;
- rol: propietario o miembro;
- fecha de incorporación;
- estado activo/inactivo.

Cada movimiento guarda quién lo creó para facilitar trazabilidad doméstica, no para repartir gastos entre personas.

## 3. Principios de UX

### 3.1 Simplicidad

- Evitar formularios largos.
- Mostrar primero las métricas que ayudan a decidir.
- Ocultar complejidad técnica y financiera.
- Usar lenguaje doméstico: “Gastos”, “Ahorro”, “Disponible”, “Previsto”, “Objetivos”.

### 3.2 Rapidez

Objetivo de interacción:

- Registrar un gasto habitual en 3–5 segundos.
- Entender el estado del mes en menos de 10 segundos.
- Llegar a cualquier detalle importante en un máximo aproximado de 2 toques desde Inicio.

### 3.3 Coherencia financiera

La app distingue claramente:

- **Ingreso**: dinero que entra en el patrimonio.
- **Gasto**: dinero que sale del patrimonio por consumo.
- **Transferencia**: movimiento entre cuentas propias; no altera el patrimonio.
- **Ajuste de saldo**: corrección manual excepcional.

“Ahorro” e “Inversión” son destinos o clasificaciones de cuentas/objetivos, no gastos. Un envío de 1.000 € desde cuenta corriente a cuenta de ahorro es una transferencia.

### 3.4 Visual

- Diseño nativo iOS con SwiftUI.
- Tipografía del sistema.
- Tarjetas con jerarquía clara.
- Colores semánticos, nunca como único indicador.
- Gráficos solo cuando aporten información.
- Soporte de modo claro/oscuro y Dynamic Type.

## 4. Navegación principal

La app usa una barra inferior con cinco secciones:

1. **Inicio**
2. **Movimientos**
3. **Plan**
4. **Objetivos**
5. **Análisis**

Pantallas secundarias accesibles desde estas secciones:

- Patrimonio y cuentas
- Añadir/editar movimiento
- Detalle de categoría
- Detalle de objetivo
- Cierre mensual
- Configuración del hogar
- Gestión de cuentas
- Gestión de categorías
- Gastos e ingresos recurrentes
- Estado de sincronización

---

# 5. Onboarding y hogar compartido

## 5.1 Objetivo de usuario

Permitir que una persona cree un hogar y que la segunda se una mediante una invitación de iCloud/CloudKit.

## 5.2 Estados iniciales

### Estado A — Sin hogar configurado

Pantalla:

- Título: “Tus finanzas de casa, compartidas”
- Explicación breve.
- Botón principal: **Crear hogar**
- Botón secundario: **Unirme a un hogar**
- Estado de iCloud visible si no está disponible.

### Estado B — Crear hogar

Campos:

- Nombre del hogar. Valor sugerido: “Casa”.
- Nombre visible del usuario.
- Moneda: EUR por defecto.

Acción: **Crear hogar**.

Después se ofrece:

- Añadir cuentas iniciales.
- Introducir saldos iniciales.
- Invitar a la otra persona.

### Estado C — Invitación

Acción principal: **Invitar a mi pareja**.

La app abre el flujo estándar de compartición de iCloud.

Tras enviar la invitación se muestra:

- “Invitación enviada”.
- Miembros actuales.
- Opción de volver a compartir/gestionar acceso.

### Estado D — Aceptar hogar

Al abrir una invitación:

- aceptar compartición;
- cargar el hogar;
- pedir nombre visible si todavía no existe perfil local;
- mostrar resumen del hogar;
- entrar en Inicio.

## 5.3 Criterios de diseño

- Nunca pedir email o contraseña de Apple dentro de la app.
- No mostrar términos técnicos como CKShare, private database o shared database.
- Si iCloud no está disponible, explicar qué falta y permitir reintentar.

---

# 6. Pantalla Inicio

## 6.1 Objetivo de usuario

Responder de un vistazo a:

- qué patrimonio tenemos;
- cómo va el mes;
- cuánto queda libre previsiblemente;
- cómo avanzan los objetivos.

## 6.2 Estructura

### Cabecera

- saludo opcional;
- mes actual;
- botón de ajustes;
- indicador discreto de sincronización si existe incidencia.

### Tarjeta 1 — Patrimonio total

Muestra:

- patrimonio total actual;
- variación desde el cierre del mes anterior;
- acceso a “Patrimonio y cuentas”.

Ejemplo:

- Patrimonio total: 37.850 €
- +1.420 € este mes

### Tarjeta 2 — Este mes

Métricas:

- ingresos reales registrados;
- gastos reales registrados;
- gastos pendientes previstos;
- superávit proyectado al cierre del mes.

El concepto principal debe ser:

**Disponible estimado al final de mes**

No confundir con saldo bancario disponible hoy.

### Tarjeta 3 — Plan de distribución

Muestra la asignación prevista del superávit:

- ahorro;
- inversión;
- viajes/objetivos;
- disponible sin asignar.

Si todavía no existe plan:

- mensaje: “Tienes X € previstos sin asignar”.
- botón: **Crear distribución**.

### Tarjeta 4 — Objetivos

Muestra 2 o 3 objetivos activos con:

- nombre;
- importe actual;
- objetivo;
- porcentaje;
- barra de progreso.

Botón: **Ver todos**.

### Acción principal

Botón visible y fácil de alcanzar:

**+ Añadir movimiento**

## 6.3 Estados vacíos

Si no hay datos:

- Patrimonio: invitar a crear primera cuenta.
- Mes: invitar a añadir primer ingreso/gasto.
- Objetivos: invitar a crear objetivo.

## 6.4 Interacciones

- Tap patrimonio → pantalla Patrimonio.
- Tap métrica gastos → Movimientos filtrados por mes actual y gastos.
- Tap previsto → Plan mensual, sección pendientes.
- Tap disponible → Plan mensual, distribución.
- Tap objetivo → detalle del objetivo.

---

# 7. Pantalla Añadir movimiento

## 7.1 Objetivo de usuario

Registrar un movimiento de manera extremadamente rápida, minimizando decisiones.

## 7.2 Entrada

Puede abrirse desde:

- Inicio;
- Movimientos;
- Plan al marcar un previsto como pagado;
- Objetivo al registrar una aportación asociada.

## 7.3 Selector de tipo

Control segmentado:

- Gasto
- Ingreso
- Transferencia

“Ajuste” no aparece como opción principal; se realiza desde la cuenta correspondiente.

## 7.4 Formulario — Gasto

Campos en orden:

1. **Importe** — teclado decimal, foco inicial.
2. **Concepto** — texto corto.
3. **Categoría** — selección rápida, con sugerencia automática basada en conceptos usados anteriormente.
4. **Cuenta** — última cuenta usada por defecto.
5. **Fecha** — hoy por defecto.
6. **Pagado/registrado por** — usuario actual por defecto.
7. **Nota** — opcional, colapsada.
8. **Vincular a objetivo** — opcional.
9. **Convertir en recurrente** — opción secundaria.

Botón principal: **Guardar gasto**.

## 7.5 Formulario — Ingreso

Campos:

- importe;
- concepto;
- categoría de ingreso;
- cuenta destino;
- fecha;
- usuario que registra;
- nota;
- opción recurrente.

## 7.6 Formulario — Transferencia

Campos:

- importe;
- cuenta origen;
- cuenta destino;
- fecha;
- concepto opcional;
- objetivo opcional.

Regla: origen y destino no pueden ser la misma cuenta.

## 7.7 Recurrente

Al activar “Se repite” se abre un bloque:

- frecuencia: mensual, trimestral, anual;
- próxima fecha;
- fecha final opcional;
- importe fijo;
- categoría/cuenta reutilizadas.

El movimiento actual se guarda como real y se crea una regla para futuras ocurrencias.

## 7.8 Validaciones

- importe > 0;
- cuenta requerida;
- categoría requerida para gasto/ingreso;
- origen != destino en transferencias;
- fecha válida;
- no bloquear por nota vacía.

## 7.9 Edición

Al editar un movimiento recurrente ya realizado, preguntar:

- “Solo este movimiento”
- “Este y los siguientes”

En v1 puede limitarse inicialmente a “Solo este movimiento” y editar la regla desde Recurrentes.

---

# 8. Pantalla Movimientos

## 8.1 Objetivo de usuario

Consultar y corregir rápidamente todo lo registrado.

## 8.2 Estructura

Cabecera:

- buscador;
- filtro de periodo;
- botón de filtros;
- botón +.

Lista agrupada por día.

Cada fila muestra:

- icono/categoría;
- concepto;
- cuenta;
- usuario que registró;
- importe;
- indicador de recurrente si aplica.

Convención visual:

- gasto: signo negativo;
- ingreso: signo positivo;
- transferencia: flechas y sin color de pérdida/ganancia.

## 8.3 Filtros

- Mes actual
- Mes anterior
- Rango personalizado
- Tipo
- Categoría
- Cuenta
- Miembro
- Recurrente/no recurrente

## 8.4 Búsqueda

Busca por:

- concepto;
- nota;
- categoría;
- cuenta.

## 8.5 Acciones

Tap → detalle/edición.

Swipe:

- editar;
- eliminar.

Eliminar requiere confirmación si el movimiento está ligado a:

- ocurrencia recurrente;
- aportación a objetivo;
- mes cerrado.

## 8.6 Mes cerrado

Por defecto los movimientos de un mes cerrado son de solo lectura.

Para modificarlos:

1. reabrir mes;
2. editar;
3. volver a cerrar.

Esto evita que el histórico cambie accidentalmente.

---

# 9. Pantalla Plan mensual

## 9.1 Objetivo de usuario

Saber qué se esperaba que ocurriera durante el mes, qué ha ocurrido ya y cuánto dinero quedará disponible previsiblemente.

## 9.2 Cabecera

- selector de mes;
- estado: Abierto / Cerrado;
- botón “Cerrar mes” cuando corresponda.

## 9.3 Resumen

Bloque con:

- ingresos previstos;
- ingresos reales;
- gastos fijos previstos;
- gastos fijos realizados;
- presupuesto variable;
- gasto variable real;
- superávit previsto inicial;
- superávit proyectado actual.

## 9.4 Sección Ingresos previstos

Origen:

- reglas recurrentes de ingreso;
- entradas manuales de planificación.

Cada línea:

- concepto;
- fecha prevista;
- importe;
- estado: pendiente / recibido / omitido.

Marcar como recibido puede crear el ingreso real.

## 9.5 Sección Gastos previstos

Origen principal:

- reglas recurrentes de gasto.

Cada línea:

- concepto;
- fecha;
- importe;
- categoría;
- estado: pendiente / pagado / omitido.

Acción: **Marcar como pagado** → crea movimiento real enlazado.

## 9.6 Presupuesto variable por categoría

Ejemplos:

- Alimentación: 700 €
- Restaurantes: 300 €
- Niños: 500 €
- Ocio: 250 €

Para cada categoría:

- presupuesto;
- gastado;
- disponible;
- porcentaje consumido.

## 9.7 Distribución del superávit

Permite repartir el superávit proyectado entre destinos virtuales:

- ahorro;
- inversión;
- objetivo concreto;
- disponible sin asignar.

Importante: asignar 1.000 € a ahorro en el plan no mueve dinero. Es una intención. El movimiento real se registra mediante una transferencia o aportación asociada.

## 9.8 Proyección

La app debe mostrar dos cifras distintas:

- **Superávit previsto inicial**: cálculo al comenzar el mes.
- **Superávit proyectado actual**: recalculado con datos reales + pendientes.

Explicación accesible mediante info:

“Estimación de lo que quedará al terminar el mes si se cumplen los ingresos pendientes, los gastos previstos y el presupuesto variable restante.”

## 9.9 Cierre mensual

Botón: **Cerrar mes**.

Antes de cerrar, mostrar checklist:

- X movimientos registrados;
- Y gastos previstos pendientes;
- Z ingresos pendientes;
- superávit real;
- ahorro/inversión realizados;

Si existen previstos pendientes, permitir:

- mantenerlos como no realizados;
- marcarlos como omitidos;
- cancelar y revisar.

Al cerrar:

- guardar snapshot mensual;
- bloquear edición directa del mes;
- preparar el siguiente mes a partir de recurrentes y presupuestos configurados.

---

# 10. Pantalla Patrimonio y cuentas

## 10.1 Objetivo de usuario

Ver dónde está el dinero y cómo evoluciona el patrimonio.

## 10.2 Resumen

- Patrimonio total.
- Liquidez.
- Ahorro.
- Inversión registrada.

## 10.3 Cuentas

Tipos soportados v1:

- Corriente
- Ahorro
- Inversión
- Efectivo

Cada cuenta muestra:

- nombre;
- tipo;
- saldo calculado;
- si cuenta para patrimonio;
- si cuenta como liquidez.

## 10.4 Saldo

Saldo calculado:

saldo inicial
+ ingresos
- gastos
+ transferencias entrantes
- transferencias salientes
+ ajustes

Nunca se obtiene sumando movimientos de ahorro como si fueran ingresos.

## 10.5 Inversión

En v1 el saldo de una cuenta de inversión representa el **valor registrado en la app**. Puede basarse en aportaciones o corregirse mediante ajuste manual.

No hay conexión automática con brokers ni cotizaciones en v1.

## 10.6 Acciones

- Añadir cuenta
- Editar cuenta
- Archivar cuenta
- Ajustar saldo
- Ver movimientos de la cuenta

No permitir eliminar una cuenta con histórico; se archiva.

---

# 11. Pantalla Objetivos

## 11.1 Objetivo de usuario

Reservar mentalmente parte del patrimonio para finalidades concretas sin duplicar el dinero contablemente.

Ejemplos:

- Fondo de emergencia
- Viaje
- Reforma
- Compra futura
- Inversión anual

## 11.2 Lista

Cada objetivo muestra:

- icono;
- nombre;
- cantidad asignada;
- cantidad objetivo;
- porcentaje;
- fecha objetivo opcional.

## 11.3 Crear objetivo

Campos:

- nombre;
- importe objetivo;
- importe inicial opcional;
- fecha objetivo opcional;
- icono;
- nota.

## 11.4 Detalle

Muestra:

- progreso;
- falta por conseguir;
- aportaciones;
- ritmo medio mensual;
- estimación de fecha de cumplimiento si hay datos suficientes.

Acciones:

- Añadir aportación
- Retirar/reducir asignación
- Editar objetivo
- Completar
- Archivar

## 11.5 Regla contable

Las aportaciones a objetivos son **asignaciones virtuales** y no cambian el patrimonio por sí mismas.

Opcionalmente una aportación puede vincularse a una transferencia real para indicar que ese dinero se movió también a una cuenta específica.

---

# 12. Pantalla Análisis

## 12.1 Objetivo de usuario

Comprender tendencias sin convertirse en una herramienta analítica compleja.

## 12.2 Periodo

Selector:

- 3 meses
- 6 meses
- 12 meses
- Año actual
- Personalizado

## 12.3 Bloques

### Evolución del gasto mensual

Gráfico de barras o línea con total por mes.

### Gasto por categoría

Ranking de categorías con importe y porcentaje.

### Presupuesto vs real

Por mes y por categoría.

### Evolución del patrimonio

Línea temporal basada en cierres mensuales.

### Evolución del ahorro

- ahorro neto del mes;
- acumulado del año;
- tasa de ahorro.

### Objetivos

Progreso acumulado de objetivos activos.

## 12.4 Insight textual

La app puede generar reglas sencillas, no IA en v1.

Ejemplos:

- “Este mes has gastado 180 € menos que el anterior.”
- “Restaurantes está un 24 % por encima del presupuesto.”
- “El patrimonio ha aumentado 4.300 € en los últimos 6 meses.”

No hacer recomendaciones de inversión personalizadas en v1.

---

# 13. Configuración

Secciones:

## Hogar

- nombre del hogar;
- miembros;
- gestionar compartición;
- moneda;
- primer día del mes financiero: v1 siempre día 1.

## Cuentas

- crear/editar/archivar.

## Categorías

- categorías de gasto;
- categorías de ingreso;
- icono;
- orden;
- archivar.

## Recurrentes

- gastos recurrentes;
- ingresos recurrentes;
- activar/desactivar;
- próxima ocurrencia.

## Datos y sincronización

- estado de iCloud;
- última sincronización conocida;
- reintentar;
- explicación de uso compartido.

## Privacidad

- datos almacenados mediante iCloud/CloudKit;
- sin servidor propio en v1;
- sin analítica de terceros en v1.

---

# 14. Categorías iniciales sugeridas

## Gastos

- Vivienda
- Alimentación
- Restaurantes
- Transporte
- Coche
- Niños
- Salud
- Educación
- Ocio
- Viajes
- Suscripciones
- Seguros
- Impuestos
- Compras
- Mascotas
- Regalos
- Otros

## Ingresos

- Nómina
- Empresa
- Extraordinarios
- Reembolsos
- Otros ingresos

El usuario puede renombrar, crear y archivar categorías.

---

# 15. Definiciones financieras exactas

## Patrimonio total

Suma de saldos de cuentas con `includeInNetWorth = true`.

## Liquidez

Suma de saldos de cuentas con `includeInLiquidity = true`.

## Gasto mensual real

Suma de movimientos tipo gasto cuya fecha pertenece al mes.

## Ingreso mensual real

Suma de movimientos tipo ingreso cuya fecha pertenece al mes.

## Resultado real del mes

`ingresos reales - gastos reales`

Las transferencias no intervienen.

## Tasa de ahorro

Cuando los ingresos reales son mayores que cero:

`max(resultado real del mes, 0) / ingresos reales * 100`

La app debe etiquetarla como indicador orientativo, ya que transferir dinero a ahorro no define por sí solo el ahorro económico del periodo.

## Gasto fijo pendiente

Suma de ocurrencias recurrentes de gasto del mes con estado pendiente y fecha no realizada.

## Presupuesto variable restante

Por cada categoría variable:

`max(presupuesto de categoría - gasto real variable de esa categoría, 0)`

## Ingreso previsto pendiente

Suma de ingresos planificados del mes todavía no recibidos.

## Superávit proyectado actual

Fórmula base v1:

`ingresos reales + ingresos previstos pendientes - gastos reales - gastos fijos pendientes - presupuesto variable restante`

Debe evitarse contar dos veces un gasto recurrente que ya se haya convertido en movimiento real.

## Variación de patrimonio mensual

`patrimonio actual - patrimonio registrado en el último cierre mensual`

---

# 16. Reglas de producto y casos límite

1. Una transferencia nunca cuenta como gasto ni ingreso.
2. Una asignación a objetivo nunca aumenta ni disminuye el patrimonio.
3. No permitir editar un mes cerrado sin reabrirlo.
4. No eliminar físicamente cuentas/categorías con histórico; archivar.
5. Un previsto recurrente solo se considera real cuando existe movimiento asociado o se marca como realizado.
6. Si dos miembros registran datos sin conexión, ambos deben poder seguir usando la app y sincronizar posteriormente.
7. Si dos miembros editan simultáneamente el mismo registro, la app debe conservar una versión consistente y nunca duplicar una transferencia.
8. Todos los importes se almacenan en céntimos enteros; la UI trabaja con formato monetario local.
9. Moneda única por hogar en v1: EUR por defecto.
10. No hay multi-divisa en v1.
11. No hay integración bancaria en v1.
12. No hay cotizaciones bursátiles automáticas en v1.
13. No hay reparto 50/50 ni liquidación de deudas entre miembros en v1.

---

# 17. Alcance MVP

El MVP está completo cuando dos personas pueden:

- crear/unirse a un hogar compartido;
- crear cuentas con saldos iniciales;
- registrar ingresos, gastos y transferencias;
- consultar saldo y patrimonio;
- configurar recurrentes;
- ver gastos e ingresos previstos;
- crear presupuesto variable mensual;
- ver superávit proyectado;
- definir distribución prevista;
- crear y alimentar objetivos;
- cerrar meses;
- consultar histórico y análisis básicos;
- usar la aplicación sin conexión y recibir cambios sincronizados posteriormente.

---

# 18. Fuera de alcance del MVP

- Conexión con bancos.
- PSD2/Open Banking.
- OCR de tickets.
- Importación CSV automática.
- Cotización de acciones/ETF/cripto.
- Inteligencia artificial generativa.
- Siri/App Intents.
- Apple Watch.
- Widgets.
- iPad/Mac optimizados.
- Notificaciones financieras avanzadas.
- Multi-hogar.
- Multi-divisa.
- Roles complejos.
- Aplicación pública con suscripciones.

Estas funciones pueden abordarse después de validar el uso real del MVP.
