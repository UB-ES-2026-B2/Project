# Definition of Done

Basada en la de las diapositivas de Scrum. Una historia de usuario solo pasa a **Hecho** en Trello cuando cumple todo lo siguiente. La misma lista está como checklist en la [plantilla de PR](../.github/pull_request_template.md).

| # | Criterio | Cómo se comprueba |
|---|---|---|
| 1 | Cumple los criterios de aceptación de su tarjeta de Trello. | La persona que revisa los comprueba en la PR o en staging. |
| 2 | El código sigue los estándares. | `ruff check`, `ruff format --check` y `npm run lint` pasan en la CI. |
| 3 | Tiene tests automatizados y la cobertura no baja del mínimo. | `pytest --cov` falla por debajo del mínimo (60 % en el Sprint 1; se sube en cada sprint). Cada bug corregido trae un test que lo reproduce. |
| 4 | Una persona que no es el autor la ha revisado y aprobado. | Lo exige la protección de `develop` y `main`. |
| 5 | Todos los checks de CI y de seguridad están en verde. | `CI` y `Security` en la PR. Un hallazgo alto o crítico bloquea el merge. |
| 6 | Está desplegada en staging y probada allí. | Después del merge a `develop`, `Deploy staging` despliega sola. Se prueba en la URL de staging. |
| 7 | La documentación afectada está actualizada. | README, `docs/` y, si cambia el [acuerdo entre equipos](acuerdos.md), con el visto bueno de DevOps. |

## Uso de IA

Si la historia incluye código generado con IA:

- Sus commits llevan la línea `Co-Authored-By: Claude ...`.
- La PR lleva la etiqueta `ai-generated`.
- Igualmente necesita la revisión de una persona (criterio 4). No hay excepciones.
