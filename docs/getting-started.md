# ZEUS — Getting Started

## What is ZEUS?

ZEUS is your personal AI assistant that runs on your own server. It manages tasks, reminders, calendars, emails, and more — all through a simple chat interface. Your data stays on your machine.

---

## First-time setup

### 1. Open ZEUS

Go to the URL you received (e.g. `http://192.168.1.100:3000`) in any browser.

### 2. Onboarding wizard

You'll be guided through 4 steps:

1. **Your name** — What should the assistant call you?
2. **Assistant name** — Name your assistant (Zeus, Jarvis, Ada...)
3. **Personality** — Optional. Describe how your assistant should behave ("Professional but friendly, concise")
4. **Location** — Your city (for weather) and timezone (for reminders)
5. **VM IP** — The server address (already filled if you used the link)
6. **Password** — Choose a password to protect your dashboard

### 3. Add your OpenAI API key

After onboarding:
1. Click **Settings** in the left sidebar
2. Under **Connections > OpenAI**, paste your API key
3. Click **Save All**
4. Click **Test Connection** to verify

> Get an API key at https://platform.openai.com/api-keys

---

## Daily use

### Chat (Home page)

This is your main interface. Talk to your assistant naturally:

- *"Add a task: buy groceries by Friday"*
- *"Remind me to call the doctor at 3pm"*
- *"What's on my calendar this week?"*
- *"Summarize this document"* (attach a file)

### Tasks

View all your tasks sorted by priority and due date. You can:
- Click the circle to mark a task as done
- Click **+ Add task** to create one manually
- Filter by: Active, All, Done, Failed

### Calendar

Week view of your events. You can:
- Click **+ Event** to add one manually
- Navigate weeks with the arrow buttons
- Ask your assistant: *"Add a meeting with John on Thursday at 2pm"*

### Notes

A pinboard for things you want to remember:
- Wifi passwords, school hours, important numbers
- Pin important notes to the top
- Ask your assistant: *"Save a note: the gate code is 4521"*

### Automations

Set up recurring workflows:
- *"Summarize my unread emails every morning"*
- Click **+ New** and fill in: What, Systems, Frequency, Data source, Delivery

### Modules

Install add-ons for specific needs:
- **Finance** — Expense tracking, budgets
- **Travel** — Trip planning, itineraries
- **School** — Homework, grades, schedules
- **Health** — Medications, appointments, metrics

Click **Install**, fill in any required settings, and the module is ready.

---

## File attachments

Click the 📎 paperclip button in the chat to attach a file.

**Supported formats:**
- PDF — text extracted automatically
- Excel (.xlsx, .xls) — sheets converted to readable data
- CSV, TXT, MD, JSON — read directly

**What happens:**
1. File is uploaded to your workspace
2. Content is extracted and sent to your assistant
3. Assistant summarizes the key information
4. Summary is saved to memory for future reference

**Limits:** 5MB per file, 1GB total storage.

---

## Reminders

Set reminders through chat:
- *"Remind me to submit the report tomorrow at 9am"*
- *"Set a weekly reminder every Monday to review tasks"*

Recurring options: daily, weekly, monthly.

When a reminder is due, you'll see a notification (bell icon in the top bar).

---

## Notifications

The bell icon in the top bar shows your notifications:
- Reminders that are due
- Completed tasks
- Cost warnings
- Daily summaries

Click a notification to mark it as read. Click **Mark all read** to clear them.

---

## Search

Use the search bar in the top bar to find anything:
- Tasks, calendar events, notes, memories, conversations
- Type at least 2 characters and press Enter

---

## Settings

### Connections
- **OpenAI** — API key and model selection
- **Telegram** — Bot token (see Telegram guide below)
- **Email** — IMAP/SMTP configuration

### Agents
Your AI team. The main ones:
- **Your assistant** (Orchestrator) — handles everything you ask
- **Research Agent** — specialized in analysis and summarization
- **System** — runs health checks and maintenance

### Skills
What your agents can do. Most are built-in. New skills are added when you install modules.

### Logs
System activity log. Useful for troubleshooting.

### Access
- **Location & timezone** — for weather and time-based features
- **Remote access** — your VM IP and access URL
- **Password** — change your login password

---

## Backup & Export

Your data is automatically backed up daily (last 7 days kept).

To export all your data as JSON, visit: `http://your-vm:3000/api/export`

---

## Cost control

ZEUS tracks your OpenAI API usage. Default monthly limit is $10.

You'll get a notification when you reach 80% of your limit.

To change the limit: **Settings > Connections > OpenAI** (the limit is managed via the API).

---

## Support

Click the **?** icon at the bottom of the sidebar to:
- Read the help guide
- Submit a support ticket

Tickets are sent to support.zeus@zephyre.com when email is configured.
