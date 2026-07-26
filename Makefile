.PHONY: help install dev build preview check check-watch lint lint-a11y test test-a11y

help:
	@echo "Available targets:"
	@echo "  install     Install dependencies"
	@echo "  dev         Start the dev server (http://localhost:5173)"
	@echo "  build       Production build"
	@echo "  preview     Preview the production build"
	@echo "  check       Type-check (svelte-check)"
	@echo "  check-watch Type-check in watch mode"
	@echo "  lint        ESLint (TS + Svelte files)"
	@echo "  lint-a11y   svelte-check at warning threshold"
	@echo "  test        Playwright E2E tests"
	@echo "  test-a11y   axe-core a11y tests (Playwright)"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

check:
	npm run check

check-watch:
	npm run check:watch

lint:
	npm run lint

lint-a11y:
	npm run lint:a11y

test:
	npm run test

test-a11y:
	npm run test:a11y
