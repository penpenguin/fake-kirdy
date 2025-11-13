# Repository Guidelines

## Serena Tooling Expectations
- Default to Serena's MCP integrations whenever you need context; it centralizes specs, saved memories, and helper scripts so agents stay in sync.
- Kick off each session by opening the Serena Instructions Manual (call `mcp__serena__initial_instructions`) and listing resources via `list_mcp_resources` to learn what's already documented before poking around the repo.
- Use `read_mcp_resource` (or the parameterized templates) instead of ad-hoc browsing when you need docs from `docs/` or historical decisions, and record new findings with `write_memory` so future agents inherit them.
- Favor Serena's memory + resource workflow during hand-offs (e.g., summarize outstanding bugs, feature flags, or test gaps) to minimize institutional knowledge loss.

## ExecPlans
When writing complex features or significant refactors, use an ExecPlan (as described in .agent/PLANS.md) from design to implementation.

## Project Structure & Module Organization
- `src/` contains runtime TypeScript; `src/main.ts` bootstraps Phaser and delegates to `src/game/` for scenes and physics helpers.
- Tests sit next to their modules (e.g., `src/main.test.ts`) or under `test/` for tooling coverage like `vite-config.test.ts`.
- Static assets live in `public/` and compile into `dist/` via `npm run build`; leave `dist/` untouched between releases.
- Scope, rules, and open tasks are tracked in `docs/`; revise those specs before adjusting gameplay.

## Build, Test, and Development Commands
- `npm run dev` starts the Vite dev server with hot reload at `http://localhost:5173`.
- `npm run build` emits the production bundle into `dist/` matching the Pages deployment.
- `npm run preview` serves the built bundle for local smoke checks.
- `npm run test` executes the Vitest suite in jsdom; `npm run test:watch` keeps the red→green loop tight.
- `npm run typecheck` runs `tsc --noEmit` to catch signature drift early.

## Coding Style & Naming Conventions
- Use TypeScript with ES modules, 2-space indentation, and `const` defaults; supply explicit return types for exported APIs.
- Favor `camelCase` for values, `PascalCase` for types and classes, and kebab-case filenames (`create-game-scene.ts`) unless mirroring third-party names.
- Keep Phaser factories side-effect free; limit direct DOM access to entrypoints such as `src/main.ts`.
- No repo formatter is enforced, so follow surrounding style and keep imports ordered logically.

## Testing Guidelines
- Prefer fast unit tests with Vitest + jsdom; isolate Phaser or Matter using `vi.mock`.
- Name files `<subject>.test.ts` near the code or place infra checks under `test/`.
- Apply Takuto Wada’s TDD cycle: write the smallest failing spec, make it pass, then refactor safely.
- Extend `vitest.setup.ts` for shared matchers instead of repeating hooks.
- Guard critical gameplay modules (`src/game/**`) with regression tests before fixing bugs.

## Commit & Pull Request Guidelines
- Mirror the history: short, imperative commit subjects without trailing periods (e.g., "Add terrain tile visuals").
- Bundle changes by TDD stage when possible—tests first, implementation next, refactors last.
- Reference the relevant spec task in each PR, summarise gameplay impact, and note test commands run; include media for visual updates.
- Validate `npm run test` and `npm run build` locally before requesting review, and flag deferred work as follow-up tasks.
