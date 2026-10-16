import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "u1" as string | null,
  profile: { ai_blocked: false, learning_language: "pt" } as { ai_blocked: boolean; learning_language: string | null } | null,
  settings: { enabled: true, monthly_cap: 45, daily_turns: 30 },
  limits: { month_cost: 0, day_turns: 0, minute_turns: 0, conversation_turns: 0, off_topic_turns: 0 },
  earlier: [] as { student: string; reply: string }[],
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
vi.mock("@/lib/integration-status", () => ({
  createServerJobClient: () => ({
    from: (table: string) => {
      if (table === "ai_turns") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [...mocks.earlier].reverse() }) }) }) }) }),
          insert: async (row: Record<string, unknown>) => {
            mocks.inserts.push(row);
            return { error: null };
          },
        };
      }
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

afterEach(() => {
  mocks.userId = "u1";
  mocks.profile = { ai_blocked: false, learning_language: "pt" };
  mocks.settings = { enabled: true, monthly_cap: 45, daily_turns: 30 };
  mocks.limits = { month_cost: 0, day_turns: 0, minute_turns: 0, conversation_turns: 0, off_topic_turns: 0 };
  mocks.earlier = [];
  mocks.inserts = [];
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
    mocks.profile = { ai_blocked: true, learning_language: "pt" };
    expect(await code(await say("Oi"))).toBe("blocked");
    mocks.profile = { ai_blocked: false, learning_language: "pt" };
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
    mocks.profile = { ai_blocked: false, learning_language: "en" };
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
});
