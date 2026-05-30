# 🛠️ Setup Guide

This guide will walk you through setting up the **TBC Duck Analyzer** locally using its new Node.js backend architecture.

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your machine:

1. **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
2. **Git** - [Download here](https://git-scm.com/)

## 🔑 Step 1: Get your WarcraftLogs API Keys

The application uses the official WarcraftLogs API v2 to fetch data. You'll need to create a free API client.

1. Go to the [WarcraftLogs API Console](https://www.warcraftlogs.com/api/clients) and log in.
2. Under "Create a new Client", give your client a name (e.g., "TBC Duck Analyzer").
3. Once created, you will see a **Client ID** (36 characters) and a **Client Secret** (40 characters).
4. **Keep these open**, you will need them in Step 3.

## 💻 Step 2: Install the Application

1. Open your terminal or command prompt.
2. Clone the repository:
   ```bash
   git clone https://github.com/patitokun03-spec/TBC-Duck-Analyzer.git
   ```
3. Navigate into the project folder:
   ```bash
   cd TBC-Duck-Analyzer
   ```
4. Install the required Node.js dependencies:
   ```bash
   npm install
   ```

## ⚙️ Step 3: Configure your API Keys

Instead of typing your keys into the browser, they are now securely stored on the backend.

1. In the root directory of the project, rename the file `.env.example` to `.env` (or create a new `.env` file if it doesn't exist).
2. Open the `.env` file in any text editor.
3. Paste your Client ID and Client Secret:
   ```env
   WCL_CLIENT_ID=paste_your_client_id_here
   WCL_CLIENT_SECRET=paste_your_client_secret_here
   PORT=3000
   ```
4. Save the file.

## 🚀 Step 4: Run the Server

1. In your terminal, run the following command to start the server:
   ```bash
   npm start
   ```
   *(Alternatively, you can run `node server.js`)*
2. You should see a message confirming the server is running and the database is connected:
   ```text
   Server running on http://localhost:3000
   Database initialized successfully.
   ```

## 🌐 Step 5: Analyze Logs!

1. Open your web browser and go to `http://localhost:3000`.
2. Find any TBC Classic log on WarcraftLogs (e.g., `https://classic.warcraftlogs.com/reports/xyz123...`).
3. Paste the URL into the search bar.
4. Click **LOG CHECK**. The backend will fetch the data from WCL, cache it locally in a SQLite database to save API calls, and render the results instantly!

## ❓ Troubleshooting

- **Error: Invalid Client or Secret**: Double-check that your `.env` file contains the exact keys from WarcraftLogs without any extra spaces.
- **Error: Address already in use**: Another program is using port 3000. You can change `PORT=3001` in your `.env` file and restart the server.
- **Data not updating**: The app aggressively caches data in `database.sqlite` to make it lightning fast. If you need to force a fresh fetch (because a log was live-logged and updated later), you can click "Force Update" in the UI.
