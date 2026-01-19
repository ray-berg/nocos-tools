Understood. Below is a revised one-shot coding-agent prompt optimized for an Ubuntu 24.04 LXC/container host, with **no authentication** and **no Docker**. It assumes you will run a **single systemd-managed service** for the API and either (a) serve the React build as static files from NGINX, or (b) run Vite in dev mode behind NGINX during development.

---

## One-shot coding agent prompt (Ubuntu 24.04, no auth, no Docker)

You are an expert full-stack engineer. Build a production-minded but lightweight “Internal Tools Portal” designed to run on an Ubuntu 24.04 Linux container (LXC or VM). This portal hosts multiple small research tools. There must be a simple menu listing tools, and each tool lives on its own page/route and is implemented as an isolated module so new tools can be added without refactoring the core app.

### Non-negotiables

* Target OS: **Ubuntu 24.04**
* **No Docker / no docker-compose**
* **No authentication** (assume internal network, low-risk tools)
* Provide **systemd unit(s)** and **NGINX site config**
* Production: NGINX serves the built frontend and reverse-proxies `/api` to FastAPI.

---

## Stack

* Backend: **Python 3.12 + FastAPI**
* ASGI server: **uvicorn** (with systemd service)
* Frontend: **React + Vite + TypeScript**
* Styling: Tailwind (clean, utilitarian)
* Reverse proxy/static: **NGINX**

---

## Architecture goals

1. **Tool plugin model**

   * Each tool is a self-contained module with:

     * frontend route/page component
     * optional backend router
     * metadata: `id`, `name`, `description`, `category`, `nav_order`, `tags`
   * The UI menu is generated from metadata returned by the backend.
   * Adding a new tool should require:

     * creating a new folder in `apps/portal-web/src/tools/<toolId>/`
     * creating a new folder in `apps/portal-api/app/tools/<toolId>/` (if backend endpoints needed)
     * registering it in one obvious place OR automatic discovery.

2. **Stable API contract**

   * `GET /api/health`
   * `GET /api/tools` returns tool registry metadata used by frontend navigation
   * Tool endpoints live under `/api/tools/<toolId>/...`

3. **Operational clarity**

   * A `scripts/` directory that can:

     * bootstrap venv, install deps
     * run dev servers
     * build frontend
     * install NGINX site and systemd unit
   * Makefile targets: `make dev`, `make build`, `make lint`, `make test`, `make install`, `make restart`, `make logs`

---

## UI requirements

* Layout: header + left nav + content panel
* Home page (`/`):

  * tool search/filter
  * “recent tools” placeholder (persisted via localStorage)
* Tool page (`/tools/:toolId`):

  * standard wrapper showing title/description + tool UI below
* Responsive; include dark-mode toggle persisted in localStorage

---

## Starter tools (must be implemented)

Implement these three tools to prove the plugin pattern.

### Tool 1: Text Diff & Cleanup (frontend-only)

* Two text areas: “A” and “B”
* Buttons:

  * trim trailing whitespace
  * normalize line endings (LF)
  * remove duplicate blank lines
* Display a simple line-based diff view (added/removed/unchanged)

### Tool 2: URL Inspector (frontend + backend)

* Frontend:

  * Input URL
  * Show parsed components (scheme/host/path/query)
  * Table of query parameters
  * Button: “Fetch HEAD”
* Backend endpoint:

  * `POST /api/tools/url-inspector/fetch-head`
  * Performs safe `HEAD` request with:

    * strict timeout <= 5s
    * redirect limit <= 3
    * allow only http/https
    * **SSRF protections**:

      * block localhost and loopback
      * block RFC1918 private ranges
      * block link-local and metadata IPs (e.g., 169.254.169.254)
      * resolve DNS and validate all resolved IPs before requesting
    * return: status code, final URL, and a safe subset of headers (content-type, content-length, server, date, location)

### Tool 3: Regex Tester (frontend-only)

* Inputs: regex pattern, flags, test string
* Output: list matches, capture groups, indices; handle invalid regex gracefully

---

## Repository layout (must match)

Create a monorepo:

* `apps/portal-api/`

  * `app/main.py`
  * `app/core/settings.py` (Pydantic settings)
  * `app/core/logging.py`
  * `app/registry/` (ToolRegistry)
  * `app/tools/<toolId>/` (tool routers + metadata)
  * `tests/` (pytest)
* `apps/portal-web/`

  * `src/tools/<toolId>/index.tsx` (exports metadata + component)
  * `src/app/` (layout, routing, registry client)
  * `tests/` (vitest)
* `infra/nginx/portal.conf` (site config)
* `infra/systemd/portal-api.service`
* `scripts/`

  * `bootstrap.sh` (installs system deps guidance + creates venv + installs python deps + installs node deps)
  * `dev.sh` (runs api + vite concurrently in dev)
  * `build.sh` (builds frontend and places output in a predictable location)
  * `install.sh` (installs systemd unit + nginx site, enables, reloads)
* `Makefile`
* `README.md`

---

## Runtime model (production)

* FastAPI runs on `127.0.0.1:9000` via systemd service.
* NGINX listens on `:80` (and optionally `:443` if you include TLS as optional docs) and:

  * serves built frontend from a directory like `/opt/portal/www`
  * proxies `/api/` to `http://127.0.0.1:9000/`

No authentication. Do not add basic auth, API keys, OAuth, or similar.

---

## Development model (no Docker)

* API runs via `uvicorn --reload` on `127.0.0.1:9000`
* Frontend runs via `vite` on `127.0.0.1:5173`
* NGINX optional in dev; if included, proxy `/` to Vite and `/api` to FastAPI.
* Provide `make dev` that runs both servers (use a small node-based concurrent runner or a simple bash background job with trap/cleanup).

---

## Quality gates

* Backend:

  * ruff linting + formatting
  * pytest tests for:

    * `/api/health`
    * `/api/tools`
    * SSRF blocking behavior (private IPs, localhost, metadata IP)
* Frontend:

  * eslint + prettier
  * vitest minimal test ensuring nav renders tools from `/api/tools` mock

---

## Documentation

`README.md` must include:

* prerequisites for Ubuntu 24.04 (packages to apt install: python3.12-venv, nodejs/npm or instructions for Node 20 LTS install, nginx)
* quickstart for dev
* production install steps to `/opt/portal`
* how to add a new tool (frontend-only vs frontend+backend)
* SSRF protection notes for URL Inspector

---

## Implementation constraints

* Choose sensible defaults; do not ask me questions.
* Keep code minimal but clean, typed, and readable.
* Favor extensibility and consistency over cleverness.
* Generate the complete repository contents.

Begin by generating the complete repository contents now.

---
