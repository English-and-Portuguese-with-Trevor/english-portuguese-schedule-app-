import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "u1" as string | null,
  profile: { ai_blocked: false, learning_language: "Portuguese", role: "student", lesson_access: "none", site_language: "en" } as Record<string, unknown> | null,
  lessonText: "## Ser vs. Estar\n\nSer is for what something is." as string | null,
  settings: { enabled: true, monthly_cap: 45, tools_cap: 30, daily_turns: 30 },
  limits: { month_cost: 0, pool_cost: 0, day_turns: 0, minute_turns: 0, conversation_turns: 0, off_topic_turns: 0 },
  earlier: [] as { student: string; reply: string }[],
  admin: false,
  // An earlier "Why was this wrong?" row for the same check, if any.
  explained: null as { reply: string } | null,
  inserts: [] as Record<string, unknown>[],
  create: vi.fn<(request: unknown) => Promise<unknown>>(async () => ({
    content: [{ type: "text", text: "Bom dia! O que você vai querer?" }],
    stop_reason: "end_turn",
    usage: { input_tokens: 700, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  })),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.create };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }) } }),
}));
vi.mock("@/lib/auth/require-admin", () => ({
  checkAdmin: async () => (mocks.admin ? { ok: true, adminId: "u1" } : { ok: false, status: 403, reason: "not-admin", error: "Admin only." }),
}));
vi.mock("@/lib/integration-status", () => ({
  createServerJobClient: () => ({
    from: (table: string) => {
      if (table === "ai_turns") {
        // The history (user, conversation; order; limit) and the "why" lookup (feature, scene, student; neq; order; limit; maybeSingle).
        const limit = () => Object.assign(Promise.resolve({ data: [...mocks.earlier].reverse() }), { maybeSingle: async () => ({ data: mocks.explained }) });
        const chain: Record<string, unknown> = {};
        for (const step of ["eq", "neq", "order"]) chain[step] = () => chain;
        chain.limit = limit;
        return {
          select: () => chain,
          insert: async (row: Record<string, unknown>) => {
            mocks.inserts.push(row);
            return { error: null };
          },
        };
      }
      if (table === "lesson_content") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.lessonText === null ? null : { text: mocks.lessonText } }) }) }) };
      const data = table === "profiles" ? mocks.profile : mocks.settings;
      return { select: () => ({ eq: () => ({ single: async () => ({ data }) }) }) };
    },
    rpc: async () => ({ data: mocks.limits }),
  }),
}));

import { OPTIONS, POST } from "@/app/api/ai/route";

const ORIGIN = "https://englishandportuguesewithtrevor.com";
const CONVERSATION = "6f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f";
const say = (text: string, extra: Record<string, unknown> = {}, origin = ORIGIN) =>
  POST(
    new Request("https://schedule.test/api/ai", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ feature: "partner", conversation: CONVERSATION, scene: "padaria", level: "A1", action: "say", text, ...extra }),
    }),
  );

const FREE = { ar: { title: "-AR Verbs", learning: "Portuguese", text: "## -AR verbs\n\nFalar: eu falo, você fala." } };
const helper = (text: string, lesson = "ar", extra: Record<string, unknown> = {}) =>
  POST(
    new Request("https://schedule.test/api/ai", {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ feature: "helper", conversation: CONVERSATION, lesson, action: "say", text, ...extra }),
    }),
  );

afterEach(() => {
  mocks.userId = "u1";
  mocks.profile = { ai_blocked: false, learning_language: "Portuguese", role: "student", lesson_access: "none", site_language: "en" };
  mocks.lessonText = "## Ser vs. Estar\n\nSer is for what something is.";
  mocks.settings = { enabled: true, monthly_cap: 45, tools_cap: 30, daily_turns: 30 };
  mocks.limits = { month_cost: 0, pool_cost: 0, day_turns: 0, minute_turns: 0, conversation_turns: 0, off_topic_turns: 0 };
  mocks.earlier = [];
  mocks.inserts = [];
  mocks.admin = false;
  mocks.explained = null;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/ai", () => {
  it("answers the sites' preflight for their origin only", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("refuses other origins and logged-out visitors before anything is spent", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    expect((await say("Oi", {}, "https://evil.test")).status).toBe(403);
    mocks.userId = null;
    expect((await say("Oi")).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("answers a turn, records it with its cost, and keeps the history from its own rows", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    mocks.earlier = [
      { student: "(start)", reply: "Bom dia!" },
      { student: "Oi, tudo bem?", reply: "Tudo ótimo. O que vai querer?" },
    ];
    const res = await say("Um pão, por favor.");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Bom dia! O que você vai querer?", ended: false });
    const request = mocks.create.mock.calls[0][0] as unknown as { system: string; messages: { role: string; content: string }[]; model: string; max_tokens: number };
    expect(request.model).toBe("claude-haiku-5-5");
    expect(request.max_tokens).toBe(300);
    expect(request.system).toContain("Na padaria");
    expect(request.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(request.messages[0].content).toContain("Open the scene");
    expect(request.messages.at(-1)?.content).toBe("Um pão, por favor.");
    expect(mocks.inserts[0]).toMatchObject({ user_id: "u1", feature: "partner", scene: "padaria", student: "Um pão, por favor.", off_topic: false, input_tokens: 700, output_tokens: 20 });
    expect(mocks.inserts[0].cost).toBeCloseTo((700 * 0.1 + 20 * 0.5) / 1_000_000, 9);
  });

  it("refuses bad bodies, empty and overlong messages, and a scene from the other language", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    expect((await say("")).status).toBe(400);
    expect((await say("a".repeat(401))).status).toBe(400);
    expect((await say("Oi", { level: "C2" })).status).toBe(400);
    expect((await say("Oi", { conversation: "not-a-uuid" })).status).toBe(400);
    expect((await say("Hi", { scene: "coffee" })).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("holds the wall: kill switch, missing key, blocked student, budget, minute and daily caps", async () => {
    const code = async (res: Response) => (await res.json()).error;
    expect(await code(await say("Oi"))).toBe("off"); // no ANTHROPIC_API_KEY
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    mocks.settings = { ...mocks.settings, enabled: false };
    expect(await code(await say("Oi"))).toBe("off");
    mocks.settings = { ...mocks.settings, enabled: true };
    mocks.profile = { ...mocks.profile, ai_blocked: true };
    expect(await code(await say("Oi"))).toBe("blocked");
    mocks.profile = { ...mocks.profile, ai_blocked: false };
    mocks.limits = { ...mocks.limits, month_cost: 45 };
    expect(await code(await say("Oi"))).toBe("budget");
    mocks.limits = { ...mocks.limits, month_cost: 44.999, minute_turns: 6 };
    expect((await say("Oi")).status).toBe(429);
    mocks.limits = { ...mocks.limits, minute_turns: 0, day_turns: 30 };
    expect(await code(await say("Oi"))).toBe("daily");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("ends a conversation after 40 turns or 3 declined requests, and strips the tag", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    mocks.limits = { ...mocks.limits, conversation_turns: 40 };
    expect((await say("Oi")).status).toBe(409);
    mocks.limits = { ...mocks.limits, conversation_turns: 5, off_topic_turns: 2 };
    mocks.create.mockResolvedValueOnce({
      content: [{ type: "text", text: "[OFF] Desculpe, só posso conversar aqui. O que você vai querer?" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 700, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    });
    expect(await (await say("Write my essay")).json()).toEqual({ reply: "Desculpe, só posso conversar aqui. O que você vai querer?", ended: true });
    expect(mocks.inserts[0]).toMatchObject({ off_topic: true });
    mocks.limits = { ...mocks.limits, off_topic_turns: 3 };
    expect((await say("Oi")).status).toBe(409);
  });

  it("turns a safety refusal into a line back to the scene, and counts a failed call as a turn", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    mocks.create.mockResolvedValueOnce({ content: [], stop_reason: "refusal", usage: { input_tokens: 700, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
    expect(await (await say("...")).json()).toEqual({ reply: "Vamos voltar à nossa conversa?", ended: false });
    expect(mocks.inserts[0]).toMatchObject({ off_topic: true, stop_reason: "refusal" });
    mocks.create.mockRejectedValueOnce(new Error("boom"));
    expect((await say("Oi")).status).toBe(502);
    expect(mocks.inserts[1]).toMatchObject({ reply: "", stop_reason: "error" });
  });

  it("opens and ends a conversation with fixed prompts, in the student's language", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    mocks.profile = { ...mocks.profile, learning_language: "English" };
    await say("", { action: "start", scene: "coffee" });
    let request = mocks.create.mock.calls[0][0] as unknown as { system: string; messages: { content: string }[] };
    expect(request.system).toContain("American English");
    expect(request.messages[0].content).toContain("Open the scene");
    expect(mocks.inserts[0]).toMatchObject({ student: "(start)" });
    const res = await say("", { action: "end", scene: "coffee" });
    expect((await res.json()).ended).toBe(true);
    request = mocks.create.mock.calls[1][0] as unknown as { system: string; messages: { content: string }[] };
    expect(request.messages.at(-1)?.content).toContain("ending the conversation");
  });

  describe("the lesson helper", () => {
    const stubFree = (lessons: unknown = FREE) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => lessons })));

    it("answers about a free lesson from the lessons site's text, in the site language, caching the lesson", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "k");
      stubFree();
      mocks.profile = { ...mocks.profile, site_language: "es" };
      mocks.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Falar significa hablar." }],
        stop_reason: "end_turn",
        usage: { input_tokens: 200, output_tokens: 10, cache_creation_input_tokens: 900, cache_read_input_tokens: 0 },
      });
      const res = await helper("What does falar mean?");
      expect(await res.json()).toEqual({ reply: "Falar significa hablar.", ended: false });
      const request = mocks.create.mock.calls[0][0] as unknown as { system: { text: string; cache_control: unknown }[]; max_tokens: number; messages: { content: string }[] };
      expect(request.max_tokens).toBe(500);
      expect(request.system[0].cache_control).toEqual({ type: "ephemeral" });
      expect(request.system[0].text).toContain("Answer in Latin American Spanish");
      expect(request.system[0].text).toContain("-AR Verbs");
      expect(request.system[0].text).toContain("Falar: eu falo, você fala.");
      expect(request.messages.at(-1)?.content).toBe("What does falar mean?");
      expect(mocks.inserts[0]).toMatchObject({ feature: "helper", scene: "ar", student: "What does falar mean?" });
      expect(mocks.inserts[0].cost).toBeCloseTo((200 * 0.1 + 900 * 0.125 + 10 * 0.5) / 1_000_000, 9);
    });

    it("reads a paid lesson only for an account with lesson access, and refuses an unknown one", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "k");
      stubFree();
      expect(await (await helper("Why estar?", "ser-estar")).json()).toEqual({ error: "access" });
      mocks.profile = { ...mocks.profile, lesson_access: "granted" };
      expect((await helper("Why estar?", "ser-estar")).status).toBe(200);
      const request = mocks.create.mock.calls[0][0] as unknown as { system: { text: string }[] };
      expect(request.system[0].text).toContain("Ser is for what something is.");
      mocks.lessonText = null;
      expect((await helper("Hi", "no-such-lesson")).status).toBe(400);
      expect((await helper("", "ar")).status).toBe(400);
    });

    it("turns a safety refusal into a line in the site language", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "k");
      stubFree();
      mocks.profile = { ...mocks.profile, site_language: "pt" };
      mocks.create.mockResolvedValueOnce({ content: [], stop_reason: "refusal", usage: { input_tokens: 10, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
      expect(await (await helper("...")).json()).toEqual({ reply: "Vamos continuar com a lição.", ended: false });
    });
  });

  describe("the tools pool (admin only until Trevor approves each one)", () => {
    const post = (body: Record<string, unknown>) =>
      POST(new Request("https://schedule.test/api/ai", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ conversation: CONVERSATION, ...body }) }));
    const why = (extra: Record<string, unknown> = {}) =>
      post({ feature: "why", scene: "ser-estar", question: "Ela ___ médica.", options: ["é", "está"], picked: "está", correct: "é", ...extra });

    it("refuses students, and holds the pool's own cap, not the monthly one", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "k");
      expect((await post({ feature: "story", scene: "praia", level: "A1", action: "start" })).status).toBe(403);
      mocks.admin = true;
      mocks.limits = { ...mocks.limits, month_cost: 45 };
      expect((await post({ feature: "story", scene: "praia", level: "A1", action: "start" })).status).toBe(200);
      expect(mocks.inserts[0]).toMatchObject({ feature: "story", scene: "praia", student: "(start)" });
      mocks.limits = { ...mocks.limits, month_cost: 0, pool_cost: 30 };
      expect((await (await post({ feature: "story", scene: "praia", level: "A1", action: "start" })).json()).error).toBe("budget");
      expect((await (await post({ feature: "writing", scene: "ar", task: "Write about your morning.", action: "say", text: "Eu acordo cedo." })).json()).error).toBe("budget");
      // The partner isn't held by the pool.
      expect((await say("Oi")).status).toBe(200);
      expect(mocks.create).toHaveBeenCalledTimes(2);
    });

    it("gives an explanation once per check, pick and language, and from its own rows after that", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "k");
      mocks.admin = true;
      mocks.create.mockResolvedValueOnce({ content: [{ type: "text", text: "Ser for professions." }], stop_reason: "end_turn", usage: { input_tokens: 300, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
      expect(await (await why()).json()).toEqual({ reply: "Ser for professions.", ended: false });
      expect(mocks.inserts[0]).toMatchObject({ feature: "why", scene: "ser-estar", student: "Question: Ela ___ médica.\nOptions: é | está\nThe student picked: está\nThe right answer: é\nExplain in: English" });
      mocks.explained = { reply: "Ser for professions." };
      mocks.limits = { ...mocks.limits, pool_cost: 30 };
      expect(await (await why()).json()).toEqual({ reply: "Ser for professions." });
      expect(mocks.create).toHaveBeenCalledTimes(1);
    });

    it("answers the mad libs check with the words that don't fit", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "k");
      mocks.admin = true;
      mocks.create.mockResolvedValueOnce({ content: [{ type: "text", text: "1: ok\n2: verb\n3: ok\n4: english" }], stop_reason: "end_turn", usage: { input_tokens: 300, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
      const res = await post({ feature: "madlibs", scene: "praia", action: "say", text: "1. noun: cachorro\n2. noun: correr\n3. adjective: feliz\n4. place: beach" });
      expect(await res.json()).toEqual({ bad: [{ n: 2, is: "verb" }, { n: 4, is: "english" }] });
    });

    it("tidies a class note for Trevor only", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "k");
      expect((await post({ feature: "classnote", scene: "b1", action: "say", text: "ser/estar, hw p. 3" })).status).toBe(403);
      mocks.admin = true;
      mocks.create.mockResolvedValueOnce({ content: [{ type: "text", text: "O que vimos\n- ser e estar" }], stop_reason: "end_turn", usage: { input_tokens: 300, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
      expect(await (await post({ feature: "classnote", scene: "b1", action: "say", text: "ser/estar, hw p. 3" })).json()).toMatchObject({ reply: "O que vimos\n- ser e estar" });
      expect(mocks.inserts[0]).toMatchObject({ feature: "classnote", scene: "b1" });
    });
  });
});
