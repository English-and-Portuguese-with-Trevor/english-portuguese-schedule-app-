import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The "What I offer" documents Trevor sends students (English and Portuguese),
// in the sites' style: cream, forest and gold, DM Serif Display and Inter.
// `node docs/offer/build.mjs` writes the two HTML files and PDFs next to this
// script. When a price or rule changes, edit the text below and the "updated
// as of" line, run it again and commit the PDFs (CLAUDE.md, "Class policy").
process.chdir(dirname(fileURLToPath(import.meta.url)));

const SITE = "https://englishandportuguesewithtrevor.com";
const SCHED = "https://schedule.englishandportuguesewithtrevor.com";
const EMAIL = "englishportuguesewithtrevor@gmail.com";

const en = {
  lang: "en", file: "classes-with-trevor-en",
  title: "Classes with Trevor", sub: "Private English and Portuguese classes, online, one-on-one",
  updated: "Prices and rules updated as of October 18, 2026",
  about: { h: "About me", p: [
    "I've been a language teacher for 13+ years. Today I teach private English and Portuguese classes online, one-on-one, with 200+ students so far.",
    "I'm from Arkansas, USA. I earned my degree in Spanish at the University of the Ozarks and taught Spanish at the University of Missouri, where I took my first Portuguese classes. In 2020 I went to Brazil with the Fulbright program to teach English at the Federal University of Pará, then stayed three years teaching at English schools and a bilingual school." ],
    facts: ["13+ years teaching", "Fulbright teacher", "3 years in Brazil", "200+ students"] },
  classes: { h: "Private classes", lead: "Every class is one hour, one-on-one, on Google Meet, at a time you pick in the schedule app. Times show in your own time zone; I teach from Denver (Mountain Time).", lead2: "English classes are taught 100% in English. Portuguese classes start in English and bridge into Portuguese conversation.", items: [
    ["Conversation first", "You talk from day one. Grammar comes in as you need it, and the words stick because you have used them."],
    ["Once or twice a week", "Pick the times that work for you. A calendar invite with your Meet link arrives right away."],
    ["Every level welcome", "Start from zero in Portuguese or polish advanced English. Classes meet you where you are and move at your pace."],
    ["Built around your goals", "Travel, work, exams, or just confidence: we work on what you need, with conversation, grammar, videos, music, games and homework as it fits."],
    ["Everything on the site included", "Lessons, flashcards, activities and daily puzzles, so the language stays with you between classes. No subscription needed."] ] },
  prices: { h: "Prices", note: "Packages are paid up front, before the first class, and used at your own pace. Paying from Brazil? You can also pay in reais; ask me for the amount.",
    cols: ["Package", "Price", "Per class", "Usual pace"], rows: [
      ["4 classes", "$100", "$25", "Once a week"],
      ["8 classes", "$184", "$23", "Twice a week"],
      ["Custom package", "On request", "", "Any other number of classes or pace"] ],
    sub: { h: "No classes, just the materials?", p: "The lesson subscription opens every lesson, activity, hard mode and daily puzzle on the site, in both languages. Cancel anytime in Settings.", rows: [["Monthly", "$7.99"], ["Yearly", "$59.99"]] } },
  policy: { h: "Cancellation policy", lead: "Every package comes with one free cancellation, no questions asked. After that, the 24-hour rule applies.", items: [
    ["More than 24 hours ahead", "Cancel or move a class in the app as often as you need. It never counts."],
    ["Less than 24 hours ahead, or a missed class", "The first time in a package is free: the class doesn't count and we find another time. After that, it counts as one of your classes."],
    ["If I cancel a class", "It never counts, and you book another time."],
    ["Good to know", "A class requested less than 72 hours ahead stays pending until I approve it. Packages aren't refunded; you use one up by taking the classes you paid for."] ],
    link: "Full class policy: " },
  book: { h: "How to get started", steps: [
    "Pick your package: 4 classes, 8 classes, or a custom one.",
    "Book your times at schedule.englishandportuguesewithtrevor.com. Booking means you agree to the class policy.",
    "Pay for the package before the first class, and we're set." ],
    contact: "Questions? Write me and I'll get back to you within a day.",
    minors: "The sites and classes are for adults. For a student under 18, a parent or guardian creates the account, books the classes and is my contact." },
};

const pt = {
  lang: "pt", file: "aulas-com-o-trevor-pt",
  title: "Aulas com o Trevor", sub: "Aulas particulares de inglês e português, online, individuais",
  updated: "Preços e regras atualizados em 18 de outubro de 2026",
  about: { h: "Sobre mim", p: [
    "Sou professor de idiomas há mais de 13 anos. Hoje dou aulas particulares de inglês e português online, individuais, com mais de 200 alunos até agora.",
    "Sou do Arkansas, nos Estados Unidos. Me formei em espanhol na University of the Ozarks e dei aulas de espanhol na University of Missouri, onde fiz minhas primeiras aulas de português. Em 2020 vim ao Brasil pelo programa Fulbright para ensinar inglês na Universidade Federal do Pará e fiquei três anos, dando aulas em escolas de inglês e em uma escola bilíngue." ],
    facts: ["Mais de 13 anos ensinando", "Professor Fulbright", "3 anos no Brasil", "Mais de 200 alunos"] },
  classes: { h: "Aulas particulares", lead: "Cada aula tem uma hora, é individual e acontece no Google Meet, no horário que você escolhe no app de agendamento. Os horários aparecem no seu fuso; eu dou aula de Denver (horário das Montanhas, EUA).", lead2: "As aulas de inglês são 100% em inglês. As aulas de português começam em inglês e vão passando para a conversação em português.", items: [
    ["Conversação primeiro", "Você fala desde o primeiro dia. A gramática entra conforme você precisa, e as palavras ficam porque você já as usou."],
    ["Uma ou duas vezes por semana", "Escolha os horários que funcionam para você. O convite da agenda com o link do Meet chega na hora."],
    ["Todos os níveis", "Comece do zero no português ou aperfeiçoe um inglês avançado. As aulas partem de onde você está e seguem no seu ritmo."],
    ["Feitas para os seus objetivos", "Viagem, trabalho, provas ou só confiança: trabalhamos o que você precisa, com conversação, gramática, vídeos, música, jogos e dever de casa conforme fizer sentido."],
    ["Tudo do site incluído", "Lições, flashcards, atividades e desafios diários, para o idioma ficar com você entre as aulas. Sem precisar de assinatura."] ] },
  prices: { h: "Preços", note: "Os pacotes são pagos antes da primeira aula e usados no seu ritmo. Pagando do Brasil? Você também pode pagar em reais; me pergunte o valor.",
    cols: ["Pacote", "Preço", "Por aula", "Ritmo comum"], rows: [
      ["4 aulas", "US$ 100", "US$ 25", "Uma vez por semana"],
      ["8 aulas", "US$ 184", "US$ 23", "Duas vezes por semana"],
      ["Pacote personalizado", "Sob consulta", "", "Outro número de aulas ou outro ritmo"] ],
    sub: { h: "Sem aulas, só os materiais?", p: "A assinatura das lições libera todas as lições, atividades, modo difícil e desafios diários do site, nos dois idiomas. Cancele quando quiser em Configurações.", rows: [["Mensal", "US$ 7,99"], ["Anual", "US$ 59,99"]] } },
  policy: { h: "Política de cancelamento", lead: "Todo pacote vem com um cancelamento grátis, sem perguntas. Depois dele, vale a regra das 24 horas.", items: [
    ["Com mais de 24 horas de antecedência", "Cancele ou mude uma aula no app quantas vezes precisar. Ela nunca conta."],
    ["Com menos de 24 horas, ou falta", "A primeira vez em cada pacote é grátis: a aula não conta e marcamos outro horário. Depois disso, ela conta como uma das suas aulas."],
    ["Se eu cancelar uma aula", "Ela nunca conta, e você marca outro horário."],
    ["Bom saber", "Uma aula pedida com menos de 72 horas de antecedência fica pendente até eu aprovar. Os pacotes não têm reembolso: você os termina fazendo as aulas."] ],
    link: "Política completa: " },
  book: { h: "Como começar", steps: [
    "Escolha seu pacote: 4 aulas, 8 aulas ou um personalizado.",
    "Marque seus horários em schedule.englishandportuguesewithtrevor.com. Ao agendar, você concorda com a política de aulas.",
    "Pague o pacote antes da primeira aula, e pronto." ],
    contact: "Dúvidas? Me escreva e eu respondo em até um dia.",
    minors: "Os sites e as aulas são para adultos. Para um aluno menor de 18 anos, o pai, a mãe ou o responsável cria a conta, agenda as aulas e é o meu contato." },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const html = (d) => `<!doctype html>
<html lang="${d.lang}"><head><meta charset="utf-8"><title>${esc(d.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --cream:#f5f0e8; --cream-mid:#ebe4d5; --sage:#d7dcd1; --forest:#1b4332; --forest-mid:#2d6a4f; --leaf:#55b88a; --gold:#f4c430; --gold-deep:#c9970a; --gold-text:#8a6508; --ink:#12231a; --line:rgba(18,35,26,.12); --muted:#4f5f56; }
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  .page { width: 210mm; height: 297mm; padding: 7mm; break-after: page; }
  .page:last-child { break-after: auto; }
  /* The frame: a forest line with a thin gold line inside, 9mm in from the paper's edge; the material sits 10mm inside it. */
  .inner { height: 100%; display: flex; flex-direction: column; overflow: hidden; padding: 5mm 6mm; border: 2px solid var(--forest); border-radius: 16px; }
  html, body { margin: 0; background: var(--cream); color: var(--ink); font-family: "Inter", system-ui, sans-serif; font-size: 9.8pt; line-height: 1.4; }
  h1, h2, .brand { font-family: "DM Serif Display", Georgia, serif; font-weight: 400; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 2px 0 12px; border-bottom: 2px solid var(--gold); }
  header img { height: 64px; width: auto; }
  .brand { font-size: 17pt; line-height: 1.12; color: var(--forest); }
  .brand em { color: var(--gold-deep); font-style: italic; }
  .brand small { display: block; font-size: 11.5pt; color: var(--forest-mid); }
  .hero { margin: 14px 0 10px; }
  h1 { font-size: 26pt; line-height: 1.1; color: var(--forest); }
  .sub { margin: 4px 0 0; font-size: 12pt; color: var(--forest-mid); }
  .updated { display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 999px; background: var(--cream-mid); color: var(--gold-text); font-size: 9pt; font-weight: 600; }
  section { margin-top: 8px; background: var(--cream-mid); border-radius: 16px; padding: 8px 10px 7px; }
  section.sage { background: var(--sage); }
  section.sage .card { background: rgba(255,255,255,.75); }
  h2 { font-size: 16.5pt; color: var(--forest); margin-bottom: 6px; }
  h2::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--gold); margin-right: 8px; vertical-align: 2px; }
  p { margin: 0 0 7px; }
  .facts { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 0; padding: 0; list-style: none; }
  .facts li { padding: 3px 10px; border-radius: 999px; background: var(--cream); border: 1px solid var(--line); font-size: 9pt; font-weight: 500; color: var(--forest); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 6px; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 7px 11px; }
  .card b { display: block; color: var(--forest); font-weight: 600; margin-bottom: 2px; }
  .card.wide { grid-column: 1 / -1; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 6px; background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  th { background: var(--forest); color: var(--cream); text-align: left; font-weight: 500; font-size: 9.5pt; padding: 7px 12px; }
  td { padding: 5px 12px; border-top: 1px solid var(--line); vertical-align: top; }
  td.price { font-family: "DM Serif Display", Georgia, serif; font-size: 14pt; color: var(--forest); white-space: nowrap; }
  tr.custom td.price { font-family: "Inter", system-ui, sans-serif; font-size: 10.6pt; font-weight: 600; }
  .subbox { display: flex; gap: 14px; align-items: center; margin-top: auto; padding-top: 10px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 8px 12px; }
  .subbox b { display: block; color: var(--forest); font-weight: 600; margin-bottom: 2px; }
  .subprices { display: flex; gap: 8px; flex-shrink: 0; }
  .subprices div { background: var(--cream-mid); border-radius: 10px; padding: 6px 12px; text-align: center; min-width: 78px; }
  .subprices span { display: block; font-size: 8.5pt; color: var(--muted); }
  .subprices strong { font-family: "DM Serif Display", Georgia, serif; font-weight: 400; font-size: 13pt; color: var(--forest); }
        .steps { counter-reset: s; list-style: none; margin: 6px 0 0; padding: 0; }
  .steps li { counter-increment: s; position: relative; padding-left: 34px; margin-bottom: 3px; }
  .steps li::before { content: counter(s); position: absolute; left: 0; top: 0; width: 24px; height: 24px; border-radius: 50%; background: var(--gold); color: var(--ink); font-weight: 600; font-size: 9.5pt; display: flex; align-items: center; justify-content: center; }
  .contact { margin-top: 8px; background: var(--forest); color: var(--cream); border-radius: 18px; padding: 12px 18px; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 16px; }
  .contact a { color: #fff; text-decoration: none; font-weight: 600; }
  .contact .links { font-size: 9.5pt; line-height: 1.7; text-align: left; }
  .small { font-size: 8.8pt; color: var(--muted); margin: 8px 0 0; }
  a { color: var(--forest-mid); }
</style></head><body>
<div class="page"><div class="inner">
<header><div class="brand">English <em>&amp;</em> Portuguese<small>With Trevor</small></div><img src="logo-transparent.png" alt=""></header>
<div class="hero"><h1>${esc(d.title)}</h1><p class="sub">${esc(d.sub)}</p><span class="updated">${esc(d.updated)}</span></div>

<section><h2>${esc(d.about.h)}</h2>${d.about.p.map((x) => `<p>${esc(x)}</p>`).join("")}
<ul class="facts">${d.about.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></section>

<section class="sage"><h2>${esc(d.classes.h)}</h2><p>${esc(d.classes.lead)}</p><p>${esc(d.classes.lead2)}</p>
<div class="grid">${d.classes.items.map(([b, t], i, a) => `<div class="card${i === a.length - 1 ? " wide" : ""}"><b>${esc(b)}</b>${esc(t)}</div>`).join("")}</div></section>
</div></div>
<div class="page"><div class="inner">
<section><h2>${esc(d.prices.h)}</h2><p>${esc(d.prices.note)}</p>
<table><thead><tr>${d.prices.cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>
${d.prices.rows.map((r, i) => `<tr${i === 2 ? ' class="custom"' : ""}><td><b>${esc(r[0])}</b></td><td class="price">${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("")}
</tbody></table></section>

<section class="sage"><h2>${esc(d.policy.h)}</h2><p>${esc(d.policy.lead)}</p>
<div class="grid">${d.policy.items.map(([b, t]) => `<div class="card"><b>${esc(b)}</b>${esc(t)}</div>`).join("")}</div>
<p class="small">${esc(d.policy.link)}<a href="${SCHED}/policy">schedule.englishandportuguesewithtrevor.com/policy</a></p></section>

<section><h2>${esc(d.book.h)}</h2>
<ol class="steps">${d.book.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
<div class="contact"><div>${esc(d.book.contact)}</div><div class="links"><a href="mailto:${EMAIL}">${EMAIL}</a><br><a href="${SITE}">englishandportuguesewithtrevor.com</a><br><a href="${SCHED}">schedule.englishandportuguesewithtrevor.com</a></div></div>
<p class="small">${esc(d.book.minors)}</p></section>
<div class="subbox" id="subbox" style="margin-top:auto"><div><b>${esc(d.prices.sub.h)}</b>${esc(d.prices.sub.p)}</div><div class="subprices">${d.prices.sub.rows.map(([k, v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div></div>
</div></div>
</body></html>`;

const browser = await chromium.launch();
for (const d of [en, pt]) {
  writeFileSync(`${d.file}.html`, html(d));
  const page = await browser.newPage();
  await page.goto(`file://${process.cwd()}/${d.file}.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => [...document.querySelectorAll(".inner")].map((el) => el.scrollHeight - el.clientHeight));
  if (overflow.some((px) => px > 0)) console.warn(`${d.file}: a page overflows by`, overflow, "px");
  await page.pdf({ path: `${d.file}.pdf`, format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.close();
  console.log("wrote", d.file);
}
await browser.close();
