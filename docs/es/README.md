# 🔍 TBC Duck Analyzer - Analizador de Logs WoW

Una herramienta profesional para analizar logs de combate de **World of Warcraft TBC** desde **WarcraftLogs**. Proporciona una vista exhaustiva e interactiva de los consumibles, buffs, interrupciones, uptime de debuffs y habilidades por jugador.

![Version](https://img.shields.io/badge/Version-2.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Características

- 📊 **Análisis detallado de logs** - Visualiza consumibles, buffs y encantamientos de armas.
- ⏱️ **Líneas de tiempo interactivas** - Ve exactamente en qué milisegundo los jugadores usaron sus CDs principales, abalorios, raciales y consumibles.
- 🎯 **Seguimiento de Uptime** - Tracking preciso de buffs vitales de raid (Tótems, Battle Shout) y debuffs cruciales en el boss (Sunder Armor, Faerie Fire, Sentencias).
- ⚡ **Registro de Interrupciones** - Detecta automáticamente cuándo cada jugador interrumpió casteos enemigos.
- 🔍 **Inspector de Equipo** - Revisa el equipo exacto, encantamientos y gemas que llevaba puesto un jugador durante un combate específico.
- 💾 **Caché en el Servidor Backend** - Utiliza un backend en Node.js/Express con caché en SQLite, lo que significa que los logs se procesan de manera instantánea y no se agotan los límites de la API.
- 🎨 **Interfaz Premium** - Estética oscura, dinámica, con animaciones fluidas y filtros por encuentros de Boss o Trash.

## 🚀 Inicio Rápido

### 1. Obtén tus API Keys de WarcraftLogs

1. Ve a la [WarcraftLogs API Console](https://www.warcraftlogs.com/api/clients)
2. Crea un nuevo cliente (API v2) llamado "TBC Duck Analyzer"
3. Copia el **Client ID** y el **Client Secret**.

### 2. Configura e inicia el Servidor

1. Asegúrate de tener instalado [Node.js](https://nodejs.org/).
2. Clona este repositorio y ejecuta `npm install` en la carpeta principal.
3. Renombra el archivo `.env.example` a `.env` (o créalo si no existe) e inserta tus keys:
   ```env
   WCL_CLIENT_ID=tu_client_id_aqui
   WCL_CLIENT_SECRET=tu_client_secret_aqui
   PORT=3000
   ```
4. Arranca el servidor ejecutando `node server.js` o `npm start`.
5. Abre `http://localhost:3000` en tu navegador web.

### 3. Analiza un log

1. Copia la URL completa de tu reporte de WarcraftLogs (ej: `https://www.warcraftlogs.com/reports/...`).
2. Pégalo en la barra de búsqueda de la aplicación.
3. Haz clic en **LOG CHECK**.
4. ¡Disfruta del análisis al detalle!

## 📋 Estructura del Proyecto

```text
TBC-Duck-Analyzer/
├── server.js               # Backend en Express & Proxy de GraphQL
├── database.sqlite         # Caché local en SQLite para datos de WCL
├── public/                 # Aplicación Frontend
│   ├── index.html          # HTML Principal
│   ├── css/                # Estilos
│   ├── js/                 # Lógica de cliente (procesador, modals)
│   └── assets/             # Iconos e imágenes
├── docs/                   # Documentación (ES/EN)
├── .env                    # Configuración de claves API
└── README.md               # Este archivo
```

## 🔧 Datos Soportados

### Consumibles Rastreados
- Frascos y Elixires (Flasks & Elixirs)
- Pociones (Haste, Destruction, Mana, Healing)
- Encantamientos temporales de armas (Piedras de afilado, Venenos, Aceites)
- Objetos de Ingeniería (Sappers, Adamantite Grenades, Dense Dynamite, etc.)

### Seguimiento específico por Clase
- Tracking de Cooldowns principales, Bloodlust/Heroism, y buffs/debuffs específicos de cada clase y rama de talentos.
- Métricas avanzadas como el uptime del **Windfury Totem**, los contadores de casteo de **Sunder Armor / Devastate**, el seguimiento de **Improved Scorch**, etc.

### Habilidades de Interrupción
- **Rogue**: Kick
- **Warrior**: Pummel, Shield Bash
- **Mage**: Counterspell
- **Shaman**: Earth Shock

### Habilidades Raciales
- **Blood Elf**: Arcane Torrent
- **Undead**: Will of the Forsaken
- **Dwarf**: Stoneform
- **Tauren**: War Stomp
- **Orc/Troll**: Blood Fury, Berserking

## 🐛 Reportar Errores

¿Encontraste un bug o tienes una sugerencia? Crea un issue en [GitHub Issues](https://github.com/patitokun03-spec/TBC-Duck-Analyzer/issues).

## 📚 Documentación adicional

- [SETUP.md](SETUP.md) - Guía detallada de configuración.
- [CONTRIBUTING.md](CONTRIBUTING.md) - Cómo contribuir con código o datos.

## 📝 Changelog

Revisa el [CHANGELOG.md](../../CHANGELOG.md) para el historial de versiones completo.

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor lee `CONTRIBUTING.md` antes de enviar un Pull Request.

## 📄 Licencia

Distribuido bajo la licencia MIT. Ver `LICENSE` para más información.
