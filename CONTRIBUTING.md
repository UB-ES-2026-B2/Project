# Cómo trabajar en el repo · Grupo B2

Repo: https://github.com/UB-ES-2026-B2/Project
Tablero: https://trello.com/b/vqxFBKPS/es-b2

## 1. Las ramas

| Rama | Qué es | ¿Puedo trabajar aquí? |
|---|---|---|
| `main` | **Producción.** Lo que ve el profesor en la demo. | ❌ **Nunca.** Solo DevOps la actualiza antes de cada demo. |
| `develop` | **Pruebas.** Aquí se junta el trabajo de todos. | ❌ **Nunca directamente.** Solo se entra mediante Pull Request. |
| `feature/...` y `fix/...` | **Tu rama de trabajo.** Una por tarea. | ✅ **Sí, aquí trabajas tú.** |

Nombres de rama: `feature/US-1.3-busqueda-ubicacion`, `feature/US-4.1-registro`, `fix/precio-negativo`. Siempre con el número de la historia de Trello.

**Una rama dura 1 o 2 días como mucho.** Si la tarea es más grande, pártela en varias PRs pequeñas.

## 2. Dónde va cada cosa

```
backend/     ← equipo backend (FastAPI)
frontend/    ← equipo frontend (React + Vite)
infra/  .github/  docs/  docker-compose.yml  Dockerfile   ← DevOps. No tocar sin avisar.
```

- Backend solo toca `backend/`. Frontend solo toca `frontend/`.
- Si necesitas cambiar algo fuera de tu carpeta, avisa antes a DevOps.

## 3. Primera vez (solo una vez)

```bash
git clone https://github.com/UB-ES-2026-B2/Project.git
cd Project
git checkout develop
```

Necesitas: Git, Docker Desktop, Python 3.12 (backend) y Node.js 20 (frontend).

## 4. El día a día: los 8 pasos

**Paso 1. Ponte al día con `develop`.**

```bash
git checkout develop
git pull
```

**Paso 2. Crea tu rama.**

```bash
git checkout -b feature/US-1.3-busqueda-ubicacion
```

**Paso 3. Trabaja y guarda a menudo.**

```bash
git add .
git commit -m "feat(search): filtro por ciudad"
```

Formato del mensaje: `tipo(zona): qué has hecho`. Los tipos más usados:

- `feat`: algo nuevo.
- `fix`: arreglas un error.
- `test`: añades tests.
- `refactor`: reorganizas código sin cambiar lo que hace.
- `docs`: documentación.

**Paso 4. Antes de subir, pasa los mismos checks que la CI.** Si fallan en tu ordenador, fallarán en GitHub (ver apartado 6).

**Paso 5. Sube tu rama.**

```bash
git push -u origin feature/US-1.3-busqueda-ubicacion
```

Las siguientes veces basta con `git push`.

**Paso 6. Abre la Pull Request.**

1. En GitHub verás un aviso amarillo con el botón **Compare & pull request**. Púlsalo.
2. Comprueba que pone **base: `develop`** ← **compare: tu rama**. Nunca `main`.
3. Rellena la plantilla que aparece: qué cambia, el enlace a la tarjeta de Trello y la checklist.
4. Pulsa **Create pull request**.

**Paso 7. Espera los checks y la revisión.**

- Abajo de la PR aparecen los checks. Todos tienen que estar ✅ verdes.
- Si alguno sale ❌, pulsa **Details**, lee el error, arréglalo en tu ordenador, haz commit y `git push`. Los checks se vuelven a lanzar solos.
- Un compañero tiene que revisarla y aprobarla. No puedes aprobar tu propia PR.

**Paso 8. Mergea y limpia.**

1. Con todo en verde y aprobada, pulsa **Merge pull request** y **Confirm merge**.
2. Pulsa **Delete branch**.
3. En tu ordenador:

   ```bash
   git checkout develop
   git pull
   ```

4. Mueve la tarjeta de Trello a **Hecho**.

## 5. Si `develop` ha avanzado mientras trabajabas

```bash
git checkout develop
git pull
git checkout feature/US-1.3-busqueda-ubicacion
git merge develop
```

Si sale un **conflicto**, VS Code marca los ficheros afectados. Elige qué código se queda y después:

```bash
git add .
git commit
git push
```

Si no sabes resolverlo, pregunta antes de inventar.

## 6. Comprobar en local antes de subir

**Backend** (desde `backend/`, con la base de datos levantada: `docker compose up -d db`):

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
ruff check .
ruff format .                    # corrige el formato solo
pytest --cov=app
```

**Frontend** (desde `frontend/`):

```bash
npm ci
npm run lint
npm test
npm run build
```

**Para levantar todo en local:** `docker compose up --build` desde la raíz. La API queda en http://localhost:8000/api/docs. En otra terminal, `cd frontend && npm run dev`, y el frontend queda en http://localhost:5173.

## 7. Antes de nada: una sola persona monta la base de cada equipo

Si tres personas crean la estructura inicial a la vez en tres ramas distintas, los cambios chocan al mergear y alguien pierde su trabajo. Por eso:

- **Backend:** una persona (decididla entre vosotros) monta la estructura inicial en una primera PR: sustituir el `main.py` de ejemplo, `core/config.py`, la conexión a la base de datos, las carpetas de `api/routes/` y `alembic init`.
- **Frontend:** una persona crea el proyecto de Vite en `frontend/` con los scripts y la configuración del apartado 9, en una primera PR.
- **El resto espera a que esa PR esté mergeada en `develop`** y crea sus ramas a partir de ahí. Mientras tanto, podéis ir diseñando, leyendo las historias de Trello o preparando los tests.

## 8. Reglas para el equipo de backend

- **Todas las rutas empiezan por `/api`** (por ejemplo `/api/listings`).
- **No borréis `GET /api/health`.** Tiene que devolver `{"status": "ok"}`, porque el despliegue lo usa para saber si la API funciona.
- `backend/app/main.py` es un esqueleto de DevOps: sustituidlo por vuestra app, pero manteniendo `/api/health`.
- Las dependencias van en `backend/pyproject.toml`, dentro de `dependencies`. Las de test, en `dev`.
- La configuración, siempre con variables de entorno: `DATABASE_URL`, `SECRET_KEY`, etc. **Nunca contraseñas en el código.**
- Los cambios en la base de datos se hacen con migraciones de **Alembic**.
- **Migraciones en paralelo.** Si dos personas crean una migración en ramas distintas, al juntarlas en `develop` aparecen dos "heads" y la API no arranca. Si tu PR trae una migración:
  1. Justo antes de mergear, trae lo último de `develop` a tu rama: `git merge develop`.
  2. Ejecuta `alembic heads` desde `backend/`. Tiene que salir **una sola línea**.
  3. Si salen dos, cambia el `down_revision` de tu migración para que apunte a la otra, o crea una migración que las una con `alembic merge heads -m "unir migraciones"`.
  4. La CI también lo comprueba y falla si hay más de un head.
- Los tests van en `backend/tests/`. La cobertura mínima es del 60 %; si baja, la CI falla.
- Las fotos no se guardan en el servidor: el backend genera una URL de subida a S3.

## 9. Reglas para el equipo de frontend

- El proyecto va dentro de `frontend/`. Para crearlo, desde la raíz del repo:

  ```bash
  npm create vite@latest frontend -- --template react
  ```

- En `package.json` tienen que existir estos scripts:

  ```json
  "lint": "eslint .",
  "test": "vitest run --coverage",
  "build": "vite build"
  ```

- Instalad vitest y la cobertura: `npm i -D vitest @vitest/coverage-v8`.
- En la configuración de vitest, activad el informe `json-summary`, que es el que lee la CI, y un mínimo del 60 %:

  ```js
  test: { coverage: { reporter: ['text', 'json-summary'], thresholds: { lines: 60 } } }
  ```

- **Subid `package-lock.json`.** Sin él, la CI falla.
- Las llamadas a la API van **siempre con rutas relativas**: `fetch('/api/listings')`, nunca `http://localhost:8000/...`.
- En `vite.config.js`, añadid el proxy para desarrollo:

  ```js
  server: { proxy: { '/api': 'http://localhost:8000' } }
  ```

- El build se genera en `frontend/dist`. No lo subáis al repo.

## 10. Lo que nunca se sube

- `.env` (contraseñas y configuración local).
- `node_modules/`, `dist/`, `.venv/`.
- Claves, tokens o contraseñas de cualquier tipo.

El `.gitignore` ya los excluye. Si `git status` te enseña alguno de estos, no hagas `git add`.

## 11. Si usas IA (ChatGPT, Claude, Copilot…)

- Añade la etiqueta `ai-generated` a la PR.
- Revisa y entiende lo que te ha generado antes de subirlo. Si no sabes explicarlo, no lo subas.

## 12. Resumen en una línea

**`develop` actualizada → rama nueva → commits → push → PR a `develop` → checks verdes + 1 aprobación → merge → borrar rama → tarjeta a Hecho.**

¿Dudas? Preguntad a DevOps antes de hacer `push --force`, tocar `main` o cambiar algo fuera de vuestra carpeta.
