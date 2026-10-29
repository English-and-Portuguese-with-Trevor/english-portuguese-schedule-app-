import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import {
  askClaude,
  backToScene,
  classnotePrompt,
  classplanMessage,
  classplanPrompt,
  END_PROMPT,
  helperPrompt,
  homeworkMessage,
  homeworkPrompt,
  LEVELS,
  LIMITS,
  modelFor,
  parseClassPlan,
  parseGrade,
  parseHomework,
  parseVocab,
  POOL_FEATURES,
  questionMessage,
  splitTerms,
  questionsPrompt,
  SCENES,
  siteLanguageOf,
  START_PROMPT,
  STAY_WITH_LESSON,
  STORY_END,
  STORY_START,
  STORY_THEMES,
  storyPrompt,
  systemPrompt,
  turnCost,
  vocabPrompt,
  whyMessage,
  whyPrompt,
  writingMessage,
  writingPrompt,
  type Language,
} from "@/lib/ai";
import { checkAdmin } from "@/lib/auth/require-admin";
import { createServerJobClient } from "@/lib/integration-status";
import { siteFile } from "@/lib/site-files";
import { createClient } from "@/lib/supabase/server";

// The AI features (CLAUDE.md, "AI features"): the conversation partner, the
// lesson helper, the question coach, Trevor's vocab translator, and (from
// the tools pool) the writing coach, the story builder, "Why was this
// wrong?", the class-note tidy-up and the student hub's class write-up and
// homework drafts. The sites on
// englishandportuguesewithtrevor.com call this with the shared login cookie.
// The key lives only here (ANTHROPIC_API_KEY). Before every call: the
// student is logged in and not blocked, the kill switch is on, this month's
// spend is under the cap (the pool's features: the pool under its cap), and
// the student's turns are under the minute and daily caps; a conversation
// ends by itself after 40 turns or 3 declined requests. Every call, failed
// ones too, is a row in ai_turns.
const SITE_ORIGIN = "https://englishandportuguesewithtrevor.com";

const CORS = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

const Body = z.discriminatedUnion("feature", [
  z.object({
    feature: z.literal("partner"),
    conversation: z.uuid(),
    scene: z.string().max(40),
    level: z.enum(LEVELS),
    action: z.enum(["start", "say", "end"]),
    text: z.string().max(LIMITS.textChars).optional(),
  }),
  z.object({
    feature: z.literal("helper"),
    conversation: z.uuid(),
    lesson: z.string().min(1).max(80),
    action: z.literal("say"),
    text: z.string().max(LIMITS.textChars),
  }),
  z.object({
    feature: z.literal("questions"),
    conversation: z.uuid(),
    // The lesson id, or the Question words tool's id: shown to Trevor with the turn.
    scene: z.string().min(1).max(80),
    task: z.string().min(1).max(LIMITS.taskChars),
    action: z.literal("say"),
    text: z.string().max(LIMITS.textChars),
  }),
  z.object({
    feature: z.literal("vocab"),
    conversation: z.uuid(),
    // The lesson's title: shown to Trevor with the turn.
    scene: z.string().min(1).max(80),
    from: z.enum(["en", "pt"]),
    action: z.literal("say"),
    text: z.string().max(LIMITS.vocabChars),
  }),
  z.object({
    feature: z.literal("writing"),
    conversation: z.uuid(),
    // The lesson id, or the Writing tool's id.
    scene: z.string().min(1).max(80),
    task: z.string().min(1).max(LIMITS.taskChars),
    action: z.literal("say"),
    text: z.string().max(LIMITS.writingChars),
  }),
  z.object({
    feature: z.literal("story"),
    conversation: z.uuid(),
    scene: z.string().max(40),
    level: z.enum(LEVELS),
    action: z.enum(["start", "say", "end"]),
    text: z.string().max(LIMITS.textChars).optional(),
  }),
  z.object({
    feature: z.literal("why"),
    conversation: z.uuid(),
    // The lesson id.
    scene: z.string().min(1).max(80),
    question: z.string().min(1).max(LIMITS.whyChars),
    options: z.array(z.string().max(300)).min(2).max(8),
    picked: z.string().min(1).max(300),
    correct: z.string().min(1).max(300),
  }),
  z.object({
    feature: z.literal("classnote"),
    conversation: z.uuid(),
    // The booking's id.
    scene: z.string().min(1).max(80),
    action: z.literal("say"),
    text: z.string().max(LIMITS.classnoteChars),
  }),
  z.object({
    feature: z.literal("classplan"),
    conversation: z.uuid(),
    // The booking's id.
    scene: z.string().min(1).max(80),
    action: z.literal("say"),
    text: z.string().max(LIMITS.classnoteChars),
    // What the hub knows about the student, plain text.
    context: z.string().max(LIMITS.contextChars).optional(),
  }),
  z.object({
    feature: z.literal("homework"),
    conversation: z.uuid(),
    // The student's id.
    scene: z.string().min(1).max(80),
    focus: z.string().max(LIMITS.taskChars).optional(),
    context: z.string().min(1).max(LIMITS.contextChars),
  }),
]);

// Only Trevor: the class-note tidy-up and the student hub's two features for
// good, the vocab translator until he approves it for students (landing
// repo's CLAUDE.md, "Students see only what Trevor approves"; the writing
// coach, story builder and "why" were approved 2026-10-18).
const ADMIN_ONLY = new Set(["vocab", "classnote", "classplan", "homework"]);
const POOL = new Set<string>(POOL_FEATURES);

type Limits = { month_cost: number; pool_cost: number; period_cost?: number; day_turns: number; minute_turns: number; conversation_turns: number; off_topic_turns: number };
type FreeLesson = { title: string; learning: string; text: string };


const hasLessonAccess = (profile: { role: string; lesson_access: string }) =>
  profile.role === "admin" || ["granted", "subscriber", "lifetime"].includes(profile.lesson_access);

/** The client shows these in the site language; the words aren't ours to pick here. */
function refuse(code: string, status: number) {
  return Response.json({ error: code }, { status, headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== SITE_ORIGIN) return refuse("origin", 403);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return refuse("signed-out", 401);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refuse("bad", 400);
  const body = parsed.data;
  if (ADMIN_ONLY.has(body.feature) && !(await checkAdmin(supabase)).ok) return refuse("blocked", 403);
  const text = ("text" in body ? body.text?.trim() : "") ?? "";
  if ("action" in body && body.action === "say" && !text) return refuse("bad", 400);

  const db = createServerJobClient();
  const [{ data: profile }, { data: settings }, { data: limitsData }] = await Promise.all([
    db.from("profiles").select("ai_blocked, learning_language, role, lesson_access, site_language").eq("id", user.id).single(),
    db.from("ai_settings").select("enabled, monthly_cap, tools_cap, daily_turns").eq("id", true).single(),
    db.rpc("ai_limits", { p_user: user.id, p_conversation: body.conversation }),
  ]);
  if (!profile || profile.ai_blocked) return refuse("blocked", 403);
  const site = siteLanguageOf(profile.site_language);

  // An explanation already given for this check, pick and language costs nothing again.
  if (body.feature === "why") {
    const { data: earlier } = await db
      .from("ai_turns")
      .select("reply")
      .eq("feature", "why")
      .eq("scene", body.scene)
      .eq("student", whyMessage(body.question, body.options, body.picked, body.correct, site))
      .neq("reply", "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (earlier?.reply) return Response.json({ reply: earlier.reply }, { headers: CORS });
  }
  // Both read as "off" to the student; the reason goes to the function logs (Vercel > Logs).
  if (!settings) {
    console.error("[api/ai] ai_settings is unreadable: is SUPABASE_SERVICE_ROLE_KEY set and the ai_turns migration run?");
    return refuse("off", 403);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[api/ai] ANTHROPIC_API_KEY is not set for this deployment");
    return refuse("off", 403);
  }
  if (!settings.enabled) return refuse("off", 403);
  const limits = limitsData as Limits | null;
  if (!limits) return refuse("failed", 500);
  if (POOL.has(body.feature)) {
    if (Number(limits.pool_cost) >= Number(settings.tools_cap)) return refuse("budget", 403);
  } else if (Number(limits.month_cost) >= Number(settings.monthly_cap)) return refuse("budget", 403);
  if (limits.minute_turns >= LIMITS.minuteTurns) return refuse("slow", 429);
  if (limits.day_turns >= settings.daily_turns) return refuse("daily", 429);
  const turnCap = body.feature === "questions" || body.feature === "writing" ? LIMITS.questionTries : LIMITS.conversationTurns;
  if (limits.conversation_turns >= turnCap || limits.off_topic_turns >= LIMITS.offTopicTurns) return refuse("ended", 409);

  // What this feature tells the model, and what it says when the safety check stops a reply.
  let system: string | Anthropic.TextBlockParam[];
  let fallback: string;
  let maxTokens = LIMITS.maxTokens;
  let scene: string;
  let said = text;
  let open = START_PROMPT;
  let close = END_PROMPT;
  if (body.feature === "partner") {
    // profiles.learning_language holds "English" or "Portuguese" (the sites' "I'm learning"), Portuguese when unset.
    const language: Language = profile.learning_language === "English" ? "en" : "pt";
    if (!SCENES[language][body.scene]) return refuse("bad", 400);
    system = systemPrompt(language, body.level, body.scene);
    fallback = backToScene(language);
    scene = body.scene;
  } else if (body.feature === "helper") {
    const free = (await siteFile<Record<string, FreeLesson>>("free-lessons"))?.[body.lesson];
    let lesson: { title: string | null; text: string };
    if (free) lesson = { title: free.title, text: free.text };
    else {
      if (!hasLessonAccess(profile)) return refuse("access", 403);
      const { data: row } = await db.from("lesson_content").select("text").eq("id", body.lesson).maybeSingle();
      if (!row?.text) return refuse("bad", 400);
      lesson = { title: null, text: row.text };
    }
    // The lesson is the long, repeated part: cached between a conversation's turns.
    system = [{ type: "text", text: helperPrompt(lesson.title, lesson.text, site), cache_control: { type: "ephemeral" } }];
    fallback = STAY_WITH_LESSON[site];
    maxTokens = LIMITS.helperMaxTokens;
    scene = body.lesson;
  } else if (body.feature === "vocab") {
    system = vocabPrompt(body.from);
    fallback = "";
    maxTokens = LIMITS.vocabMaxTokens;
    scene = body.scene;
    said = splitTerms(text);
  } else if (body.feature === "questions") {
    system = questionsPrompt(site, limits.conversation_turns + 1 >= LIMITS.questionTries);
    fallback = STAY_WITH_LESSON[site];
    scene = body.scene;
    // Saved with its task, so the history and Trevor's AI tab read it whole.
    said = questionMessage(body.task.trim(), text);
  } else if (body.feature === "writing") {
    system = writingPrompt(site, limits.conversation_turns + 1 >= LIMITS.questionTries);
    fallback = STAY_WITH_LESSON[site];
    maxTokens = LIMITS.writingMaxTokens;
    scene = body.scene;
    said = writingMessage(body.task.trim(), text);
  } else if (body.feature === "story") {
    if (!STORY_THEMES[body.scene]) return refuse("bad", 400);
    system = storyPrompt(body.level, body.scene);
    fallback = backToScene("pt");
    maxTokens = LIMITS.storyMaxTokens;
    scene = body.scene;
    open = STORY_START;
    close = STORY_END;
  } else if (body.feature === "why") {
    system = whyPrompt(site);
    fallback = STAY_WITH_LESSON[site];
    maxTokens = LIMITS.whyMaxTokens;
    scene = body.scene;
    said = whyMessage(body.question, body.options, body.picked, body.correct, site);
  } else if (body.feature === "classplan") {
    system = classplanPrompt();
    fallback = "";
    maxTokens = LIMITS.classplanMaxTokens;
    scene = body.scene;
    said = classplanMessage(text, body.context);
  } else if (body.feature === "homework") {
    system = homeworkPrompt();
    fallback = "";
    maxTokens = LIMITS.homeworkMaxTokens;
    scene = body.scene;
    said = homeworkMessage(body.focus, body.context);
  } else {
    system = classnotePrompt();
    fallback = "";
    maxTokens = LIMITS.classnoteMaxTokens;
    scene = body.scene;
  }
  const action = "action" in body ? body.action : "say";
  const model = modelFor(limits.period_cost);

  // The history comes from our own rows, never from the client.
  const { data: earlier } = await db
    .from("ai_turns")
    .select("student, reply")
    .eq("user_id", user.id)
    .eq("conversation_id", body.conversation)
    .order("created_at", { ascending: false })
    .limit(LIMITS.historyTurns);
  const prompt = action === "start" ? open : action === "end" ? close : said;
  const messages: Anthropic.MessageParam[] = [];
  for (const turn of (earlier ?? []).reverse()) {
    messages.push({ role: "user", content: turn.student === "(start)" ? open : turn.student === "(end)" ? close : turn.student });
    if (turn.reply) messages.push({ role: "assistant", content: turn.reply });
  }
  messages.push({ role: "user", content: prompt });

  const row = {
    user_id: user.id,
    feature: body.feature,
    conversation_id: body.conversation,
    scene,
    student: action === "say" ? said : `(${action})`,
    model,
  };
  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 30_000 });
    const answer = await askClaude(client, system, messages, maxTokens, model);
    const refused = answer.stopReason === "refusal";
    const reply = refused || !answer.reply ? fallback : answer.reply;
    const offTopic = refused || answer.offTopic;
    const { error } = await db.from("ai_turns").insert({
      ...row,
      reply,
      off_topic: offTopic,
      input_tokens: answer.usage.input_tokens,
      cached_tokens: answer.usage.cache_read_input_tokens ?? 0,
      output_tokens: answer.usage.output_tokens,
      cost: turnCost(model, answer.usage),
      stop_reason: answer.stopReason,
    });
    // The reply is already paid for; a missing ledger row goes to the logs.
    if (error) console.error("[api/ai] ledger insert failed:", error.message);
    const ended =
      action === "end" ||
      limits.conversation_turns + 1 >= turnCap ||
      limits.off_topic_turns + (offTopic ? 1 : 0) >= LIMITS.offTopicTurns;
    if (body.feature === "vocab") return Response.json({ items: parseVocab(reply) }, { headers: CORS });
    if (body.feature === "classplan") {
      const plan = parseClassPlan(reply);
      return Response.json({ reply: plan.note, homework: plan.homework }, { headers: CORS });
    }
    if (body.feature === "homework") return Response.json({ items: parseHomework(reply) }, { headers: CORS });
    if (body.feature === "writing") {
      const graded = parseGrade(reply);
      return Response.json({ reply: graded.reply, grade: graded.grade, ended }, { headers: CORS });
    }
    return Response.json({ reply, ended }, { headers: CORS });
  } catch (error) {
    console.error("[api/ai] failed:", error);
    // Counted like a turn, so a failing call can't be hammered either.
    await db.from("ai_turns").insert({ ...row, reply: "", stop_reason: "error" });
    return refuse("failed", 502);
  }
}
