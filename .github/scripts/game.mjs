// Keep-Vedant-alive: a tamagotchi that lives in the profile README.
// Each run picks up every open "game|<move>" issue, applies the moves, replies, closes them,
// and redraws the block between the GAME markers. The daily cron run also makes him hungrier.
import { readFileSync, writeFileSync } from "node:fs";

const REPO = process.env.GITHUB_REPOSITORY || "xtacy-on-code/xtacy-on-code";
const TOKEN = process.env.GITHUB_TOKEN;
const FAKE = process.env.GAME_FAKE_ISSUES; // local testing: a JSON file of issues, no network
const STATE = "game/state.json";
const README = "README.md";
const COOLDOWN_MS = 5 * 60 * 1000;

const state = JSON.parse(readFileSync(STATE, "utf8"));
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const safeLogin = (s) => String(s).replace(/[^A-Za-z0-9-]/g, "");

const MOVES = {
  chai(s) {
    if (s.chai >= 90) {
      s.sleep = clamp(s.sleep - 10);
      s.xp += 5;
      return pick(["he's vibrating now. he can hear the CPU fan thinking.", "that was chai #9. he's typing at 200 wpm and none of it compiles."]);
    }
    s.chai = clamp(s.chai + 25);
    s.sleep = clamp(s.sleep - 5);
    s.xp += 10;
    return pick(["chai acquired. productivity +25%. sleep schedule -5%.", "he took a sip, said \"bas yahi chahiye tha\", and opened 14 new tabs.", "cutting chai delivered. he is now legally a senior dev."]);
  },
  sleep(s) {
    s.sleep = clamp(s.sleep + 40);
    s.chai = clamp(s.chai - 10);
    s.xp += 10;
    if (s.bugs >= 8) return "he slept, but dreamt in stack traces.";
    return pick(["8 hours. he forgot what that felt like.", "he went to bed. he'll be back in 20 minutes with \"one small idea\".", "lights off. laptop still open. we take what we can get."]);
  },
  bug(s) {
    s.xp += 15;
    if (s.bugs === 0) return "there are no bugs. this is deeply suspicious.";
    s.bugs -= 1;
    if (s.fire && s.bugs <= 3) {
      s.fire = false;
      return "the bug is squashed and prod is no longer on fire. you're a hero.";
    }
    return pick(["squashed. it was a missing `await`. it's always a missing `await`.", "bug fixed by deleting the code that had the bug. bold.", "fixed it. created two more. net progress: unclear."]);
  },
  deploy(s) {
    if (s.bugs >= 6 || Math.random() < 0.25) {
      s.bugs += 3;
      s.fire = true;
      s.xp += 5;
      return pick(["you pushed to prod on a friday. prod is on fire. 🔥", "deployed! ...and the homepage now just says `undefined`. 🔥", "it worked on his machine. it does not work on any other machine. 🔥"]);
    }
    s.deploys += 1;
    s.fire = false;
    s.xp += 25;
    return pick(["deployed. no errors. he doesn't trust it.", "shipped to prod. green checkmarks everywhere. he's emotional.", "it's live! he refreshed the page 40 times to make sure."]);
  },
  hackathon(s) {
    s.sleep = clamp(s.sleep - 50);
    s.chai = clamp(s.chai - 30);
    s.bugs += 4;
    s.deploys += 1;
    s.xp += 50;
    return pick(["48 hours later: shipped a demo, ate 6 samosas, slept 0 hours.", "he pitched an \"AI-powered\" idea to judges. it was an if-statement. it won.", "the demo crashed live. he said \"that's a feature\" with a straight face."]);
  },
};

const LABEL = { chai: "gave chai ☕", sleep: "sent him to bed 😴", bug: "squashed a bug 🐛", deploy: "pushed to prod 🚀", hackathon: "signed him up for a hackathon 🏆" };

function mood(s) {
  if (s.fire) return { face: "( ⊙_⊙)", hand: "/ >🔥", say: "prod is fine. everything is fine.", name: "on fire" };
  if (s.sleep < 15) return { face: "( x_x)", hand: "/ >💤", say: "i have not seen the sun in 3 days", name: "zombie" };
  if (s.bugs >= 10) return { face: "( °□°)", hand: "/ >🐛", say: "WHO WROTE THIS. (it was me.)", name: "panicking" };
  if (s.chai < 15) return { face: "( ;_;)", hand: "/ >🫙", say: "chai... need chai...", name: "withdrawal" };
  if (s.chai >= 90) return { face: "( ◉_◉)", hand: "/ >☕", say: "I CAN HEAR THE CPU FAN THINKING", name: "over-caffeinated" };
  if (s.sleep < 35) return { face: "( -_-)", hand: "/ >💻", say: "it works on my machine", name: "sleepy" };
  return { face: "( ^_^)", hand: "/ >☕", say: "one more feature, then sleep", name: "shipping" };
}

const bar = (n) => "▓".repeat(Math.round(n / 10)) + "░".repeat(10 - Math.round(n / 10));
const level = (xp) => 1 + Math.floor(xp / 200);
const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" });

function link(move, text) {
  const title = encodeURIComponent(`game|${move}`);
  const body = encodeURIComponent("Just hit **Submit new issue**. A bot will do the rest in about 30 seconds.");
  return `[${text}](https://github.com/${REPO}/issues/new?title=${title}&body=${body})`;
}

function render(s) {
  const m = mood(s);
  const lv = level(s.xp);
  const top = Object.entries(s.caretakers).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const medals = ["🥇", "🥈", "🥉", "4.", "5."];
  return [
    "```text",
    "        (\\_/)",
    `        ${m.face}     "${m.say}"`,
    `        ${m.hand}`,
    "```",
    "",
    `**mood:** ${m.name} &nbsp;·&nbsp; **level ${lv}** (${s.xp} xp, next at ${lv * 200}) &nbsp;·&nbsp; **shipped:** ${s.deploys} &nbsp;·&nbsp; **bugs:** ${s.bugs}${s.fire ? " 🔥" : ""}`,
    "",
    "```text",
    `chai   ${bar(s.chai)}  ${s.chai}%`,
    `sleep  ${bar(s.sleep)}  ${s.sleep}%`,
    "```",
    "",
    `**do something:** ${link("chai", "☕ give chai")} · ${link("sleep", "😴 send to bed")} · ${link("bug", "🐛 squash a bug")} · ${link("deploy", "🚀 push to prod")} · ${link("hackathon", "🏆 hackathon!")}`,
    "",
    "<sub>each button opens an issue. hit submit, and a bot updates him in about 30 seconds. chai and sleep drain every day, so he needs you.</sub>",
    "",
    "**what happened lately**",
    "",
    ...(s.log.length ? s.log.map((e) => `- ${e}`) : ["- nothing yet. he's waiting for his first chai."]),
    "",
    `**top caretakers:** ${top.length ? top.map(([u, n], i) => `${medals[i]} @${u} (${n})`).join(" &nbsp; ") : "nobody yet. be the first."}`,
  ].join("\n");
}

async function gh(path, opts = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`${opts.method || "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function reply(issue, text) {
  if (FAKE) return console.log(`#${issue.number} -> ${text}`);
  await gh(`/issues/${issue.number}/comments`, { method: "POST", body: JSON.stringify({ body: text }) });
  await gh(`/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "completed" }) });
}

const issues = FAKE
  ? JSON.parse(readFileSync(FAKE, "utf8"))
  : (await gh("/issues?state=open&per_page=50&sort=created&direction=asc")).filter((i) => !i.pull_request);

for (const issue of issues.filter((i) => /^game\|/i.test(i.title.trim())).slice(0, 25)) {
  const move = issue.title.trim().toLowerCase().slice(5);
  const who = safeLogin(issue.user.login);
  const before = level(state.xp);
  if (!MOVES[move]) {
    await reply(issue, `"${move.slice(0, 30)}" isn't a move I know. Try one of the buttons in the README.`);
    continue;
  }
  const last = state.lastSeen[who] ? Date.parse(state.lastSeen[who]) : 0;
  if (Date.parse(issue.created_at) - last < COOLDOWN_MS) {
    await reply(issue, "easy there. he can only handle one of you every 5 minutes. try again in a bit.");
    continue;
  }
  const msg = MOVES[move](state);
  state.lastSeen[who] = issue.created_at;
  state.caretakers[who] = (state.caretakers[who] || 0) + 1;
  state.log.unshift(`${day(issue.created_at)}: **@${who}** ${LABEL[move]}. ${msg}`);
  const up = level(state.xp) > before ? `\n\n🎉 **LEVEL UP!** he's level ${level(state.xp)} now.` : "";
  await reply(issue, `${msg}${up}\n\nThanks for keeping him alive, @${who}. [See how he's doing](https://github.com/${REPO.split("/")[0]}).`);
}

if (process.env.GITHUB_EVENT_NAME === "schedule") {
  state.chai = clamp(state.chai - 15);
  state.sleep = clamp(state.sleep - 10);
  state.bugs += 1;
  state.log.unshift(`${day(new Date().toISOString())}: a day passed. chai -15, sleep -10, and a bug appeared out of nowhere.`);
}

state.log = state.log.slice(0, 6);
writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
const readme = readFileSync(README, "utf8");
writeFileSync(README, readme.replace(/<!--GAME:START-->[\s\S]*<!--GAME:END-->/, () => `<!--GAME:START-->\n${render(state)}\n<!--GAME:END-->`));
