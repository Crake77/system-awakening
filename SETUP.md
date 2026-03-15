# System Awakening — Setup Guide

## What You Need
- **Node.js** (free): https://nodejs.org — download the LTS version, install it
- **Git** (free): You likely have this already if you use Vercel
- **A code editor** (free): VS Code recommended (https://code.visualstudio.com)
- **Claude Code** (optional but recommended): For AI-assisted coding from terminal

## Step 1: Get the project running locally

Open your terminal (Terminal on Mac, Command Prompt or PowerShell on Windows).

```bash
# Navigate to where you want the project (e.g., your home folder)
cd ~

# Copy the system-awakening folder to wherever you want it
# (if you downloaded the zip from Claude, unzip it first)

# Go into the project folder
cd system-awakening

# Install dependencies (only need to do this once)
npm install

# Start the dev server
npm run dev
```

You should see something like:
```
  VITE v5.x.x  ready in 300ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.45:5173/
```

Open http://localhost:5173 in your browser — your game is running!

**To view on your phone:** Open the Network URL on your phone's browser (must be same wifi).

**To stop the server:** Press Ctrl+C in the terminal.

## Step 2: Connect to GitHub

```bash
# Inside the project folder:
git init
git add .
git commit -m "Initial commit"

# Create a new repo on github.com (click the + button, "New repository")
# Name it "system-awakening" (or whatever you want)
# DON'T check "Add a README" (we already have files)
# Then run the commands GitHub shows you:

git remote add origin https://github.com/YOUR_USERNAME/system-awakening.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New Project"
3. Import your GitHub repo "system-awakening"
4. Framework Preset: **Vite**
5. Click Deploy
6. Done! You'll get a URL like `system-awakening.vercel.app`

Every time you push to GitHub, Vercel auto-deploys.

## Step 4: Using Claude Code for development

```bash
# Install Claude Code if you haven't
npm install -g @anthropic-ai/claude-code

# Navigate to your project
cd ~/system-awakening

# Start Claude Code
claude

# Now you can say things like:
# "Add a new dungeon rank SS between A and S"
# "Make the incursion boss have 4 phases instead of 3"
# "Add a new body technique called Dragon Blood"
```

Claude Code will read your files, understand the structure, and make targeted edits.

## Step 5: Saving your changes

```bash
git add .
git commit -m "describe what you changed"
git push
```

Vercel deploys automatically after push.

## Project Structure

```
system-awakening/
├── index.html              ← The HTML shell
├── package.json            ← Dependencies
├── vite.config.js          ← Vite configuration
├── SETUP.md                ← This file
├── src/
│   ├── main.jsx            ← Entry point
│   ├── App.jsx             ← Main game component (layout, tabs, header)
│   ├── styles.css          ← Global styles
│   ├── data/
│   │   ├── monsters.js     ← Dungeon ranks, monster stats, drops
│   │   ├── equipment.js    ← Weapons, armor, accessories
│   │   ├── cultivation.js  ← Med tech, core, meridians, body techniques
│   │   ├── skills.js       ← Combat skills + manuals
│   │   ├── housing.js      ← Housing, beds, residence upgrades
│   │   ├── jobs.js         ← Processing jobs + hires
│   │   ├── pills.js        ← Consumable items
│   │   └── regression.js   ← Prestige upgrades
│   ├── game/
│   │   ├── state.js        ← Initial state + init function
│   │   ├── helpers.js      ← All stat calculations (getAtk, getDef, etc.)
│   │   ├── tick.js         ← The main game loop (runs every 500ms)
│   │   └── save.js         ← Auto-save / load from localStorage
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Bar.jsx     ← Progress bar component
│   │   │   ├── Btn.jsx     ← Button component
│   │   │   ├── Sec.jsx     ← Section panel component
│   │   │   └── common.jsx  ← TabBtn, MatCost, StatBox, etc.
│   │   └── tabs/
│   │       ├── DungeonTab.jsx
│   │       ├── CultivationTab.jsx
│   │       ├── EquipmentTab.jsx
│   │       ├── ShopTab.jsx
│   │       ├── SkillsTab.jsx
│   │       ├── ResidenceTab.jsx
│   │       ├── JobsTab.jsx
│   │       ├── BudgetTab.jsx
│   │       └── RegressionTab.jsx
```

## Why this structure?

- **data/** = Pure data, no logic. Easy to tweak numbers, add items.
- **game/** = Game logic separated from UI. The tick loop, state management, calculations.
- **components/** = What the player sees. Each tab is its own file.
- **When Claude Code makes changes**, it only needs to touch 1-2 files instead of rewriting everything.

## Save System

The game auto-saves to your browser's localStorage every 30 seconds.
When you open the game, it loads your last save automatically.
There's a manual save/load/reset in the game menu.
Note: localStorage is per-device. Your phone and PC have separate saves.
