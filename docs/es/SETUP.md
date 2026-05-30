# 🛠️ Guía de Instalación

Esta guía te guiará paso a paso para configurar **TBC Duck Analyzer** en tu equipo local utilizando su nueva arquitectura de backend con Node.js.

## 📋 Requisitos Previos

Antes de empezar, asegúrate de tener instalados los siguientes programas:

1. **Node.js** (v14 o superior) - [Descargar aquí](https://nodejs.org/)
2. **Git** - [Descargar aquí](https://git-scm.com/)

## 🔑 Paso 1: Consigue tus API Keys de WarcraftLogs

La aplicación utiliza la API oficial v2 de WarcraftLogs para descargar la información. Necesitas crear un cliente gratuito de la API.

1. Ve a [WarcraftLogs API Console](https://www.warcraftlogs.com/api/clients) e inicia sesión.
2. En el apartado "Create a new Client", ponle el nombre que quieras a tu cliente (ej. "TBC Duck Analyzer").
3. Una vez creado, la web te mostrará un **Client ID** (36 caracteres) y un **Client Secret** (40 caracteres).
4. **Guárdalos o deja la ventana abierta**, los vas a necesitar en el Paso 3.

## 💻 Paso 2: Instala la Aplicación

1. Abre tu terminal o consola de comandos.
2. Clona este repositorio:
   ```bash
   git clone https://github.com/patitokun03-spec/TBC-Duck-Analyzer.git
   ```
3. Entra en la carpeta del proyecto:
   ```bash
   cd TBC-Duck-Analyzer
   ```
4. Instala todas las dependencias necesarias de Node.js:
   ```bash
   npm install
   ```

## ⚙️ Paso 3: Configura tus API Keys

En esta nueva versión, por seguridad, las contraseñas de la API ya no se ponen en la web, sino que se guardan en tu propio servidor local.

1. En la carpeta raíz del proyecto, busca un archivo llamado `.env.example` y renómbralo a `.env` (o crea un archivo `.env` vacío si no lo encuentras).
2. Abre el archivo `.env` con un bloc de notas o cualquier editor de código.
3. Pega tu Client ID y tu Client Secret de esta forma:
   ```env
   WCL_CLIENT_ID=pega_tu_client_id_aqui
   WCL_CLIENT_SECRET=pega_tu_client_secret_aqui
   PORT=3000
   ```
4. Guarda el archivo.

## 🚀 Paso 4: Arranca el Servidor

1. En la terminal (dentro de la carpeta del proyecto), ejecuta este comando para iniciar el servidor backend:
   ```bash
   npm start
   ```
   *(También sirve usar el comando `node server.js`)*
2. Deberías ver un mensaje en verde confirmando que el servidor se ha iniciado correctamente y que la base de datos de caché local está conectada:
   ```text
   Server running on http://localhost:3000
   Database initialized successfully.
   ```

## 🌐 Paso 5: ¡A Analizar Logs!

1. Abre el navegador y entra en `http://localhost:3000`.
2. Busca cualquier log de TBC Classic en la web de WarcraftLogs (ej. `https://classic.warcraftlogs.com/reports/xyz123...`).
3. Pega la URL en la barra de búsqueda de nuestra página.
4. Pulsa en **LOG CHECK**. El servidor local descargará los datos y los guardará en su base de datos interna `database.sqlite` de forma que los pueda renderizar de manera ultrarrápida.

## ❓ Solución de Problemas Comunes

- **Error: Invalid Client or Secret**: Revisa que hayas puesto las claves correctamente en tu archivo `.env` y que no hayas dejado espacios en blanco extra.
- **Error: Address already in use**: Otro programa de tu ordenador ya está usando el puerto 3000. Puedes cambiar `PORT=3001` en tu archivo `.env` y volver a iniciar el servidor.
- **Los datos no se actualizan**: La aplicación guarda caché de forma muy agresiva para ahorrar peticiones a la API. Si un log era "en vivo" y se han añadido trys nuevos después, puedes usar el botón de forzar actualización desde la web o bien borrar el archivo `database.sqlite`.
