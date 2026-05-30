# 🔍 TBC Duck Analyzer - WoW TBC Log Analyzer

A professional tool to analyze **World of Warcraft TBC** combat logs from **WarcraftLogs**. It provides a comprehensive, interactive view of consumables, buffs, interrupts, debuff uptimes, and abilities per player.

![Version](https://img.shields.io/badge/Version-2.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- 📊 **Detailed Log Analysis** - View consumables, buffs, and weapon enchants.
- ⏱️ **Interactive Timelines** - See exactly when players used their major cooldowns, trinkets, racials, and consumables.
- 🎯 **Uptime Tracking** - Precise tracking of vital raid buffs (Totems, Battle Shout) and debuffs (Sunder Armor, Faerie Fire, Judgements).
- ⚡ **Interrupts Tracking** - Automatically detects when players interrupted enemy spellcasts.
- 🔍 **Gear Inspector** - View the exact gear, enchants, and gems equipped by a player during a specific fight.
- 💾 **Backend Caching** - Utilizes a Node.js/Express backend with SQLite caching, meaning logs are processed instantly and API limits are respected.
- 🎨 **Premium UI** - Sleek dark mode aesthetics with seamless animations and filtering by encounters or trash fights.

## 🚀 Quick Start

### 1. Get your WarcraftLogs API Keys

1. Go to the [WarcraftLogs API Console](https://www.warcraftlogs.com/api/clients)
2. Create a new client (API v2) called "TBC Duck Analyzer"
3. Copy the **Client ID** and **Client Secret**

### 2. Configure and Run the Backend

1. Ensure you have [Node.js](https://nodejs.org/) installed.
2. Clone this repository and run `npm install` in the root folder.
3. Rename `.env.example` to `.env` (or create it) and insert your keys:
   ```env
   WCL_CLIENT_ID=your_client_id_here
   WCL_CLIENT_SECRET=your_client_secret_here
   PORT=3000
   ```
4. Start the server by running `node server.js` or `npm start`.
5. Open `http://localhost:3000` in your web browser.

### 3. Analyze a Log

1. Copy the full URL of your WarcraftLogs report (e.g. `https://www.warcraftlogs.com/reports/...`).
2. Paste it into the search bar in the app.
3. Click **LOG CHECK**.
4. Enjoy the detailed breakdown!

## 📋 Project Structure

```text
TBC-Duck-Analyzer/
├── server.js               # Express backend & GraphQL proxy
├── database.sqlite         # Local SQLite cache for WCL data
├── public/                 # Frontend Application
│   ├── index.html          # Main HTML
│   ├── css/                # Styling
│   ├── js/                 # Client logic (processor, app, modals)
│   └── assets/             # Icons and images
├── docs/                   # Documentation (EN/ES)
├── .env                    # API keys configuration
└── README.md               # This file
```

## 🔧 Tracked Data

### Consumables
- Flasks & Elixirs
- Potions (Haste, Destruction, Mana, Healing)
- Weapon Enchants & Sharpening Stones
- Engineering Items (Sappers, Adamantite Grenades, Dense Dynamite, etc.)

### Class specific Tracking
- Tracks major cooldowns, Bloodlust/Heroism, and specific buffs/debuffs for every class and spec.
- Advanced metrics like **Windfury Totem** uptime, **Sunder Armor / Devastate** cast counts, **Improved Scorch** tracking, and more.

### Interrupts
- **Rogue**: Kick
- **Warrior**: Pummel, Shield Bash
- **Mage**: Counterspell
- **Shaman**: Earth Shock

### Racials
- **Blood Elf**: Arcane Torrent
- **Undead**: Will of the Forsaken
- **Dwarf**: Stoneform
- **Tauren**: War Stomp
- **Orc/Troll**: Blood Fury, Berserking

## 🐛 Bug Reports

Found a bug or have a suggestion? Open an issue on [GitHub Issues](https://github.com/patitokun03-spec/TBC-Duck-Analyzer/issues).

## 📚 Documentation

- [SETUP.md](SETUP.md) - Detailed setup guide.
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute code or data.

## 📝 Changelog

See [CHANGELOG.md](../../CHANGELOG.md) for version history.

## 🤝 Contributing

Contributions are welcome! Please read `CONTRIBUTING.md` before submitting a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
