SHELL := /bin/bash
.PHONY: all dev build lint test install restart logs clean help

# Default target
all: help

# Development
dev: ## Start development servers (API + Vite)
	./scripts/dev.sh

bootstrap: ## Install all dependencies (Python + Node.js)
	./scripts/bootstrap.sh

# Build
build: ## Build frontend for production
	./scripts/build.sh

# Code quality
lint: lint-api lint-web ## Run all linters

lint-api: ## Run Python linter (ruff)
	cd apps/portal-api && source venv/bin/activate && ruff check app tests && ruff format --check app tests

lint-web: ## Run TypeScript/React linter (eslint)
	cd apps/portal-web && npm run lint

format: format-api format-web ## Format all code

format-api: ## Format Python code
	cd apps/portal-api && source venv/bin/activate && ruff format app tests

format-web: ## Format TypeScript/React code
	cd apps/portal-web && npm run format

# Testing
test: test-api test-web ## Run all tests

test-api: ## Run Python tests
	cd apps/portal-api && source venv/bin/activate && pytest -v

test-web: ## Run React tests
	cd apps/portal-web && npm test -- --run

# Production deployment
install: ## Install to /opt/portal (requires sudo)
	sudo ./scripts/install.sh

restart: ## Restart production services (requires sudo)
	sudo systemctl restart portal-api
	sudo systemctl reload nginx

logs: ## Show API logs (requires sudo)
	sudo journalctl -u portal-api -f

status: ## Show service status
	@echo "=== Portal API Status ==="
	@systemctl status portal-api --no-pager || true
	@echo ""
	@echo "=== NGINX Status ==="
	@systemctl status nginx --no-pager || true

# Cleanup
clean: ## Remove build artifacts and caches
	rm -rf apps/portal-web/dist
	rm -rf apps/portal-web/node_modules/.cache
	rm -rf apps/portal-api/__pycache__
	rm -rf apps/portal-api/app/__pycache__
	rm -rf apps/portal-api/.pytest_cache
	rm -rf apps/portal-api/.ruff_cache
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Help
help: ## Show this help message
	@echo "Internal Tools Portal - Available targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Quick start:"
	@echo "  make bootstrap   # First time setup"
	@echo "  make dev         # Start development servers"
