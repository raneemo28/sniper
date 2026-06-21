# 🎯 Sniper — Browser-Based 3D Shooter

A browser-based 3D sniper/wave-survival game built with **Three.js** and **TypeScript**, powered by **Vite**.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm

### Installation

```bash
# Clone or download the project
cd sniper

# Install dependencies
npm install
```

### Running Locally

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

### Building for Production

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

## 🎮 Gameplay

- Survive endless waves of enemies attacking your position.
- Shoot enemies using **raycasting** — aim and click to fire.
- Each hit earns points; your score is tracked live on the HUD.
- Taking damage reduces your health bar. Reach 0 HP → **Game Over**.
- Choose difficulty before starting: **Easy**, **Medium**, or **Hard**.

### Controls

| Action        | Input              |
|---------------|--------------------|
| Look around   | Mouse movement     |
| Shoot         | Left mouse click   |
| Move          | WASD / Arrow keys  |

---

## 🏗️ Project Structure

```
sniper/
├── index.html              # Entry HTML
├── src/
│   ├── main.ts             # App entry point
│   ├── Game.ts             # Core game loop & orchestrator
│   ├── components/
│   │   ├── Player.ts       # Player state, health, movement
│   │   └── Enemy.ts        # Enemy AI & behaviour
│   ├── scenes/
│   │   ├── GameScene.ts    # Three.js scene, lighting, environment
│   │   └── UIScene.ts      # HUD, menus, game-over overlay
│   ├── systems/
│   │   ├── WaveSystem.ts   # Enemy wave spawning & scaling
│   │   ├── RaycastSystem.ts# Hit detection via raycasting
│   │   ├── CameraSystem.ts # Camera controls & yaw tracking
│   │   ├── InputHandler.ts # Keyboard / mouse input
│   │   ├── ScoreSystem.ts  # Score tracking & snapshots
│   │   └── AudioSystem.ts  # Spatial audio management
│   ├── models/             # 3D model assets
│   ├── audio/              # Audio assets
│   └── utils/
│       └── EventEmitter.ts # Pub/sub event bus
├── package.json
└── tsconfig.json
```

---

## 🛠️ Tech Stack

| Technology | Role |
|------------|------|
| [Three.js](https://threejs.org/) `^0.184` | 3D rendering engine |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe source language |
| [Vite](https://vitejs.dev/) `^8` | Dev server & bundler |
| `vir` | Utility library |

---

## ⚙️ Architecture Overview

The game uses a **event-driven** architecture with a central `EventEmitter` (pub/sub bus) that decouples all systems from each other.

```
Game (orchestrator)
 ├── GameScene      → Three.js scene, camera, lighting
 ├── UIScene        → HUD overlay, menus, game-over screen
 ├── Player         → Health, position, model
 ├── InputHandler   → Raw input → events
 ├── CameraSystem   → Camera tracking & yaw
 ├── WaveSystem     → Spawns & scales enemy waves
 ├── RaycastSystem  → Hit detection
 ├── ScoreSystem    → Score tracking
 └── AudioSystem    → Spatial audio
         ↕  (all communicate via EventEmitter)
```

Key events used across the bus:

| Event | Description |
|-------|-------------|
| `player:hit` | Enemy damages the player |
| `visual:tracer` | Render bullet tracer effect |
| `ui:gameover` | Trigger game-over screen |
| `game:reset` | Reset all systems for a new game |
| `menu:start` | Start game from the main menu |
| `settings:difficulty` | Change difficulty level |
| `settings:appearance` | Toggle dark/light theme |
| `settings:audio` | Mute/unmute audio |

---

## 📦 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

