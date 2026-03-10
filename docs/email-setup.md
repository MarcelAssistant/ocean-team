# Setting up Email

Connect ZEUS to your email so your assistant can read, summarize, and send emails for you.

---

## What you need

You'll need IMAP and SMTP credentials for your email account. Here's how to get them for common providers:

### Gmail
1. Go to https://myaccount.google.com/apppasswords
2. Generate an **App Password** (you need 2-factor auth enabled)
3. Use these settings:
   - IMAP Host: `imap.gmail.com` / Port: `993`
   - SMTP Host: `smtp.gmail.com` / Port: `587`
   - Username: your full email (e.g. `you@gmail.com`)
   - Password: the App Password you generated

### Outlook / Microsoft 365
- IMAP Host: `outlook.office365.com` / Port: `993`
- SMTP Host: `smtp.office365.com` / Port: `587`
- Username: your full email
- Password: your account password (or App Password if 2FA is on)

### Yahoo
1. Go to Account Security > Generate App Password
2. Settings:
   - IMAP Host: `imap.mail.yahoo.com` / Port: `993`
   - SMTP Host: `smtp.mail.yahoo.com` / Port: `587`

### Custom / Company email
Ask your IT team for:
- IMAP server address and port
- SMTP server address and port
- Your email username and password

---

## Setup in ZEUS

1. Go to **Settings** > **Connections** tab
2. Scroll to the **Email** section
3. Fill in **IMAP** (incoming) settings:
   - Host, Port, Username, Password
   - Click **Test** to verify the connection
4. Fill in **SMTP** (outgoing) settings:
   - Host, Port, Username, Password
   - From Name (e.g. "Marcel")
   - From Address (your email)
   - Click **Test** to verify
5. Click **Save Email Settings**

---

## What ZEUS can do with email

### Read emails
Ask your assistant:
- *"Check my inbox"*
- *"Do I have any new emails?"*
- *"Summarize my unread emails"*

Emails are synced automatically every 15 minutes.

### Send emails
Ask your assistant:
- *"Send an email to john@example.com about the meeting tomorrow"*
- *"Email Sarah the project update"*

### Parse attachments
When emails have PDF or Excel attachments, ZEUS can extract and summarize the content.

### Email to calendar
Ask: *"Check my email and add any meetings to my calendar"*

---

## Troubleshooting

**IMAP test fails:**
- Double-check the host and port
- For Gmail: make sure you're using an App Password, not your regular password
- Some providers require you to enable "Less secure app access" or IMAP access in settings

**SMTP test fails:**
- Try port 587 (TLS) or port 465 (SSL)
- Make sure your email provider allows SMTP access

**Emails not syncing:**
- Check **Settings > Agents > System** to verify the email_sync task is active
- Check **Settings > Logs** for error messages

---

## Security note

Your email credentials are stored on your VM only. They are never sent anywhere except to your email provider's servers for authentication.
