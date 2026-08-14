# ADR-001 — Arquitectura PWA de coste cero

- Estado: aceptada
- Fecha: 2026-08-14

## Contexto

La Fase 0 demostró que un proyecto iOS podía mantenerse desde Windows mediante CI, pero las siguientes fases requerían infraestructura Apple, firma, CloudKit y validaciones difíciles de ejecutar sin Mac ni membresía. El proyecto debe poder desarrollarse desde Windows, instalarse en dos iPhone y operar sin coste obligatorio.

## Decisión

Adoptar una única arquitectura:

- React + TypeScript + Vite como PWA mobile-first;
- IndexedDB offline-first;
- motor propio de sincronización idempotente;
- Google Apps Script Web App + Google Sheets;
- GitHub Pages para hosting y GitHub Actions Linux para CI/despliegue;
- repositorio público sin secretos ni datos.

El scaffold Swift queda eliminado, no archivado dentro de `main`. Su historia sigue recuperable mediante Git.

## Consecuencias

Ventajas:

- desarrollo, build y tests desde Windows;
- instalación desde Safari sin App Store;
- coste obligatorio 0 €;
- almacenamiento local inmediato y datos compartidos controlados por el hogar.

Costes/riesgos:

- debemos mantener autenticación y sincronización propias;
- Sheets no es una base transaccional y requiere lock/validación;
- cuotas gratuitas de Google limitan escala, aceptable para dos personas;
- ContentService redirige respuestas y el acceso desde Pages debe probarse realmente en Chromium/Safari;
- el código cliente es público, por lo que ningún secreto puede compilarse en él.

## Alternativas descartadas

- Swift/CloudKit/TestFlight: incompatible con las restricciones actuales de plataforma/coste.
- Backend SaaS gratuito: sus planes y límites pueden cambiar y añaden otro proveedor.
- Frontend servido por Apps Script: evitaría el requisito GitHub Pages y empeoraría la experiencia PWA.
- JSONP o `no-cors`: no permiten un canal seguro y legible para datos financieros.
- Puente HTMLService: posible fallback, pero añade iframe/postMessage y superficie de seguridad; requiere un ADR nuevo si el spike directo falla.

## Reversibilidad

La lógica de dominio y el protocolo permanecen aislados. Un backend futuro puede sustituir Apps Script implementando la misma interfaz sin reescribir la UI ni el modelo local.
