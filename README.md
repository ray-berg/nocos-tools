# Internal Tools Portal

A lightweight, plugin-based internal tools portal for Ubuntu 24.04. Hosts multiple small research tools with a clean, responsive UI.

## Features

- **Plugin architecture**: Each tool is self-contained and isolated
- **Dark mode**: Toggle persisted in localStorage
- **Recent tools**: Quick access to recently used tools
- **Search/filter**: Find tools by name, description, or tags
- **No authentication**: Designed for internal/trusted networks

## Prerequisites

Ubuntu 24.04 with the following packages:

```bash
# Python 3.12 with venv
sudo apt update
sudo apt install python3.12 python3.12-venv

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# NGINX (for production)
sudo apt install nginx
```

## Quick Start (Development)

```bash
# Clone and enter directory
cd /opt/tools

# Install dependencies
make bootstrap

# Start development servers
make dev
```

This starts:
- API server at http://127.0.0.1:9000
- Web dev server at http://127.0.0.1:5173 (with hot reload)

## Production Installation

```bash
# Build frontend
make build

# Install to /opt/portal (requires sudo)
make install

# Start services
sudo systemctl start portal-api
sudo systemctl reload nginx

# Check health
curl http://localhost/api/health
```

The portal will be available at http://localhost

## Available Commands

```bash
make help         # Show all available commands
make dev          # Start development servers
make build        # Build frontend for production
make lint         # Run all linters
make test         # Run all tests
make install      # Install to production (sudo)
make restart      # Restart production services
make logs         # View API logs
```

## Project Structure

```
.
├── apps/
│   ├── portal-api/          # FastAPI backend
│   │   ├── app/
│   │   │   ├── main.py      # Application entry point
│   │   │   ├── core/        # Settings, logging
│   │   │   ├── registry/    # Tool registry
│   │   │   └── tools/       # Backend tool implementations
│   │   └── tests/
│   └── portal-web/          # React frontend
│       ├── src/
│       │   ├── app/         # Pages (Home, NotFound)
│       │   ├── components/  # Layout, Header, Sidebar
│       │   ├── hooks/       # useTheme, useTools, useRecentTools
│       │   └── tools/       # Frontend tool implementations
│       └── tests/
├── infra/
│   ├── nginx/               # NGINX site config
│   └── systemd/             # systemd unit file
├── scripts/                 # Bootstrap, dev, build, install
├── Makefile
└── README.md
```

## Adding a New Tool

### Frontend-only tool

1. Create `apps/portal-web/src/tools/<tool-id>/index.tsx`:

```tsx
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'my-tool',
  name: 'My Tool',
  description: 'Description of what the tool does',
  category: 'Utilities',  // or Text, Network, etc.
  nav_order: 50,
  tags: ['tag1', 'tag2'],
  has_backend: false,
}

export function MyTool() {
  return (
    <ToolWrapper metadata={metadata}>
      {/* Your tool UI here */}
    </ToolWrapper>
  )
}

export default MyTool
```

2. Add route in `apps/portal-web/src/App.tsx`:

```tsx
import { MyTool } from './tools/my-tool'
// ...
<Route path="tools/my-tool" element={<MyTool />} />
```

### Tool with backend

1. Create frontend as above, but set `has_backend: true`

2. Create `apps/portal-api/app/tools/<tool_id>/`:

```
my_tool/
├── __init__.py
└── router.py
```

3. In `router.py`:

```python
from fastapi import APIRouter
from app.registry import ToolMetadata, tool_registry

TOOL_METADATA = ToolMetadata(
    id="my-tool",
    name="My Tool",
    description="...",
    category="Utilities",
    nav_order=50,
    tags=["tag1", "tag2"],
)

router = APIRouter()

@router.post("/endpoint")
async def my_endpoint():
    return {"result": "data"}

tool_registry.register(TOOL_METADATA, router)
```

4. Import in `apps/portal-api/app/tools/__init__.py`:

```python
from app.tools.my_tool import router as my_tool_router
```

## Included Tools

### Text Diff & Cleanup
- Compare two text blocks with line-based diff
- Trim trailing whitespace
- Normalize line endings to LF
- Remove duplicate blank lines

### URL Inspector
- Parse URL components (scheme, host, path, query, fragment)
- Display query parameters in a table
- Fetch HEAD with SSRF protection

### Regex Tester
- Test regex patterns in real-time
- Toggle flags (g, i, m, s, u)
- View matches with capture groups
- Highlighted match preview

## SSRF Protection (URL Inspector)

The URL Inspector tool includes comprehensive SSRF protections:

- **Blocked IP ranges**:
  - Loopback (127.0.0.0/8, ::1)
  - Private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  - Link-local (169.254.0.0/16)
  - Cloud metadata (169.254.169.254)
  - IPv6 private/link-local

- **DNS resolution validation**: All resolved IPs are checked before making requests

- **Redirect chain validation**: Each redirect URL is validated for SSRF

- **Request limits**:
  - 5 second timeout
  - Maximum 3 redirects
  - Only http/https schemes allowed

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/tools` - List all registered tools
- `POST /api/tools/url-inspector/fetch-head` - Fetch URL HEAD (with SSRF protection)

## Configuration

Environment variables (prefix with `PORTAL_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORTAL_DEBUG` | `false` | Enable debug mode |
| `PORTAL_HOST` | `127.0.0.1` | API bind host |
| `PORTAL_PORT` | `9000` | API bind port |
| `PORTAL_REQUEST_TIMEOUT` | `5.0` | URL fetch timeout (seconds) |
| `PORTAL_MAX_REDIRECTS` | `3` | Maximum redirect follows |

## License

Internal use only.
