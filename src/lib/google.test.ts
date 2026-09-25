import { describe, expect, it } from "vitest";

import { buildRawEmail } from "@/lib/google";

function decode(raw: string) {
  const message = Buffer.from(raw, "base64url").toString();
  const [headers, body] = message.split("\r\n\r\n");
  return { headers, body: Buffer.from(body, "base64").toString() };
}

describe("buildRawEmail", () => {
  it("sends from the business account", () => {
    const { headers } = decode(buildRawEmail({ to: "ana@example.com", subject: "Hi", text: "Hello" }));
    expect(headers).toContain("From: English & Portuguese with Trevor <englishportuguesewithtrevor@gmail.com>");
    expect(headers).toContain("To: ana@example.com");
    expect(headers).toContain("Subject: Hi");
  });

  it("keeps accented subjects and bodies intact", () => {
    const { headers, body } = decode(
      buildRawEmail({ to: "joão@example.com", subject: "Aula confirmada: amanhã", text: "Olá João, até amanhã!" }),
    );
    const subject = headers.split("\r\n").find((h) => h.startsWith("Subject: "))!;
    const encoded = subject.match(/=\?UTF-8\?B\?(.+)\?=/)![1];
    expect(Buffer.from(encoded, "base64").toString()).toBe("Aula confirmada: amanhã");
    expect(body).toBe("Olá João, até amanhã!");
  });
});
