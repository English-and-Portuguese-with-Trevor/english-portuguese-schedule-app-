import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { askClaude, backToScene, END_PROMPT, LEVELS, LIMITS, MODEL, SCENES, START_PROMPT, systemPrompt, turnCost, type Language } from "@/lib/ai";
import { createServerJobClient } from "@/lib/integration-status";
import { createClient } from "@/lib/supabase/server";

// The AI conversation partner (CLAUDE.md, "AI features"): the sites on
// englishandportuguesewithtrevor.com call this with the shared login cookie.
// The key lives only here (ANTHROPIC_API_KEY). Before every call: the
// student is logged in and not blocked, the kill switch is on, this month's
// spend is under the cap, and the student's turns are under the minute and
// daily caps; a conversation ends by itself after 40 turns or 3 declined
// requests. Every call, failed ones too, is a row in ai_turns.
const SITE_ORIGIN = "https://englishandportuguesewithtrevor.com";

const CORS = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

const Body = z.object({
  feature: z.literal("partner"),
  conversation: z.uuid(),
  scene: z.string().max(40),
  level: z.enum(LEVELS),
  action: z.enum(["start", "say", "end"]),
  text: z.string().max(LIMITS.textChars).optional(),
});

type Limits = { month_cost: number; day_turns: number; minute_turns: number; conversation_turns: number; off_topic_turns: number };

/** The client shows these in the site language; the words aren't ours to pick here. */
function refuse(code: string, status: number) {
  return Response.json({ error: code }, { status, headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== SITE_ORIGIN) return refuse("origin", 403);

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return refuse("signed-out", 401);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refuse("bad", 400);
  const body = parsed.data;
  const text = body.text?.trim() ?? "";
  if (body.action === "say" && !text) return refuse("bad", 400);

  const db = createServerJobClient();
  const [{ data: profile }, { data: settings }, { data: limitsData }] = await Promise.all([
    db.from("profiles").select("ai_blocked, learning_language").eq("id", user.id).single(),
    db.from("ai_settings").select("enabled, monthly_cap, daily_turns").eq("id", true).single(),
    db.rpc("ai_limits", { p_user: user.id, p_conversation: body.conversation }),
  ]);
  if (!profile || profile.ai_blocked) return refuse("blocked", 403);
  if (!settings?.enabled || !process.env.ANTHROPIC_API_KEY) return refuse("off", 403);
  const limits = limitsData as Limits | null;
  if (!limits) return refuse("failed", 500);
  if (Number(limits.month_cost) >= Number(settings.monthly_cap)) return refuse("budget", 403);
  if (limits.minute_turns >= LIMITS.minuteTurns) return refuse("slow", 429);
  if (limits.day_turns >= settings.daily_turns) return refuse("daily", 429);
  if (limits.conversation_turns >= LIMITS.conversationTurns || limits.off_topic_turns >= LIMITS.offTopicTurns) return refuse("ended", 409);

  const language: Language = profile.learning_language === "en" ? "en" : "pt";
  if (!SCENES[language][body.scene]) return refuse("bad", 400);

  // The history comes from our own rows, never from the client.
  const { data: earlier } = await db
    .from("ai_turns")
    .select("student, reply")
    .eq("user_id", user.id)
    .eq("conversation_id", body.conversation)
    .order("created_at", { ascending: false })
    .limit(LIMITS.historyTurns);
  const prompt = body.action === "start" ? START_PROMPT : body.action === "end" ? END_PROMPT : text;
  const messages: Anthropic.MessageParam[] = [];
  for (const turn of (earlier ?? []).reverse()) {
    messages.push({ role: "user", content: turn.student === "(start)" ? START_PROMPT : turn.student === "(end)" ? END_PROMPT : turn.student });
    if (turn.reply) messages.push({ role: "assistant", content: turn.reply });
  }
  messages.push({ role: "user", content: prompt });

  const row = {
    user_id: user.id,
    feature: body.feature,
    conversation_id: body.conversation,
    scene: body.scene,
    student: body.action === "say" ? text : `(${body.action})`,
    model: MODEL,
  };
  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 30_000 });
    const answer = await askClaude(client, systemPrompt(language, body.level, body.scene), messages);
    const refused = answer.stopReason === "refusal";
    const reply = refused || !answer.reply ? backToScene(language) : answer.reply;
    const offTopic = refused || answer.offTopic;
    const { error } = await db.from("ai_turns").insert({
      ...row,
      reply,
      off_topic: offTopic,
      input_tokens: answer.usage.input_tokens,
      cached_tokens: answer.usage.cache_read_input_tokens ?? 0,
      output_tokens: answer.usage.output_tokens,
      cost: turnCost(MODEL, answer.usage),
      stop_reason: answer.stopReason,
    });
    // The reply is already paid for; a missing ledger row goes to the logs.
    if (error) console.error("[api/ai] ledger insert failed:", error.message);
    const ended =
      body.action === "end" ||
      limits.conversation_turns + 1 >= LIMITS.conversationTurns ||
      limits.off_topic_turns + (offTopic ? 1 : 0) >= LIMITS.offTopicTurns;
    return Response.json({ reply, ended }, { headers: CORS });
  } catch (error) {
    console.error("[api/ai] failed:", error);
    // Counted like a turn, so a failing call can't be hammered either.
    await db.from("ai_turns").insert({ ...row, reply: "", stop_reason: "error" });
    return refuse("failed", 502);
  }
}
