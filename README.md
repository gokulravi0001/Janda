# Personal Discord User-Install Application

A private, owner-restricted Discord application built using **Discord's User Install functionality**. Unlike traditional server-installed bots, this application installs directly to your Discord personal account and travels with you across servers, group DMs, and private channels without requiring server invites or administrator permissions.

---

## 📁 Project Folder Structure

```
.
├── config/
│   └── index.js            # Environment validation, configuration, and owner settings
├── database/
│   ├── index.js            # Unified database layer interface
│   └── authRepository.js   # Authorization repository with atomic JSON persistence
├── commands/
│   └── send.js             # /send slash command configured strictly for USER_INSTALL
├── events/
│   ├── ready.js            # ClientReady event logger
│   └── interactionCreate.js # Interaction router with security authorization middleware
├── handlers/
│   ├── commandHandler.js   # Dynamic command loader
│   └── eventHandler.js     # Dynamic event listener loader
├── utils/
│   ├── logger.js           # Structured console logger with timestamp and levels
│   └── permissions.js      # Discord Snowflake validator
├── data/                   # Persistent storage for authorized users (auto-created)
├── deploy-commands.js      # Global slash command registration script
├── manage-auth.js          # CLI tool for the owner to manage authorized user IDs
├── index.js                # Main application entrypoint
├── .env.example            # Environment variables template
├── .gitignore              # Ignores secrets, database, and dependencies
└── package.json            # Project manifest and scripts
```

---

## ⚙️ 1. Discord Developer Portal Configuration

To configure this bot as a **User-Install only** application:

### Step 1: Create the Discord Application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application**, give it a name, and accept Discord's Developer Terms.
3. On the **General Information** page:
   - Copy the **Application ID** (this is your `CLIENT_ID`).

### Step 2: Configure the Bot
1. Navigate to the **Bot** tab on the left sidebar.
2. Click **Reset Token** (or **Add Bot** if prompted) and copy your bot token (this is your `DISCORD_TOKEN`).
3. Set **Public Bot** to **OFF** (keeps your bot application private).
4. Under **Privileged Gateway Intents**: None of these are required! Keep Message Content, Server Members, and Presence unchecked.

### Step 3: Configure User Install Settings (Crucial)
1. Navigate to the **Installation** tab on the left sidebar.
2. Under **Installation Contexts**:
   - ✅ **Check "User Install"**
   - ❌ **Uncheck "Guild Install"** (Do NOT allow server install)
3. Under **Default Install Settings**:
   - Scopes: Select `applications.commands`.
   - Permissions: None required for user-install commands (default: 0).
4. Under **Install Link**:
   - Choose **Discord Provided Link**.
   - Discord will generate a direct User Install link formatted as:
     ```
     https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&integration_type=1&scope=applications.commands
     ```
5. Click **Save Changes**.

---

## 🚀 2. Installation & Setup

### Prerequisites
- Node.js **v18.0.0 or higher** (tested on Node.js v20+ and v24).
- npm installed.

### Step 1: Clone / Open Project
In the project directory:
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `copy .env.example .env`)*

Open `.env` and fill in your values:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
OWNER_ID=your_discord_user_id_here
DATABASE_PATH=./data/authorized_users.json
NODE_ENV=production
```

> **How to get your Discord User ID (`OWNER_ID`):**
> 1. In Discord, go to **User Settings** -> **Advanced** -> Turn ON **Developer Mode**.
> 2. Right-click your own avatar/profile in any chat or user list and click **Copy User ID**.
> 3. Paste this 17-20 digit number as `OWNER_ID`.

---

## 📡 3. Register Application Commands

Before running the bot, register the `/send` command with Discord. Because user-installed commands are used globally, they must be registered via the global deployment endpoint:

```bash
npm run deploy
```

You should see:
```
[INFO] Prepared command: /send (IntegrationTypes: [1], Contexts: [0,1,2])
[INFO] Starting deployment of 1 application command(s) globally...
[SUCCESS] Successfully deployed 1 global slash command(s) for User Install!
```

---

## 🔒 4. Install the App to Your Discord Account

1. Open your generated User Install URL in your web browser:
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&integration_type=1&scope=applications.commands
   ```
2. Discord will display an installation modal stating **"Add to My Apps"** (rather than adding to a server).
3. Click **Authorize**.
4. The bot application is now bound directly to your personal Discord account!

---

## ▶️ 5. Running the Application

### Development / Local Run
```bash
npm start
```

### Production Hosting with PM2 (Recommended)
To keep the application running 24/7 in the background on your server or VPS:
```bash
npm install -g pm2
pm2 start index.js --name "discord-user-bot"
pm2 save
pm2 startup
```

### Production Hosting with Systemd (Linux VPS)
Create `/etc/systemd/system/discord-user-bot.service`:
```ini
[Unit]
Description=Discord Personal User-Install Bot
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/project
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
EnvironmentFile=/path/to/project/.env

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now discord-user-bot
```

---

## 💬 6. How to Use `/send`

Once installed to your account and the bot is online:

1. Go to **any Discord server channel**, **Group DM**, or **Direct Message**.
2. Type `/send` and press Enter or select it from the slash command menu.
3. Fill in the options:
   - `message` *(required)*: The text you want the bot to send.
   - `channel` *(optional)*: A target channel (defaults to the current chat context).
4. Send the command.

### How it behaves:
- **In any server where the bot is NOT a server member (Standard User Install):**
  - The application delivers the message into the channel using Discord's interaction response mechanism.
  - The message appears from your application.
  - You receive an **ephemeral confirmation** (`✅ Success: Message sent successfully via application interaction.`) visible only to you.
- **In servers where the bot is also present with standard channel access:**
  - The application sends a standalone channel message.
  - You receive an **ephemeral confirmation** (`✅ Success: Message sent successfully.`).
- **If a different channel is specified:**
  - The application attempts to deliver to that channel (requires bot access to that channel).
  - You receive an ephemeral success or error notification explaining permissions.

---

## 🛡️ 7. Authorization Management

The bot includes a strict authorization middleware:
- **Default:** Only `OWNER_ID` can invoke commands.
- **Unauthorized users:** Any other user who runs a command receives an ephemeral `🚫 Access Denied: You are not authorized to execute commands on this private application.` and the attempt is logged with a security alert.
- **Expandability:** The owner can authorize additional trusted Discord User IDs via the included management CLI.

### Managing Authorized Users via CLI:

**List all authorized users:**
```bash
npm run auth:list
```

**Authorize a trusted user ID:**
```bash
npm run auth:add 123456789012345678 "Trusted Friend"
```

**Revoke a user ID:**
```bash
npm run auth:remove 123456789012345678
```

---

## 🧱 8. Modular Architecture & Future Expandability

The application follows clean separation of concerns:
- **`commands/`**: Add new slash commands here (e.g. reminders, utilities, notes). Each command can define its own context and options.
- **`events/`**: Add Gateway event listeners (e.g. rate limit alerts, message tracking).
- **`handlers/`**: Automatically loads commands and events without needing manual imports.
- **`config/`**: Centralized configuration and strict environment variable validation.
- **`database/`**: Fully abstracted asynchronous interface for authorization data; easily swappable with SQLite, PostgreSQL, or MongoDB without changing business logic.
- **`utils/`**: Shared helpers (Snowflake validation, structured logging).
