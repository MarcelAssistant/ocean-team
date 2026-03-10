# Setting up a Telegram Bot

Connect ZEUS to Telegram so you can chat with your assistant from your phone.

---

## Step 1: Create a bot on Telegram

1. Open Telegram on your phone or desktop
2. Search for **@BotFather** (the official Telegram bot creator)
3. Start a conversation and send: `/newbot`
4. BotFather will ask for a **name** — this is the display name (e.g. "My Zeus Assistant")
5. Then it asks for a **username** — this must end in `bot` (e.g. `marcel_zeus_bot`)
6. BotFather will reply with your **bot token** — it looks like this:
   ```
   7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
7. **Copy this token** — you'll need it in the next step

> Keep your bot token secret. Anyone with the token can control your bot.

---

## Step 2: Add the token in ZEUS

1. Open your ZEUS dashboard
2. Go to **Settings** (gear icon in the left sidebar)
3. Under **Connections > Telegram**, paste your bot token
4. Click **Save All**
5. Click **Start Bot**
6. You should see a green dot and your bot's username (e.g. `@marcel_zeus_bot`)

---

## Step 3: Pair a Telegram chat with an agent

1. Go to **Settings > Agents** tab
2. Click on the agent you want to connect (e.g. your main assistant)
3. Go to the **Telegram** tab
4. Click **Generate Pairing Code**
5. You'll see a 6-character code (e.g. `A3F7B2`)
6. Open your Telegram bot (search for `@marcel_zeus_bot`)
7. Send: `/pair A3F7B2`
8. The bot will confirm: *"Paired successfully!"*

From now on, any message you send to the bot goes to that agent, and the response comes back in Telegram.

---

## Bot commands

Once paired, you can use these commands in Telegram:

| Command | What it does |
|---------|-------------|
| `/start` | Welcome message and instructions |
| `/pair CODE` | Link this chat to an agent |
| `/status` | Show which agent is connected |
| `/unpair` | Disconnect from the agent |
| `/newchat` | Start a fresh conversation thread |

For everything else, just type normally — your message goes to the agent.

---

## Tips

- **One chat, one agent**: Each Telegram chat (or group) can be paired to one agent at a time
- **Multiple chats**: You can pair different Telegram chats to different agents
- **Group chats**: You can add the bot to a Telegram group — all messages in the group go to the paired agent
- **Long messages**: If the agent's response is very long, it's automatically split into multiple Telegram messages
- **The bot stays on**: As long as ZEUS is running, the bot is active. It auto-starts on reboot

---

## Troubleshooting

**Bot doesn't respond:**
- Check that the bot is running: **Settings > Telegram** should show a green dot
- Click **Stop** then **Start Bot** again
- Make sure the chat is paired: send `/status` to the bot

**"Invalid pairing code":**
- Codes expire after 10 minutes. Generate a new one from the ZEUS dashboard

**Bot token error:**
- Make sure you copied the full token from BotFather (including the numbers before the colon)
- The token should look like: `7123456789:AAH...`

**Bot doesn't start:**
- Verify the token is correct
- Check the logs in **Settings > Logs** for error messages

---

## Privacy

- All messages between Telegram and ZEUS go through Telegram's servers, then to your VM
- Message history is stored on your VM only
- Telegram sees the messages (as with any Telegram bot) — don't send highly sensitive data through it
- The bot token gives access to the bot only, not to your Telegram account
