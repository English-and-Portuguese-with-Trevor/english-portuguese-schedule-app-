import { describe, expect, it } from "vitest";

import { buildRawEmail } from "@/lib/google";

function decode(raw: string) {
  const message = Buffer.from(raw, "base64url").toString();
  const [headers, body] = message.split("\r\n\r\n");
  return { headers, body: Buffer.from(body, "base64").toString() };
}

describe("buildRawEmail", () => {
  it("sends HTML with a plain-text fallback", () => {
    const message = Buffer.from(
      buildRawEmail({ to: "ana@example.com", subject: "Hi", text: "Plain hello", html: "<p>Olá</p>" }),
      "base64url",
    ).toString();
    expect(message).toMatch(/Content-Type: multipart\/alternative; boundary="ept-/);
    const parts = message.split(/--ept-[^\r\n]*/).slice(1, 3);
    const decodePart = (p: string) => Buffer.from(p.split("\r\n\r\n")[1], "base64").toString();
    expect(parts[0]).toContain("text/plain");
    expect(decodePart(parts[0])).toBe("Plain hello");
    expect(parts[1]).toContain("text/html");
    expect(decodePart(parts[1])).toBe("<p>Olá</p>");
  });

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
