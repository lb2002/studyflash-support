/**
 * Generates Excalidraw diagram JSON for Studyflash Support architecture.
 * Run: node docs/generate-excalidraw.mjs
 * Output: docs/architecture.excalidraw
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let idCounter = 0;
const uid = () => `el_${String(++idCounter).padStart(3, "0")}`;
const seed = () => Math.floor(Math.random() * 2000000000);

// Color palette
const BLUE = "#a5d8ff";
const BLUE_DARK = "#1971c2";
const GREEN = "#b2f2bb";
const GREEN_DARK = "#2f9e44";
const YELLOW = "#ffec99";
const YELLOW_DARK = "#e67700";
const PURPLE = "#d0bfff";
const PURPLE_DARK = "#7048e8";
const RED = "#ffc9c9";
const RED_DARK = "#e03131";
const GRAY = "#dee2e6";
const GRAY_DARK = "#495057";
const WHITE = "#ffffff";
const TRANSPARENT = "transparent";
const STROKE = "#1e1e1e";
const ORANGE = "#ffd8a8";
const ORANGE_DARK = "#d9480f";

function rect(id, x, y, w, h, bg = WHITE, opts = {}) {
  return {
    id,
    type: "rectangle",
    x, y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: opts.strokeColor || STROKE,
    backgroundColor: bg,
    fillStyle: opts.fillStyle || "solid",
    strokeWidth: opts.strokeWidth || 2,
    strokeStyle: opts.strokeStyle || "solid",
    roughness: 0,
    opacity: 100,
    groupIds: opts.groupIds || [],
    frameId: null,
    index: opts.index || "a0",
    roundness: { type: 3 },
    seed: seed(),
    version: 1,
    versionNonce: seed(),
    isDeleted: false,
    boundElements: opts.boundElements || null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function text(id, x, y, content, fontSize = 16, opts = {}) {
  const lineHeight = fontSize * 1.25;
  const lines = content.split("\n");
  const h = lines.length * lineHeight;
  const maxLineLen = Math.max(...lines.map((l) => l.length));
  const w = maxLineLen * fontSize * 0.6;
  return {
    id,
    type: "text",
    x, y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: opts.color || STROKE,
    backgroundColor: TRANSPARENT,
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: opts.groupIds || [],
    frameId: null,
    index: opts.index || "a0",
    roundness: null,
    seed: seed(),
    version: 1,
    versionNonce: seed(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    text: content,
    fontSize,
    fontFamily: 2,
    textAlign: opts.textAlign || "left",
    verticalAlign: opts.verticalAlign || "top",
    containerId: opts.containerId || null,
    originalText: content,
    autoResize: true,
    lineHeight: 1.25,
  };
}

function arrow(id, points, opts = {}) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const relPoints = points.map((p) => [p[0] - minX, p[1] - minY]);
  return {
    id,
    type: "arrow",
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    angle: 0,
    strokeColor: opts.strokeColor || STROKE,
    backgroundColor: TRANSPARENT,
    fillStyle: "solid",
    strokeWidth: opts.strokeWidth || 2,
    strokeStyle: opts.strokeStyle || "solid",
    roughness: 0,
    opacity: 100,
    groupIds: opts.groupIds || [],
    frameId: null,
    index: opts.index || "a0",
    roundness: { type: 2 },
    seed: seed(),
    version: 1,
    versionNonce: seed(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: relPoints,
    lastCommittedPoint: null,
    startBinding: opts.startBinding || null,
    endBinding: opts.endBinding || null,
    startArrowhead: opts.startArrowhead || null,
    endArrowhead: opts.endArrowhead || "arrow",
    elbowed: false,
  };
}

function line(id, points, opts = {}) {
  const a = arrow(id, points, opts);
  a.type = "line";
  a.endArrowhead = null;
  a.startArrowhead = null;
  delete a.startBinding;
  delete a.endBinding;
  return a;
}

// ============================================================
// DIAGRAM 1: SYSTEM ARCHITECTURE (y: 0 - 600)
// ============================================================
const d1 = [];
const D1_X = 0;
const D1_Y = 0;

// Title
d1.push(text(uid(), D1_X + 300, D1_Y, "System Architecture", 32, { color: STROKE }));

// --- Browser Layer ---
const browserBoxId = uid();
d1.push(rect(browserBoxId, D1_X, D1_Y + 60, 1080, 120, BLUE, { strokeColor: BLUE_DARK }));
d1.push(text(uid(), D1_X + 20, D1_Y + 70, "Browser (React 19)", 14, { color: BLUE_DARK }));

// Page boxes inside browser
const pages = ["Dashboard", "Triage", "Tickets", "Ticket Detail", "Settings"];
pages.forEach((p, i) => {
  const bx = D1_X + 30 + i * 205;
  d1.push(rect(uid(), bx, D1_Y + 100, 180, 50, WHITE, { strokeColor: BLUE_DARK }));
  d1.push(text(uid(), bx + 90 - p.length * 4.5, D1_Y + 114, p, 16));
});

// Arrow: Browser -> API
d1.push(arrow(uid(), [[D1_X + 540, D1_Y + 180], [D1_X + 540, D1_Y + 230]]));
d1.push(text(uid(), D1_X + 550, D1_Y + 195, "HTTP / JSON", 12, { color: GRAY_DARK }));

// --- Next.js API Layer ---
const apiBoxId = uid();
d1.push(rect(apiBoxId, D1_X, D1_Y + 230, 1080, 160, GREEN, { strokeColor: GREEN_DARK, fillStyle: "solid" }));
d1.push(text(uid(), D1_X + 20, D1_Y + 240, "Next.js 15 API Routes (Server)", 14, { color: GREEN_DARK }));

// Route boxes
const routes = [
  { name: "/api/tickets\nCRUD + assign\n+ messages", x: 30 },
  { name: "/api/ai\ncategorize + batch\ndraft + translate", x: 240 },
  { name: "/api/outlook\nsync\nwebhook", x: 450 },
  { name: "/api/enrichment\nSentry + PostHog\nuser data", x: 660 },
  { name: "/api/dashboard\nstats + charts\n+ team-members", x: 870 },
];
routes.forEach((r) => {
  d1.push(rect(uid(), D1_X + r.x, D1_Y + 275, 180, 90, WHITE, { strokeColor: GREEN_DARK }));
  d1.push(text(uid(), D1_X + r.x + 15, D1_Y + 285, r.name, 13));
});

// --- External Services Layer ---
const svcY = D1_Y + 460;

// PostgreSQL
d1.push(rect(uid(), D1_X, svcY, 200, 100, BLUE, { strokeColor: BLUE_DARK }));
d1.push(text(uid(), D1_X + 30, svcY + 15, "PostgreSQL 16", 18, { color: BLUE_DARK }));
d1.push(text(uid(), D1_X + 30, svcY + 45, "Prisma ORM\n4 models + indexes", 13, { color: GRAY_DARK }));

// Anthropic Claude
d1.push(rect(uid(), D1_X + 230, svcY, 200, 100, YELLOW, { strokeColor: YELLOW_DARK }));
d1.push(text(uid(), D1_X + 250, svcY + 15, "Anthropic Claude", 18, { color: YELLOW_DARK }));
d1.push(text(uid(), D1_X + 250, svcY + 45, "Haiku 4.5 (triage)\nSonnet 4.5 (draft)", 13, { color: GRAY_DARK }));

// Microsoft Graph
d1.push(rect(uid(), D1_X + 460, svcY, 200, 100, PURPLE, { strokeColor: PURPLE_DARK }));
d1.push(text(uid(), D1_X + 472, svcY + 15, "Microsoft Graph", 18, { color: PURPLE_DARK }));
d1.push(text(uid(), D1_X + 472, svcY + 45, "Outlook API\n(mock mode)", 13, { color: GRAY_DARK }));

// Sentry/PostHog
d1.push(rect(uid(), D1_X + 690, svcY, 210, 100, RED, { strokeColor: RED_DARK }));
d1.push(text(uid(), D1_X + 705, svcY + 15, "Sentry + PostHog", 18, { color: RED_DARK }));
d1.push(text(uid(), D1_X + 705, svcY + 45, "Error tracking\nSession replay (mock)", 13, { color: GRAY_DARK }));

// localStorage
d1.push(rect(uid(), D1_X + 930, svcY, 150, 100, GRAY, { strokeColor: GRAY_DARK }));
d1.push(text(uid(), D1_X + 950, svcY + 15, "localStorage", 18, { color: GRAY_DARK }));
d1.push(text(uid(), D1_X + 950, svcY + 45, "Settings\nDrafts\nUI state", 13, { color: GRAY_DARK }));

// Arrows from API to services
d1.push(arrow(uid(), [[D1_X + 120, D1_Y + 390], [D1_X + 100, svcY]]));
d1.push(arrow(uid(), [[D1_X + 330, D1_Y + 390], [D1_X + 330, svcY]]));
d1.push(arrow(uid(), [[D1_X + 540, D1_Y + 390], [D1_X + 560, svcY]]));
d1.push(arrow(uid(), [[D1_X + 750, D1_Y + 390], [D1_X + 795, svcY]]));

// Tech badges at bottom
d1.push(text(uid(), D1_X, svcY + 130, "TypeScript 5  |  shadcn/ui + Tailwind CSS 4  |  Recharts  |  Docker Compose  |  Node.js 22", 14, { color: GRAY_DARK }));


// ============================================================
// DIAGRAM 2: TICKET LIFECYCLE (y: 0, x: 1250)
// ============================================================
const d2 = [];
const D2_X = 1250;
const D2_Y = 0;

d2.push(text(uid(), D2_X + 100, D2_Y, "Ticket Lifecycle", 32));

// Flow boxes
const flowSteps = [
  { label: "Email arrives\nin Outlook", bg: PURPLE, sc: PURPLE_DARK, note: "" },
  { label: "Sync / Ingest", bg: GREEN, sc: GREEN_DARK, note: "Webhook or\nmanual sync" },
  { label: "AI Categorize", bg: YELLOW, sc: YELLOW_DARK, note: "Claude Haiku 4.5\ncategory + priority\nlanguage + summary\nconfidence (0-1)" },
  { label: "Triage Queue", bg: BLUE, sc: BLUE_DARK, note: "Semi-Auto: human review\nFull Auto: confidence-based\nprefetch pipelining" },
  { label: "Translate", bg: PURPLE, sc: PURPLE_DARK, note: "Auto-translate inbound\nDE / NL / FR / IT\ndual-language editor" },
  { label: "Draft Response", bg: YELLOW, sc: YELLOW_DARK, note: "Claude Sonnet 4.5\nin customer's language\nedit English \u2192 auto-sync" },
  { label: "Confidence Check", bg: ORANGE, sc: ORANGE_DARK, note: "" },
];

const stepW = 280;
const stepH = 55;
const stepGap = 90;
const noteOffset = 300;

flowSteps.forEach((step, i) => {
  const sy = D2_Y + 60 + i * stepGap;
  const boxId = uid();
  d2.push(rect(boxId, D2_X, sy, stepW, stepH, step.bg, { strokeColor: step.sc }));
  d2.push(text(uid(), D2_X + 20, sy + 8, step.label, 16));

  if (step.note) {
    d2.push(text(uid(), D2_X + noteOffset, sy + 5, step.note, 12, { color: GRAY_DARK }));
    d2.push(line(uid(), [[D2_X + stepW, sy + stepH / 2], [D2_X + noteOffset - 10, sy + stepH / 2]], { strokeStyle: "dotted", strokeColor: GRAY }));
  }

  // Arrow to next step
  if (i < flowSteps.length - 1) {
    d2.push(arrow(uid(), [[D2_X + stepW / 2, sy + stepH], [D2_X + stepW / 2, sy + stepGap]]));
  }
});

// After "Confidence Check" — branching outcomes
const branchY = D2_Y + 60 + flowSteps.length * stepGap;

// Left branch: Auto-Close
const acX = D2_X - 120;
d2.push(rect(uid(), acX, branchY, 180, 55, RED, { strokeColor: RED_DARK }));
d2.push(text(uid(), acX + 20, branchY + 8, "AUTO_CLOSED\n(garbage/spam)", 14));
d2.push(arrow(uid(), [[D2_X + 80, branchY - 35], [acX + 90, branchY]], { strokeColor: RED_DARK }));
d2.push(text(uid(), acX - 10, branchY - 25, "confidence\n\u2265 75%", 11, { color: RED_DARK }));

// Center branch: Send Reply
const srX = D2_X + 50;
d2.push(rect(uid(), srX, branchY, 180, 55, GREEN, { strokeColor: GREEN_DARK }));
d2.push(text(uid(), srX + 20, branchY + 8, "Send Reply\n\u2192 RESOLVED", 14));
d2.push(arrow(uid(), [[D2_X + stepW / 2, branchY - 35], [srX + 90, branchY]]));
d2.push(text(uid(), srX + 185, branchY + 5, "confidence \u2265 80%\nor manual send", 11, { color: GREEN_DARK }));

// Right branch: Skip (low confidence)
const skX = D2_X + 310;
d2.push(rect(uid(), skX, branchY, 180, 55, GRAY, { strokeColor: GRAY_DARK }));
d2.push(text(uid(), skX + 20, branchY + 8, "Skipped\n(needs human)", 14));
d2.push(arrow(uid(), [[D2_X + stepW - 80, branchY - 35], [skX + 90, branchY]], { strokeColor: GRAY_DARK }));
d2.push(text(uid(), skX + 185, branchY + 5, "low confidence\nor sensitive category", 11, { color: GRAY_DARK }));

// Sensitive note
d2.push(text(uid(), D2_X - 120, branchY + 75, "Sensitive categories (cancellations, refunds, billing) always require human review", 12, { color: RED_DARK }));


// ============================================================
// DIAGRAM 3: AI PIPELINE (y: 700)
// ============================================================
const d3 = [];
const D3_X = 0;
const D3_Y = 700;

d3.push(text(uid(), D3_X + 250, D3_Y, "AI Pipeline", 32));

// --- Section 1: Categorization ---
const cat_y = D3_Y + 60;
d3.push(rect(uid(), D3_X, cat_y, 900, 180, YELLOW, { strokeColor: YELLOW_DARK, fillStyle: "solid" }));
d3.push(text(uid(), D3_X + 20, cat_y + 10, "CATEGORIZATION  \u2014  Claude Haiku 4.5", 18, { color: YELLOW_DARK }));
d3.push(text(uid(), D3_X + 20, cat_y + 145, "Why Haiku: High volume, low stakes \u2192 $0.25/M tokens (12x cheaper than Sonnet)", 13, { color: GRAY_DARK }));

// Input box
d3.push(rect(uid(), D3_X + 30, cat_y + 50, 180, 70, WHITE, { strokeColor: YELLOW_DARK }));
d3.push(text(uid(), D3_X + 55, cat_y + 60, "Ticket body\n(any language)", 14));
// Process box
d3.push(rect(uid(), D3_X + 310, cat_y + 50, 200, 70, WHITE, { strokeColor: YELLOW_DARK }));
d3.push(text(uid(), D3_X + 335, cat_y + 55, "Classify\n(single API call)", 14));
// Output box
d3.push(rect(uid(), D3_X + 610, cat_y + 50, 250, 70, WHITE, { strokeColor: YELLOW_DARK }));
d3.push(text(uid(), D3_X + 625, cat_y + 55, "category + priority\nlanguage + summary\nconfidence (0-1)", 13));
// Arrows
d3.push(arrow(uid(), [[D3_X + 210, cat_y + 85], [D3_X + 310, cat_y + 85]], { strokeColor: YELLOW_DARK }));
d3.push(arrow(uid(), [[D3_X + 510, cat_y + 85], [D3_X + 610, cat_y + 85]], { strokeColor: YELLOW_DARK }));

// --- Section 2: Response Drafting ---
const draft_y = D3_Y + 270;
d3.push(rect(uid(), D3_X, draft_y, 900, 180, PURPLE, { strokeColor: PURPLE_DARK, fillStyle: "solid" }));
d3.push(text(uid(), D3_X + 20, draft_y + 10, "RESPONSE DRAFTING  \u2014  Claude Sonnet 4.5", 18, { color: PURPLE_DARK }));
d3.push(text(uid(), D3_X + 20, draft_y + 145, "Why Sonnet: Customer-facing, quality matters \u2192 dual-language editor, always editable", 13, { color: GRAY_DARK }));

// Input
d3.push(rect(uid(), D3_X + 30, draft_y + 50, 180, 70, WHITE, { strokeColor: PURPLE_DARK }));
d3.push(text(uid(), D3_X + 45, draft_y + 55, "Ticket + history\n+ category context", 14));
// Process
d3.push(rect(uid(), D3_X + 310, draft_y + 50, 200, 70, WHITE, { strokeColor: PURPLE_DARK }));
d3.push(text(uid(), D3_X + 330, draft_y + 55, "Generate response\n(customer's lang)", 14));
// Output
d3.push(rect(uid(), D3_X + 610, draft_y + 50, 250, 70, WHITE, { strokeColor: PURPLE_DARK }));
d3.push(text(uid(), D3_X + 625, draft_y + 55, "Editable draft\ndual-lang editor\nEN \u2194 target lang", 13));
// Arrows
d3.push(arrow(uid(), [[D3_X + 210, draft_y + 85], [D3_X + 310, draft_y + 85]], { strokeColor: PURPLE_DARK }));
d3.push(arrow(uid(), [[D3_X + 510, draft_y + 85], [D3_X + 610, draft_y + 85]], { strokeColor: PURPLE_DARK }));

// --- Section 3: Translation ---
const trans_y = D3_Y + 480;
d3.push(rect(uid(), D3_X, trans_y, 900, 150, GREEN, { strokeColor: GREEN_DARK, fillStyle: "solid" }));
d3.push(text(uid(), D3_X + 20, trans_y + 10, "TRANSLATION  \u2014  Claude Haiku 4.5", 18, { color: GREEN_DARK }));
d3.push(text(uid(), D3_X + 20, trans_y + 120, "On-demand, cached \u2014 translation stored with message, never re-translated", 13, { color: GRAY_DARK }));

// Input
d3.push(rect(uid(), D3_X + 30, trans_y + 50, 180, 55, WHITE, { strokeColor: GREEN_DARK }));
d3.push(text(uid(), D3_X + 45, trans_y + 57, "Message\n(DE / NL / FR / IT)", 14));
// Process
d3.push(rect(uid(), D3_X + 310, trans_y + 50, 200, 55, WHITE, { strokeColor: GREEN_DARK }));
d3.push(text(uid(), D3_X + 340, trans_y + 57, "Translate\nto English", 14));
// Output
d3.push(rect(uid(), D3_X + 610, trans_y + 50, 250, 55, WHITE, { strokeColor: GREEN_DARK }));
d3.push(text(uid(), D3_X + 625, trans_y + 57, "English text\n(cached per message)", 13));
// Arrows
d3.push(arrow(uid(), [[D3_X + 210, trans_y + 77], [D3_X + 310, trans_y + 77]], { strokeColor: GREEN_DARK }));
d3.push(arrow(uid(), [[D3_X + 510, trans_y + 77], [D3_X + 610, trans_y + 77]], { strokeColor: GREEN_DARK }));


// ============================================================
// DIAGRAM 4: TRIAGE PIPELINE (y: 700, x: 1250)
// ============================================================
const d4 = [];
const D4_X = 1250;
const D4_Y = 700;

d4.push(text(uid(), D4_X + 80, D4_Y, "Triage Pipeline (Full Auto)", 32));

// Main pipeline flow
const pipeSteps = [
  { label: "Load Ticket N\nfrom Queue", bg: BLUE, sc: BLUE_DARK },
  { label: "Categorize\n(Haiku 4.5)", bg: YELLOW, sc: YELLOW_DARK },
  { label: "Translate Inbound\n(if non-EN/DE)", bg: GREEN, sc: GREEN_DARK },
  { label: "Draft Response\n(Sonnet 4.5)", bg: PURPLE, sc: PURPLE_DARK },
  { label: "Fetch Enrichment\n(Sentry + PostHog)", bg: RED, sc: RED_DARK },
  { label: "Evaluate Confidence\n& Auto-Action", bg: ORANGE, sc: ORANGE_DARK },
  { label: "Advance Queue\n\u2192 Ticket N+1", bg: BLUE, sc: BLUE_DARK },
];

const pW = 260;
const pH = 55;
const pGap = 80;

pipeSteps.forEach((step, i) => {
  const py = D4_Y + 60 + i * pGap;
  d4.push(rect(uid(), D4_X, py, pW, pH, step.bg, { strokeColor: step.sc }));
  d4.push(text(uid(), D4_X + 20, py + 8, step.label, 14));
  if (i < pipeSteps.length - 1) {
    d4.push(arrow(uid(), [[D4_X + pW / 2, py + pH], [D4_X + pW / 2, py + pGap]], { strokeColor: step.sc }));
  }
});

// Prefetch annotation — parallel pipeline
const prefetchX = D4_X + pW + 40;
const prefetchY = D4_Y + 60 + pGap;  // starts at step 2

d4.push(rect(uid(), prefetchX, prefetchY, 280, 260, WHITE, { strokeColor: BLUE_DARK, strokeStyle: "dashed", fillStyle: "solid" }));
d4.push(text(uid(), prefetchX + 15, prefetchY + 10, "PREFETCH (Background)", 16, { color: BLUE_DARK }));
d4.push(text(uid(), prefetchX + 15, prefetchY + 40, "While agent reviews Ticket N,\nTicket N+1 is fully prepared\nin the background:", 13, { color: GRAY_DARK }));
d4.push(text(uid(), prefetchX + 15, prefetchY + 100, "1. Categorize N+1\n2. Translate N+1\n3. Draft N+1\n4. Enrich N+1", 14, { color: BLUE_DARK }));
d4.push(text(uid(), prefetchX + 15, prefetchY + 190, "Result cached in ref.\nInstant load when\nqueue advances.", 13, { color: GRAY_DARK }));

// Dashed arrow from main pipeline to prefetch box
d4.push(arrow(uid(), [[D4_X + pW, D4_Y + 60 + 2 * pGap + pH / 2], [prefetchX, prefetchY + 130]], { strokeStyle: "dashed", strokeColor: BLUE_DARK }));


// ============================================================
// Assemble final file
// ============================================================
const allElements = [...d1, ...d2, ...d3, ...d4];

const excalidrawFile = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: allElements,
  appState: {
    gridSize: 20,
    gridStep: 5,
    gridModeEnabled: false,
    viewBackgroundColor: "#ffffff",
  },
  files: {},
};

const outPath = join(__dirname, "architecture.excalidraw");
writeFileSync(outPath, JSON.stringify(excalidrawFile, null, 2));
console.log(`Written ${allElements.length} elements to ${outPath}`);
