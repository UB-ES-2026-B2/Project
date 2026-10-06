# Decisiones

Aquí está cada decisión que se aparta de las diapositivas de la asignatura (CI/CD, Code Review, Advanced DevOps, Scrum, Planning, Kanban) o del [artículo de Fowler sobre ramas](https://martinfowler.com/articles/branching-patterns.html), y por qué. Cada entrada tiene fecha y no se borra: si una decisión cambia, se añade otra que la sustituya.

---

## D1 · Monolito modular en lugar de microservicios

*Octubre 2026*

- **Lo que dicen las directrices:** se presentan los microservicios como la arquitectura habitual para desplegar de forma independiente.
- **Decisión:** el backend es un único servicio FastAPI, organizado por módulos (`api/routes/` tiene un fichero por épica).
- **Por qué:** con 5-7 personas y tres meses, los microservicios añaden comunicación por red, varias bases de datos y despliegues coordinados sin ningún beneficio real. Frontend y backend sí se despliegan por separado.

## D2 · Una sola EC2 en lugar de Kubernetes u otro orquestador

*Octubre 2026*

- **Decisión:** staging y producción viven en una EC2 t4g.micro, cada uno en su propio proyecto de Docker Compose, con su base de datos y su puerto.
- **Por qué:** el presupuesto es de 20 USD/mes. EKS cuesta más que eso solo por el plano de control, y un balanceador (ALB) también se lo comería. La recuperación automática la da una alarma de CloudWatch sobre la comprobación de estado de la instancia.
- **Riesgo asumido:** si la máquina cae, caen los dos entornos hasta que se recupera.

## D3 · Sin canary ni blue-green

*Octubre 2026*

- **Lo que dicen las directrices:** recomiendan estrategias de despliegue progresivo.
- **Decisión:** no se usan.
- **Por qué:** con una sola máquina y sin balanceador no hay dónde repartir el tráfico. En su lugar se combinan tres cosas:
  - un entorno de staging idéntico a producción;
  - feature flags por entorno, que se activan primero en staging;
  - rollback automático con health check (`infra/ec2/deploy.sh`).

## D4 · GitFlow simplificado (`develop` + `main`) con ramas cortas

*Octubre 2026*

- **Lo que dice Fowler:** las ramas largas y GitFlow retrasan la integración. Recomienda integrar en la rama principal a diario.
- **Decisión:** hay dos ramas permanentes. `develop` es integración y staging, y `main` es producción. Las ramas de trabajo duran 1 o 2 días como mucho, y lo que no está terminado se oculta con feature flags.
- **Por qué:** la asignatura pide un entorno de staging y demos con una versión estable. `develop` da las dos cosas sin perder la integración frecuente, que se mantiene gracias a lo corto de las ramas.

## D5 · Filtros de rutas en la CI solo en las PRs

*Octubre 2026*

- **Decisión:**
  - En las PRs, el job de backend solo se lanza si cambia `backend/`, y el de frontend solo si cambia `frontend/`.
  - En los push a `develop` y `main` (después de cada merge) se lanzan siempre los dos.
  - Los filtros se aplican con un job previo (`changes`) y no con `on.paths`.
- **Por qué:** "build rápido" en las PRs y "cada merge se compila" en las ramas protegidas. Con `on.paths`, un check obligatorio que no se lanza se queda pendiente para siempre y bloquea la PR. Un job saltado con `if`, en cambio, cuenta como superado.

## D6 · Trivy ignora las vulnerabilidades sin parche

*Octubre 2026*

- **Decisión:** Trivy bloquea el merge por hallazgos `HIGH` o `CRITICAL`, pero solo si ya existe una versión corregida (`ignore-unfixed`).
- **Por qué:** la imagen base de Debian casi siempre tiene alguna vulnerabilidad alta todavía sin parche. Bloquear por algo que nadie puede arreglar dejaría el repo sin poder mergear. Dependabot propone las actualizaciones en cuanto sale el parche, y el análisis semanal vuelve a revisarlas.

## D7 · Cobertura mínima incremental

*Octubre 2026*

- **Decisión:** la cobertura mínima empieza en el 60 % y se sube en cada sprint. Está en `backend/pyproject.toml` (`fail_under`) y en la configuración de vitest.
- **Por qué:** al principio casi todo el código es nuevo y cambia mucho. Un mínimo alto desde el primer día empuja a escribir tests vacíos solo para cumplir la cifra.
