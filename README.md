# 🔍 TBC Duck Analyzer - WoW TBC Log Analyzer

**Professional tool to analyze World of Warcraft TBC combat logs. Track consumables, buffs, debuffs, interrupts, and abilities per player with a powerful local backend.**

---

## 📚 Full Documentation

- **[English Docs](docs/en/README.md)** - Complete documentation and features
- **[Setup Guide](docs/en/SETUP.md)** - Step-by-step setup instructions
- **[Changelog](CHANGELOG.md)** - Version history

- **[Documentación en Español](docs/es/README.md)** - Documentación completa
- **[Guía de Configuración](docs/es/SETUP.md)** - Instrucciones paso a paso

---

## ✨ Features at a Glance

- 📊 **Detailed Log Analysis:** Extracts events from Warcraft Logs using the v2 GraphQL API.
- ⚡ **Lightning Fast Backend:** Node.js + Express backend with an embedded SQLite database to cache WCL requests, avoiding rate limits and loading instantly.
- 🎯 **Advanced Tracking:** Tracks consumables (flasks, elixirs, weapon enchants, sappers), class abilities, interrupts, and racials.
- 🛡️ **Debuff & Buff Uptime:** Fully interactive timeline for crucial raid debuffs (Sunder Armor, Improved Scorch, Judgements) and buffs (Battle Shout, Totems).
- 🔍 **Gear Inspector:** Inspect exact player gear, enchants, and gems directly from the log.
- 🎨 **Premium UI:** A sleek, dynamic dark-mode interface inspired by modern gaming aesthetics.

---

## 🚀 Quick Start

1. Clone the repository and run `npm install`.
2. Copy `.env.example` to `.env` and add your Warcraft Logs Client ID and Secret.
3. Run `node server.js` or `npm start`.
4. Open `http://localhost:3000` in your browser.
5. Paste a Warcraft Logs URL and analyze!

For detailed instructions, see the [Setup Guide](docs/en/SETUP.md).

---

## 📝 License

MIT License - See [LICENSE](LICENSE)

---

**Made with ❤️ for the WoW TBC community**
