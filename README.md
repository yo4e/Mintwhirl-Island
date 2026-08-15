# Mintwhirl Island

> **Current in-game working title:** Pocket Storm

Mintwhirl Island is a playable, single-player low-poly third-person action-survival prototype. The player fights toy-like NPCs while a Storm Mint safe zone closes, choosing upgrades, collecting drops, and surviving escalating island events.

## Play locally

```bash
pnpm install
pnpm dev
```

Open the local Vite URL, then select **島へドロップ**. Controls are shown on the launch screen: `WASD` to move, mouse to look, click to shoot, `RMB` to aim, `Shift` to dash, `C` to swap shoulders, `E` for Mint Hop, `1–3` for weapons, and `R` to reload.

## Build and checks

```bash
pnpm check
pnpm build
```

GitHub Pages uses `pnpm build:pages`. The deployment workflow is in [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## Naming status

The game UI and code deliberately retain **Pocket Storm** as a temporary in-game working title. The public candidate name is **Mintwhirl Island**. See [`docs/name-research.md`](docs/name-research.md) for the primary screening and required checks before public release.

## Project structure

| Location | Purpose |
| --- | --- |
| `client/src/game/` | Babylon.js scene, combat, NPCs, storm, pickups, upgrades, and round loop |
| `client/src/components/GameCanvas.tsx` | React frame and HUD / overlay markup |
| `client/public/assets/` | Logo, sky, and terrain assets bundled for GitHub Pages |
| `PLAN.md`, `STRUCTURE.md`, `MEMORY.md`, `ASSETS.md` | Design, implementation, and asset records |

## License

This repository is provided under the MIT license as declared in `package.json`. Verify third-party asset and distribution rights before commercial release.
