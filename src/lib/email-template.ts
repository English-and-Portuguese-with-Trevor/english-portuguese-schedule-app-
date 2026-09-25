/**
 * One layout for every notification email: the landing page's wordmark, a
 * heading, a details table, an optional button, and the bilingual tagline.
 * Returns both HTML and a plain-text version for mail apps that prefer it.
 */

export interface EmailContent {
  heading: string;
  /** A sentence or two above the details. */
  intro?: string;
  details: [label: string, value: string][];
  /** Rendered as a link inside the details, e.g. the Meet link. */
  location?: { label: string; url: string };
  button?: { label: string; url: string };
  /** The student's answers to the booking questions. */
  questions?: [question: string, answer: string][];
  footerNote?: string;
}

export const TAGLINE_EN = "You are one step closer to learning/improving another language! Let's go :)";
export const TAGLINE_PT = "Você está a um passo de aprender/aprimorar outro idioma! Vamos lá :)";

const FOREST = "#1b4332";
const GOLD = "#c9970a";
const CREAM = "#f5f0e8";
const INK = "#12231a";
const MUTED = "#4a5e54";

function escape(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const rows = content.details
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 16px 6px 0;color:${MUTED};font-size:14px;vertical-align:top;white-space:nowrap">${escape(label)}</td>
          <td style="padding:6px 0;color:${INK};font-size:14px;font-weight:600">${escape(value)}</td>
        </tr>`,
    )
    .join("");

  const location = content.location
    ? `
        <tr>
          <td style="padding:6px 16px 6px 0;color:${MUTED};font-size:14px;vertical-align:top">Location</td>
          <td style="padding:6px 0;font-size:14px"><a href="${escape(content.location.url)}" style="color:${FOREST};font-weight:600">${escape(content.location.label)}</a></td>
        </tr>`
    : "";

  const questions = content.questions?.length
    ? `
      <h2 style="margin:24px 0 8px;font-size:15px;color:${INK}">Questions</h2>
      ${content.questions
        .map(
          ([question, answer]) =>
            `<p style="margin:0 0 2px;font-size:13px;color:${MUTED}">${escape(question)}</p>
      <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:${INK}">${escape(answer)}</p>`,
        )
        .join("")}`
    : "";

  const button = content.button
    ? `<p style="margin:24px 0 0"><a href="${escape(content.button.url)}" style="display:inline-block;background:${FOREST};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:6px">${escape(content.button.label)}</a></p>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px 12px;background:${CREAM};font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;padding:28px 24px">
      <p style="margin:0 0 20px;font-family:Georgia,serif;font-size:20px;color:${FOREST}">
        English <em style="color:${GOLD}">&amp;</em> Portuguese with Trevor
      </p>
      <h1 style="margin:0 0 12px;font-size:20px;color:${INK}">${escape(content.heading)}</h1>
      ${content.intro ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:${INK}">${escape(content.intro)}</p>` : ""}
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows}${location}
      </table>
      ${questions}
      ${button}
      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e0d5;font-size:13px;line-height:1.5;color:${MUTED}">
        <p style="margin:0">${escape(TAGLINE_EN)}</p>
        <p style="margin:4px 0 0">${escape(TAGLINE_PT)}</p>
        ${content.footerNote ? `<p style="margin:12px 0 0">${escape(content.footerNote)}</p>` : ""}
      </div>
    </div>
  </body>
</html>`;

  const text = [
    content.heading,
    "",
    ...(content.intro ? [content.intro, ""] : []),
    ...content.details.map(([label, value]) => `${label}: ${value}`),
    ...(content.location ? [`Location: ${content.location.label} ${content.location.url}`] : []),
    ...(content.questions?.length ? ["", "Questions", ...content.questions.flatMap(([q, a]) => [q, a])] : []),
    ...(content.button ? ["", `${content.button.label}: ${content.button.url}`] : []),
    "",
    TAGLINE_EN,
    TAGLINE_PT,
    ...(content.footerNote ? ["", content.footerNote] : []),
    "",
    "English & Portuguese with Trevor",
  ].join("\n");

  return { html, text };
}
