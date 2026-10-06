## Qué cambia

<!-- Resumen en 1-3 frases. -->

## Tarjeta de Trello

<!-- Obligatorio: enlace a la tarjeta (US x.y). Tablero: https://trello.com/b/vqxFBKPS/es-b2 -->

## Cómo probarlo

<!-- Pasos para que quien revisa lo compruebe (en local con docker compose up, o en staging). -->

## Uso de IA

- [ ] Esta PR contiene código generado con IA. Si es así: lleva la etiqueta `ai-generated` y sus commits la línea `Co-Authored-By`.

## Definition of Done

Ver [docs/definition-of-done.md](../docs/definition-of-done.md).

- [ ] Cumple los criterios de aceptación de su tarjeta de Trello.
- [ ] El código sigue los estándares (ruff y eslint pasan sin errores).
- [ ] Tiene tests automatizados y la cobertura no baja del mínimo. Si es un bug, incluye un test que lo reproduce.
- [ ] Una persona que no es el autor la ha revisado y aprobado.
- [ ] Todos los checks de CI y de seguridad están en verde.
- [ ] Está desplegada en staging y probada allí (se marca después del merge a `develop`).
- [ ] La documentación afectada está actualizada. Si cambia el [acuerdo entre equipos](../docs/acuerdos.md), DevOps lo ha visto.

<!--
Recordatorios:
- La rama sale de develop y vive 1-2 días como mucho. Lo que no esté terminado va detrás de un feature flag (FEATURE_*).
- Si hay cambios en la base de datos, incluye la migración de Alembic.
-->
