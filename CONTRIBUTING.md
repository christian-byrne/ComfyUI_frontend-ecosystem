# Contributing

## Development Setup

```bash
git clone https://github.com/christian-byrne/ComfyUI_frontend-ecosystem.git
cd ComfyUI_frontend-ecosystem
pnpm install
pnpm dev
```

## Available Scripts

| Script              | Description                         |
| ------------------- | ----------------------------------- |
| `pnpm dev`          | Start development server            |
| `pnpm build`        | Type-check and build for production |
| `pnpm format`       | Format code                         |
| `pnpm lint`         | Lint code                           |
| `pnpm typecheck`    | Run TypeScript type checking        |
| `pnpm test`         | Run unit tests (Vitest)             |
| `pnpm test:e2e`     | Run E2E tests (Playwright)          |
| `pnpm verify:quick` | Quick verification (typecheck)      |

## PR Process

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm verify:quick` to ensure types pass
4. Run `pnpm test` to ensure unit tests pass
5. Submit your PR

## Code Style

- **Vue 3 Composition API** with `<script setup>` syntax
- **TypeScript** for all source files
- Follow existing patterns in the codebase
