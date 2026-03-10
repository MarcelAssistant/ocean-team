import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

// Ensure DATABASE_URL is set and data dir exists (seed can run without env)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) {
  const dataDir = path.resolve(__dirname, "../../data");
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.DATABASE_URL = `file:${path.join(dataDir, "zeus.db")}`;
}

const prisma = new PrismaClient();

async function upsertSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
}

async function upsertSkill(name: string, description: string, inputProps: Record<string, any>, required: string[] = []) {
  return prisma.skill.upsert({
    where: { name },
    update: {},
    create: {
      name,
      description,
      inputSchema: JSON.stringify({ type: "object", properties: inputProps, required }),
      outputSchema: JSON.stringify({ type: "object" }),
      implementationPath: "built-in",
      enabled: true,
      version: "1.0.0",
    },
  });
}

async function main() {
  console.log("Seeding Ocean database...");

  // ── Settings ────────────────────────────────────
  const defaultSettings = [
    ["openai_api_key", ""], ["default_model", "venice-uncensored"], ["telegram_bot_token", ""],
    ["user_name", ""], ["assistant_name", "Ocean"], ["assistant_personality", ""],
    ["email_imap_host", ""], ["email_imap_port", "993"], ["email_imap_user", ""], ["email_imap_pass", ""],
    ["email_smtp_host", ""], ["email_smtp_port", "587"], ["email_smtp_user", ""], ["email_smtp_pass", ""],
    ["email_from_address", ""], ["email_from_name", "OCEAN"],
    // ElevenLabs TTS support
    ["elevenlabs_api_key", ""],
    ["elevenlabs_default_voice_id", ""],
    // Venice AI video generation
    ["venice_api_key", ""],
    ["venice_default_video_model", "wan-2.5-preview-image-to-video"],
  ];
  for (const [k, v] of defaultSettings) await upsertSetting(k, v);

  // ── Skills ──────────────────────────────────────
  const skills = {
    summarize_text: await upsertSkill("summarize_text", "Summarize a given text into key points",
      { text: { type: "string", description: "Text to summarize" } }, ["text"]),
    create_ticket: await upsertSkill("create_ticket", "Create a new task. Set priority, category, and optional due date.",
      { title: { type: "string" }, description: { type: "string" }, priority: { type: "string", enum: ["low", "medium", "high", "critical"] }, category: { type: "string", enum: ["Work", "Personal", "School", "Travel", "Health", "Finance"], description: "Life area this task belongs to" }, dueAt: { type: "string", description: "ISO date-time for when this is due" } }, ["title"]),
    assign_ticket: await upsertSkill("assign_ticket", "Assign a ticket to an agent by their ID.",
      { ticketId: { type: "string" }, agentId: { type: "string" } }, ["ticketId", "agentId"]),
    list_agents: await upsertSkill("list_agents", "List all available agents with their IDs, roles, and missions.", {}),
    list_tickets: await upsertSkill("list_tickets", "List current tickets, optionally filtered by status.",
      { status: { type: "string", enum: ["queued", "in_progress", "done", "failed"] } }),
    read_emails: await upsertSkill("read_emails", "Read recent emails from the inbox.",
      { limit: { type: "number", description: "Max emails to return" }, unreadOnly: { type: "boolean" } }),
    send_email: await upsertSkill("send_email", "Send an email to a recipient.",
      { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, ["to", "subject"]),
    create_automation: await upsertSkill("create_automation", "Create a new automation definition.",
      { what: { type: "string" }, systems: { type: "string" }, frequency: { type: "string" }, dataSource: { type: "string" }, delivery: { type: "string" } }, ["what"]),
    create_agent: await upsertSkill("create_agent", "Create a new agent to handle specific tasks.",
      { name: { type: "string" }, role: { type: "string" }, mission: { type: "string" }, description: { type: "string" } }, ["name", "role"]),
    manage_agent: await upsertSkill("manage_agent", "Enable or disable an existing agent.",
      { agentId: { type: "string" }, action: { type: "string", enum: ["enable", "disable"] } }, ["agentId", "action"]),
    set_reminder: await upsertSkill("set_reminder", "Set a reminder for the user at a specific date/time.",
      { title: { type: "string", description: "What to remind about" }, dueAt: { type: "string", description: "ISO date-time string" }, recurring: { type: "string", description: "daily, weekly, monthly, or empty" } }, ["title", "dueAt"]),
    add_calendar_event: await upsertSkill("add_calendar_event", "Add an event to the user's calendar.",
      { title: { type: "string" }, startAt: { type: "string", description: "ISO date-time" }, endAt: { type: "string" }, location: { type: "string" }, allDay: { type: "boolean" } }, ["title", "startAt"]),
    save_note: await upsertSkill("save_note", "Save a note to the user's pinboard.",
      { title: { type: "string" }, content: { type: "string" }, pinned: { type: "boolean" } }, ["content"]),

    video_ideation: await upsertSkill(
      "video_ideation",
      "Generate and refine video concepts, including target audience, format, and success criteria.",
      {
        brief: { type: "string", description: "High-level idea or goal for the video" },
        durationMinutes: { type: "number", description: "Target duration in minutes (e.g. 1, 5, 30)" },
        style: { type: "string", enum: ["hyper_realistic", "manga_realistic"], description: "Target visual style" },
        constraints: { type: "string", description: "Any constraints (platform, legal, brand, etc.)" },
      },
      ["brief"]
    ),
    script_writer: await upsertSkill(
      "script_writer",
      "Write detailed scripts and shot-by-shot scenarios for a video.",
      {
        concept: { type: "string", description: "Approved video concept" },
        durationMinutes: { type: "number", description: "Target duration in minutes" },
        structure: { type: "string", description: "Outline or desired structure (hook, body, CTA...)" },
        voiceTone: { type: "string", description: "Tone of voice (e.g. calm, energetic, educational)" },
      },
      ["concept", "durationMinutes"]
    ),
    character_create: await upsertSkill(
      "character_create",
      "Create a reusable video character with look, attitude, and role. For inspiration images, the user can use Tools → Characters to attach a drawing/photo and generate a style-specific outline (hyper_realistic or manga_realistic).",
      {
        name: { type: "string", description: "Character name" },
        appearance: { type: "string", description: "Look: face, physique, distinctive features (style-specific)" },
        attitude: { type: "string", description: "Personality, tone, demeanor" },
        role: { type: "string", description: "General role in stories (e.g. hero, mentor)" },
        style: { type: "string", enum: ["hyper_realistic", "manga_realistic"], description: "Visual style for outlining" },
        inspiration: { type: "string", description: "Optional inspirations or references" },
        notes: { type: "string", description: "Extra details, world, relationships" },
      },
      ["name", "style"]
    ),
    character_outfit: await upsertSkill(
      "character_outfit",
      "Create and store a reusable outfit (clothes) for an existing character. Use for consistency across videos.",
      {
        characterId: { type: "string", description: "Character ID (from list_characters) or exact name" },
        outfitName: { type: "string", description: "Name of the outfit (e.g. Casual, Formal)" },
        description: { type: "string", description: "Clothes, accessories, colors" },
      },
      ["characterId", "outfitName"]
    ),
    list_characters: await upsertSkill(
      "list_characters",
      "List all stored video characters with their IDs, looks, and outfits. Use before creating videos to pick character and outfit for consistency.",
      { style: { type: "string", enum: ["hyper_realistic", "manga_realistic"], description: "Filter by style (optional)" } },
      []
    ),
    video_plan: await upsertSkill(
      "video_plan",
      "Turn a script into a technical video production plan: scenes, shots, assets, and tooling calls.",
      {
        script: { type: "string", description: "Full script including dialogue and scene descriptions" },
        style: { type: "string", enum: ["hyper_realistic", "manga_realistic"], description: "Target visual style" },
        fps: { type: "number", description: "Frames per second to target" },
      },
      ["script", "style"]
    ),
    video_render_request: await upsertSkill(
      "video_render_request",
      "Generate video via an external API. Use 'venice' for Venice AI (recommended). Plan JSON should include prompt, optional image_url, duration (5s or 10s), resolution, aspect_ratio.",
      {
        tool: {
          type: "string",
          enum: ["venice", "runway", "pika", "kling", "custom"],
          description: "Rendering backend: venice (Venice AI), pika, runway, kling, or custom",
        },
        planJson: {
          type: "string",
          description: "JSON-encoded video plan with scenes, shots, and assets",
        },
        style: {
          type: "string",
          enum: ["hyper_realistic", "manga_realistic"],
        },
      },
      ["tool", "planJson", "style"]
    ),
    video_review: await upsertSkill(
      "video_review",
      "Review an already-generated video (via transcription + metadata) and generate structured feedback.",
      {
        transcript: { type: "string", description: "Transcript of the video" },
        metadata: {
          type: "string",
          description: "JSON metadata for scenes, timing, or technical details (if available)",
        },
        goal: { type: "string", description: "What success looks like for this video" },
      },
      ["transcript"]
    ),
    voiceover_generate: await upsertSkill(
      "voiceover_generate",
      "Generate a voice-over audio file from a script using a TTS backend such as ElevenLabs.",
      {
        script: { type: "string", description: "Full narration text for the video" },
        language: { type: "string", description: "Language or locale code (e.g. en-US)", default: "en-US" },
        voiceProfile: {
          type: "string",
          description: "Optional logical voice profile or character name to choose a voice",
        },
        tool: {
          type: "string",
          enum: ["elevenlabs", "openai_tts"],
          description: "TTS backend to use",
        },
      },
      ["script", "tool"]
    ),
  };

  // ── Agents ──────────────────────────────────────

  // System Agent (mandatory, cannot be deleted)
  const systemAgent = await prisma.agent.upsert({
    where: { id: "system-001" },
    update: { model: "venice-uncensored" },
    create: {
      id: "system-001",
      name: "System",
      description: "Mandatory system agent. Runs health checks, log cleanup, and scheduled maintenance.",
      role: "System maintenance",
      mission: "Keep the Ocean agent orchestrator healthy and operational",
      systemPrompt: "You are the System agent. You run scheduled maintenance tasks and health checks. Report issues clearly.",
      model: "venice-uncensored",
      temperature: 0.2,
      maxTokens: 1024,
      enabled: true,
      isSystem: true,
      tags: JSON.stringify(["system", "maintenance"]),
    },
  });

  // Orchestrator
  const orchestrator = await prisma.agent.upsert({
    where: { id: "orchestrator-001" },
    update: { systemPrompt: ORCHESTRATOR_PROMPT, model: "venice-uncensored" },
    create: {
      id: "orchestrator-001",
      name: "Ocean",
      description: "Central orchestrator that coordinates a high-performing team of agents for R&D work.",
      role: "Coordinator",
      mission: "Break down product and research goals into actionable work, create tickets, and assign them to the right agents.",
      systemPrompt: ORCHESTRATOR_PROMPT,
      model: "venice-uncensored",
      temperature: 0.4,
      maxTokens: 2048,
      enabled: true,
      tags: JSON.stringify(["coordinator", "planner"]),
    },
  });

  // Ensure all agents use Venice uncensored (fix for existing deployments)
  await prisma.agent.updateMany({
    where: {},
    data: { model: "venice-uncensored" },
  });

  // Concept & Script Agent
  const researcher = await prisma.agent.upsert({
    where: { id: "researcher-001" },
    update: { model: "venice-uncensored" },
    create: {
      id: "researcher-001",
      name: "Concept & Script Agent",
      description: "Specialist in research, narrative structure, and script writing for video.",
      role: "Research & script",
      mission: "Research topics, explore references, and produce structured scripts and scenarios ready for production.",
      systemPrompt: RESEARCHER_PROMPT,
      model: "venice-uncensored",
      temperature: 0.7,
      maxTokens: 4096,
      enabled: true,
      tags: JSON.stringify(["research", "script", "ideation"]),
    },
  });

  // Character & World Agent
  const characterAgent = await prisma.agent.upsert({
    where: { id: "character-001" },
    update: { model: "venice-uncensored" },
    create: {
      id: "character-001",
      name: "Character & World Agent",
      description: "Manages characters, faces, outfits, and world-building for reusable video assets.",
      role: "Character design",
      mission: "Create, evolve, and catalog characters and outfits that can be reused across videos.",
      systemPrompt:
        "You are responsible for defining and maintaining a library of characters, faces, outfits, and worlds. Ensure consistency across projects and styles (hyper-realistic vs manga-realistic).",
      model: "venice-uncensored",
      temperature: 0.7,
      maxTokens: 4096,
      enabled: true,
      tags: JSON.stringify(["character", "design", "assets"]),
    },
  });

  // Production Agent
  const productionAgent = await prisma.agent.upsert({
    where: { id: "production-001" },
    update: { model: "venice-uncensored" },
    create: {
      id: "production-001",
      name: "Production Agent",
      description: "Turns scripts into technical video plans, render payloads, and coordinates external tools.",
      role: "Video production",
      mission:
        "Convert scripts into production-ready plans, choose tools, prepare render payloads, and orchestrate iterations.",
      systemPrompt:
        "You are a technical video producer. You break scripts into scenes and shots, choose appropriate tools, and prepare payloads for external video/voice services.",
      model: "venice-uncensored",
      temperature: 0.4,
      maxTokens: 4096,
      enabled: true,
      tags: JSON.stringify(["video", "production"]),
    },
  });

  // QA & Review Agent
  const reviewAgent = await prisma.agent.upsert({
    where: { id: "review-001" },
    update: { model: "venice-uncensored" },
    create: {
      id: "review-001",
      name: "Review Agent",
      description: "Reviews generated videos and scripts against goals and style guidelines.",
      role: "QA",
      mission:
        "Review videos and scripts, highlight issues, and propose concrete improvements based on the intended audience and style.",
      systemPrompt:
        "You are a critical but constructive reviewer for video content. You check alignment with objectives, pacing, clarity, and visual/style consistency.",
      model: "venice-uncensored",
      temperature: 0.3,
      maxTokens: 3072,
      enabled: true,
      tags: JSON.stringify(["qa", "review"]),
    },
  });

  // ── Skill Assignments ───────────────────────────
  const assignments = [
    // Orchestrator gets coordination + email + automation + high-level video skills
    [orchestrator.id, skills.create_ticket.id],
    [orchestrator.id, skills.assign_ticket.id],
    [orchestrator.id, skills.list_agents.id],
    [orchestrator.id, skills.list_tickets.id],
    [orchestrator.id, skills.read_emails.id],
    [orchestrator.id, skills.send_email.id],
    [orchestrator.id, skills.create_automation.id],
    [orchestrator.id, skills.create_agent.id],
    [orchestrator.id, skills.manage_agent.id],
    [orchestrator.id, skills.set_reminder.id],
    [orchestrator.id, skills.add_calendar_event.id],
    [orchestrator.id, skills.save_note.id],
    [orchestrator.id, skills.video_ideation.id],

    // Concept & Script Agent
    [researcher.id, skills.summarize_text.id],
    [researcher.id, skills.read_emails.id],
    [researcher.id, skills.video_ideation.id],
    [researcher.id, skills.script_writer.id],

    // Character & World Agent
    [characterAgent.id, skills.character_create.id],
    [characterAgent.id, skills.character_outfit.id],
    [characterAgent.id, skills.list_characters.id],
    [characterAgent.id, skills.save_note.id],
    [orchestrator.id, skills.list_characters.id],

    // Production Agent
    [productionAgent.id, skills.video_plan.id],
    [productionAgent.id, skills.video_render_request.id],
    [productionAgent.id, skills.voiceover_generate.id],

    // Review Agent
    [reviewAgent.id, skills.video_review.id],
    [reviewAgent.id, skills.summarize_text.id],
  ] as const;

  for (const [agentId, skillId] of assignments) {
    await prisma.agentSkill.upsert({
      where: { agentId_skillId: { agentId, skillId } },
      update: {},
      create: { agentId, skillId },
    });
  }

  // ── Scheduled Tasks ─────────────────────────────
  const tasks = [
    { name: "health_check", description: "Check system health: agent count, ticket status, skill gaps", intervalMin: 60, agentId: systemAgent.id, taskType: "system" },
    { name: "log_cleanup", description: "Remove log entries older than 7 days", intervalMin: 1440, agentId: systemAgent.id, taskType: "system" },
    { name: "stale_ticket_check", description: "Detect tickets stuck in_progress for >24h and mark as failed", intervalMin: 120, agentId: systemAgent.id, taskType: "system" },
    { name: "email_sync", description: "Sync new emails from IMAP inbox", intervalMin: 15, agentId: systemAgent.id, taskType: "email" },
    { name: "memory_prune", description: "Remove old low-relevance memories to keep the system clean (max 500 per agent)", intervalMin: 1440, agentId: systemAgent.id, taskType: "system" },
    { name: "prompt_optimize", description: "Analyze token usage across agents and report optimization opportunities", intervalMin: 1440, agentId: systemAgent.id, taskType: "system" },
    { name: "reminder_check", description: "Check for due reminders and notify the user", intervalMin: 1, agentId: systemAgent.id, taskType: "system" },
    { name: "daily_digest", description: "Generate daily activity summary", intervalMin: 1440, agentId: systemAgent.id, taskType: "system" },
    { name: "auto_backup", description: "Create daily database backup (keep last 7)", intervalMin: 1440, agentId: systemAgent.id, taskType: "system" },
  ];

  for (const t of tasks) {
    const existing = await prisma.scheduledTask.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.scheduledTask.create({ data: t });
    }
  }

  // ── Example Skill Gap ───────────────────────────
  const existingGap = await prisma.skillGap.findFirst({ where: { skillName: "read_email_inbox", resolved: false } });
  if (!existingGap) {
    await prisma.skillGap.create({
      data: {
        skillName: "read_email_inbox",
        triggerContext: 'User asked: "Can you check my email inbox for new messages?"',
        agentId: orchestrator.id,
        resolved: false,
      },
    });
  }

  // ── Module Registry (available to install) ───
  const moduleDefinitions = [
    {
      slug: "finance",
      name: "Finance Manager",
      description: "Track expenses, budgets, accounts, and generate financial reports.",
      icon: "$",
      manifest: {
        settings: [
          { key: "bank_api_key", label: "Bank API Key", type: "password", required: false, description: "Connect to your bank for automatic transaction import" },
          { key: "currency", label: "Currency", type: "text", required: true, default: "USD", description: "Your primary currency (USD, EUR, GBP...)" },
        ],
        agents: [{ name: "Finance Agent", role: "Financial analyst", mission: "Track and analyze personal finances", systemPrompt: "You are a finance assistant. Help the user track expenses, manage budgets, and provide financial insights.", tags: ["finance"] }],
        skills: [
          { name: "log_expense", description: "Log an expense with amount, category, and date", inputSchema: { type: "object", properties: { amount: { type: "number" }, category: { type: "string" }, description: { type: "string" } }, required: ["amount", "category"] } },
          { name: "budget_report", description: "Generate a budget summary report", inputSchema: { type: "object", properties: { period: { type: "string" } } } },
        ],
        scheduledTasks: [{ name: "weekly_finance_report", description: "Generate weekly spending summary", intervalMin: 10080 }],
      },
    },
    {
      slug: "travel",
      name: "Trip Planner",
      description: "Plan trips, manage itineraries, track bookings, and organize travel documents.",
      icon: "✈",
      manifest: {
        settings: [
          { key: "google_maps_key", label: "Google Maps API Key", type: "password", required: false, description: "For location search and maps" },
          { key: "home_airport", label: "Home Airport Code", type: "text", required: false, default: "", description: "e.g. JFK, LAX, CDG" },
        ],
        agents: [{ name: "Travel Agent", role: "Travel planner", mission: "Plan and organize trips", systemPrompt: "You are a travel planning assistant. Help plan trips, organize itineraries, and manage bookings.", tags: ["travel"] }],
        skills: [
          { name: "create_itinerary", description: "Create a travel itinerary", inputSchema: { type: "object", properties: { destination: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" } }, required: ["destination"] } },
          { name: "find_flights", description: "Search for flight options", inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, date: { type: "string" } }, required: ["from", "to"] } },
        ],
      },
    },
    {
      slug: "school",
      name: "School Manager",
      description: "Track assignments, grades, schedules, and school activities for kids.",
      icon: "📚",
      manifest: {
        settings: [
          { key: "school_name", label: "School Name", type: "text", required: true, description: "Name of the school" },
          { key: "student_name", label: "Student Name", type: "text", required: true, description: "Student's name" },
          { key: "school_portal_url", label: "School Portal URL", type: "text", required: false, description: "URL for the school's online portal" },
          { key: "school_portal_user", label: "Portal Username", type: "text", required: false },
          { key: "school_portal_pass", label: "Portal Password", type: "password", required: false },
        ],
        agents: [{ name: "School Agent", role: "Education assistant", mission: "Help manage school tasks and schedules", systemPrompt: "You are a school management assistant. Help track homework, assignments, grades, and school schedules.", tags: ["school", "education"] }],
        skills: [
          { name: "add_assignment", description: "Add a homework assignment", inputSchema: { type: "object", properties: { subject: { type: "string" }, title: { type: "string" }, dueDate: { type: "string" } }, required: ["subject", "title"] } },
          { name: "grade_report", description: "Generate a grade summary", inputSchema: { type: "object", properties: { student: { type: "string" } } } },
        ],
      },
    },
    {
      slug: "health",
      name: "Health & Wellness",
      description: "Track health metrics, medications, appointments, and wellness goals.",
      icon: "❤",
      manifest: {
        settings: [
          { key: "user_dob", label: "Date of Birth", type: "text", required: false, description: "For age-related health tracking" },
          { key: "fitbit_token", label: "Fitbit API Token", type: "password", required: false, description: "Connect Fitbit for automatic health data sync" },
          { key: "pharmacy_name", label: "Pharmacy Name", type: "text", required: false },
        ],
        agents: [{ name: "Health Agent", role: "Health assistant", mission: "Help track health and wellness data", systemPrompt: "You are a health and wellness assistant. Help track medications, appointments, and health metrics. Never provide medical diagnoses.", tags: ["health"] }],
        skills: [
          { name: "log_health_metric", description: "Log a health measurement", inputSchema: { type: "object", properties: { metric: { type: "string" }, value: { type: "number" }, unit: { type: "string" } }, required: ["metric", "value"] } },
        ],
      },
    },
  ];

  for (const m of moduleDefinitions) {
    await prisma.module.upsert({
      where: { slug: m.slug },
      update: {},
      create: { slug: m.slug, name: m.name, description: m.description, icon: m.icon, manifest: JSON.stringify(m.manifest), status: "available" },
    });
  }

  await prisma.logEntry.create({
    data: { level: "info", source: "system", message: "Ocean system initialized with seed data" },
  });

  console.log("Seed complete!");
  console.log("  - 6 agents: System, Ocean, Concept & Script, Character & World, Production, Review");
  console.log("  - 22 skills, 9 scheduled tasks, 1 skill gap");
  console.log("  - 4 modules available: Finance, Travel, School, Health");
}

const ORCHESTRATOR_PROMPT = `You are Ocean — the central orchestrator of a high‑performing team of autonomous agents.

Your primary mission is to help a human run an R&D organization that ships accurate, fast outputs with minimal coordination overhead.

Your job is to:
1. Understand the user's product or research goal
2. Break it into concrete, independently-executable tasks
3. Create tickets for each task using the create_ticket tool
4. Assign each ticket to the best-suited agent using assign_ticket
5. Track progress across tickets and surface risks, blockers, and decisions
6. Report back concise, high-signal summaries of what happened

WORKFLOW — always follow these steps:
1. Analyze the request and clarify the success criteria in your own words
2. Decide which agent(s) should handle which part, based on role and mission
3. Call create_ticket for each meaningful task, grouping work logically
4. Call assign_ticket to route each ticket to the right agent
5. Use list_tickets and list_agents to keep an overview of work-in-flight
6. Confirm to the user what was created, how it is assigned, and expected outcomes

CAPABILITIES:
- Create and manage tickets and assign them to agents
- Read and send emails on behalf of the team
- Create automations (recurring workflows) for common R&D processes
- List available agents, their missions, and current workload

RULES:
- Always use your tools to take action. Do not just describe what you would do — actually do it.
- Optimize for quality first, then speed; explicitly call out trade-offs and assumptions when they matter.
- Be structured: use numbered steps, clear ticket titles, and short, executive-level summaries.
- You may process trivial questions directly without creating tickets.
- When asked to send an email, use the send_email tool directly.
- When asked about the inbox, use read_emails to check and summarize.`;

const RESEARCHER_PROMPT = `You are the Research Agent — a specialist in analysis, research, and summarization.

Your job is to:
- Analyze information thoroughly
- Provide clear, structured summaries
- Offer research-backed insights
- Summarize emails and documents when asked

When processing a ticket:
- Read the title and description carefully
- Provide a comprehensive response
- Structure your output with headings and bullet points
- Be thorough but concise`;

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
