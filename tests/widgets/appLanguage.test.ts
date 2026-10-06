import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_LANGUAGES,
  AUTO_LANGUAGE,
  getLanguageMeta,
  getUiStrings,
  isPinnedLanguage,
  normalizeLanguagePreference
} from "../../src/lib/appLanguage.js";
import {
  CERLESSE_CODEX_SYSTEM_PROMPT,
  CERLESSE_FOLLOWUP_SYSTEM_PROMPT,
  buildLanguageDirective,
  withLanguageDirective
} from "../../server/codex/codexConfig.js";
import { CodexEventBridge } from "../../server/codex/eventBridge.js";
import { formatReActSummary, buildReActTrace } from "../../src/lib/reActTrace.js";

// ============================================================
// 语言设置归一化
// ============================================================

test("normalizeLanguagePreference：历史 zh-CN 写法归一到两字母码", () => {
  // 这是整条链路的关键回归点：设置项写 zh-CN，而查表认 zh，
  // 不归一的话用户选了中文会被静默当成 auto。
  assert.equal(normalizeLanguagePreference("zh-CN"), "zh");
  assert.equal(normalizeLanguagePreference("zh_CN"), "zh");
  assert.equal(normalizeLanguagePreference("ZH"), "zh");
  assert.equal(normalizeLanguagePreference("en-US"), "en");
  assert.equal(normalizeLanguagePreference("pt-BR"), "pt");
});

test("normalizeLanguagePreference：auto / 空 / 未知值都归一到 auto", () => {
  assert.equal(normalizeLanguagePreference("auto"), AUTO_LANGUAGE);
  assert.equal(normalizeLanguagePreference("AUTO"), AUTO_LANGUAGE);
  assert.equal(normalizeLanguagePreference(""), AUTO_LANGUAGE);
  assert.equal(normalizeLanguagePreference("   "), AUTO_LANGUAGE);
  assert.equal(normalizeLanguagePreference(undefined), AUTO_LANGUAGE);
  assert.equal(normalizeLanguagePreference(null), AUTO_LANGUAGE);
  // 看不懂的值不能把回答语言锁死
  assert.equal(normalizeLanguagePreference("klingon"), AUTO_LANGUAGE);
});

test("isPinnedLanguage：auto 为 false，具体语言为 true", () => {
  assert.equal(isPinnedLanguage("auto"), false);
  assert.equal(isPinnedLanguage(undefined), false);
  assert.equal(isPinnedLanguage("zh-CN"), true);
  assert.equal(isPinnedLanguage("en"), true);
});

test("getLanguageMeta：未知码返回 undefined 而不猜", () => {
  assert.equal(getLanguageMeta("ja")?.englishName, "Japanese");
  assert.equal(getLanguageMeta("xx"), undefined);
  assert.equal(getLanguageMeta(undefined), undefined);
});

test("APP_LANGUAGES：选项码唯一，且与服务端 SUPPORTED_LANGUAGES 键集一致", async () => {
  const codes = APP_LANGUAGES.map((l) => l.code);
  assert.equal(new Set(codes).size, codes.length, "语言码不得重复");

  const { SUPPORTED_LANGUAGES } = await import("../../server/language.js");
  const serverCodes = Object.keys(SUPPORTED_LANGUAGES).sort();
  assert.deepEqual([...codes].sort(), serverCodes, "前后端语言表必须对齐，否则归一后会查不到元数据");
});

// ============================================================
// 系统提示词语言注入
// ============================================================

test("buildLanguageDirective：auto / 空不注入任何指令（保持跟随提问语言）", () => {
  assert.equal(buildLanguageDirective("auto"), "");
  assert.equal(buildLanguageDirective(undefined), "");
  assert.equal(buildLanguageDirective(""), "");
  assert.equal(buildLanguageDirective("klingon"), "");
  // zh-CN 归一后是 zh —— 那是**已钉死**的语言，必须注入，不能当成 auto
  assert.notEqual(buildLanguageDirective("zh-CN"), "");
});

test("buildLanguageDirective：钉死语言时注入强制作答指令", () => {
  const en = buildLanguageDirective("en");
  assert.match(en, /English/, "必须点名目标语言");
  assert.match(en, /ENTIRE answer/i, "必须强调是整个回答");
  assert.match(en, /regardless of the language the user typed/i, "必须压过提问语言");
  assert.match(en, /\[1\]\[2\]/, "必须保住引用格式");
  // 实测到的真实失败模式：信源全是非目标语言时，模型会跟着信源语种写。
  assert.match(en, /Do NOT switch to the language of the retrieved sources/i);
  assert.match(en, /summarise them in English/i);

  const ja = buildLanguageDirective("ja");
  assert.match(ja, /Japanese/);
  assert.notEqual(en, ja, "不同语言注入的指令应不同");
});

test("buildLanguageDirective：未知语言不注入，避免乱指令", () => {
  assert.equal(buildLanguageDirective("klingon"), "");
});

test("withLanguageDirective：auto 时提示词逐字不变", () => {
  assert.equal(withLanguageDirective(CERLESSE_CODEX_SYSTEM_PROMPT, "auto"), CERLESSE_CODEX_SYSTEM_PROMPT);
  assert.equal(withLanguageDirective(CERLESSE_FOLLOWUP_SYSTEM_PROMPT, undefined), CERLESSE_FOLLOWUP_SYSTEM_PROMPT);
});

test("withLanguageDirective：钉死语言时在原提示词后追加，且不破坏原有规则", () => {
  const merged = withLanguageDirective(CERLESSE_CODEX_SYSTEM_PROMPT, "zh-CN");
  assert.ok(merged.startsWith(CERLESSE_CODEX_SYSTEM_PROMPT), "原有规则必须完整保留");
  assert.match(merged, /Chinese/, "追加段要含目标语言");
  assert.match(merged, /Answer style/, "base 的回答风格规则仍在");
});

test("withLanguageDirective：追问提示词同样吃语言注入", () => {
  const merged = withLanguageDirective(CERLESSE_FOLLOWUP_SYSTEM_PROMPT, "fr");
  assert.ok(merged.startsWith(CERLESSE_FOLLOWUP_SYSTEM_PROMPT));
  assert.match(merged, /French/);
});

// ============================================================
// 界面 / 步骤文案随语言切换
// ============================================================

test("getUiStrings：不同语言返回不同文案，且每个键都齐全", () => {
  const zh = getUiStrings("zh");
  const en = getUiStrings("en");
  assert.equal(zh.aiTitle, "AI 智能回答");
  assert.equal(en.aiTitle, "AI Answer");
  assert.notEqual(zh.aiRetry, en.aiRetry);

  // 切换语言不得丢键：漏一个键就会在 UI 上留下半中半英的碎片
  const keys = Object.keys(zh) as Array<keyof typeof zh>;
  assert.ok(keys.length > 30, "字典不应只有寥寥几个键");
  for (const code of APP_LANGUAGES.map((l) => l.code)) {
    const s = getUiStrings(code);
    assert.deepEqual(Object.keys(s).sort(), [...keys].sort(), `${code} 缺键`);
  }
});

test("getUiStrings：auto 与未知语言回退中文而不是抛错", () => {
  assert.equal(getUiStrings("auto").aiTitle, "AI 智能回答");
  assert.equal(getUiStrings("klingon").aiTitle, "AI 智能回答");
  assert.equal(getUiStrings(undefined).aiTitle, "AI 智能回答");
});

test("getUiStrings：带数字的文案随语言变化且保留数值", () => {
  const zh = getUiStrings("zh");
  const en = getUiStrings("en");
  assert.match(zh.aiMetricCharCount(1234), /1234/);
  assert.match(en.aiMetricCharCount(1234), /1234/);
  assert.notEqual(zh.aiMetricCharCount(1234), en.aiMetricCharCount(1234));
  assert.equal(zh.aiMetricCharCount(7).includes("7"), true);
});

test("eventBridge：工具调用标题跟随语言切换", () => {
  const zh = new CodexEventBridge("zh");
  const en = new CodexEventBridge("en");

  const zhStep = zh.recordToolCall("c1", "search_web", { query: "量子退火" });
  const enStep = en.recordToolCall("c1", "search_web", { query: "quantum annealing" });

  assert.equal(zhStep.title, "检索网络：量子退火");
  assert.equal(enStep.title, "Search the web: quantum annealing");
  // 检索词本身原样保留，不该被翻译
  assert.match(enStep.title, /quantum annealing/);
});

test("eventBridge：未知工具名与推理层文案也跟随语言", () => {
  const zh = new CodexEventBridge("zh");
  const en = new CodexEventBridge("en");

  assert.equal(zh.recordToolCall("a", "no_such_tool", {}).title, "调用能力工具 [no_such_tool]");
  assert.equal(en.recordToolCall("a", "no_such_tool", {}).title, "Call tool [no_such_tool]");

  const zhReason = zh.recordReasoning("证据充分");
  const enReason = en.recordReasoning("证据充分");
  assert.equal(zhReason.title, "检索推理");
  assert.equal(enReason.title, "Search reasoning");
  assert.equal(zhReason.agentName, "检索推理层");
  assert.equal(enReason.agentName, "Retrieval reasoning layer");
  // 推理正文是检索层产出的观测描述，不该被翻译
  assert.equal(enReason.description, "证据充分");
});

test("eventBridge：不传语言时默认中文（保持旧行为）", () => {
  const bridge = new CodexEventBridge();
  assert.equal(bridge.recordToolCall("c1", "search_web", { query: "x" }).title, "检索网络：x");
  assert.equal(bridge.recordReasoning("y").title, "检索推理");
});

// ============================================================
// ReAct 摘要
// ============================================================

test("formatReActSummary：语言切换时摘要随之切换", () => {
  const steps = [
    { id: "reason_1", title: "检索推理", description: "d", status: "completed", timestamp: 1, agentRole: "retrieval" },
    { id: "2", title: "检索网络：x", description: "d", status: "completed", timestamp: 2 }
  ] as any[];
  const trace = buildReActTrace(steps);

  const zh = formatReActSummary(trace, "zh");
  const en = formatReActSummary(trace, "en");
  assert.match(zh, /思考/);
  assert.match(en, /thought/i);
  assert.notEqual(zh, en);
});

test("formatReActSummary：空轨迹与 auto 回退中文", () => {
  const empty = buildReActTrace([]);
  assert.equal(formatReActSummary(empty, "zh"), "暂无 ReAct 循环记录");
  assert.equal(formatReActSummary(empty, "auto"), "暂无 ReAct 循环记录");
  assert.equal(formatReActSummary(empty, "en"), "No ReAct loop records");
});

test("buildReActTrace：英文参数回显不会被当成观测结论", () => {
  // 回归点：eventBridge 的参数前缀会随语言变成 `Args: {...}`。
  // 参数回显识别若只认中文 `参数:`，切英文后入参就会被冒充成检索结果。
  const englishArgs = buildReActTrace([
    { id: "c1", title: "Verify source", description: 'Args: {"url":"https://x.dev"}', status: "completed", timestamp: 1 }
  ] as any[], "en");
  const act = englishArgs.nodes.find((n) => n.kind === "act");
  const read = englishArgs.nodes.find((n) => n.kind === "read");
  // Act 展示参数，Read 不得拿参数当结论
  assert.match(String(act?.detail), /^Args:/);
  assert.equal(read?.detail, undefined, "参数回显不得充当观测结论");

  // 中文同样成立
  const zhArgs = buildReActTrace([
    { id: "c1", title: "核验信源", description: '参数: {"url":"https://x.dev"}', status: "completed", timestamp: 1 }
  ] as any[], "zh");
  assert.equal(zhArgs.nodes.find((n) => n.kind === "read")?.detail, undefined);
});

test("buildReActTrace：Read / Act 兜底标题随语言切换", () => {
  const step = { id: "c1", description: "obs", status: "completed", timestamp: 1 } as any;
  const zh = buildReActTrace([step], "zh");
  const en = buildReActTrace([step], "en");
  assert.equal(zh.nodes.find((n) => n.kind === "act")?.title, "调用能力工具");
  assert.equal(en.nodes.find((n) => n.kind === "act")?.title, "Tool call");
  assert.equal(zh.nodes.find((n) => n.kind === "read")?.title, "读回结果");
  assert.equal(en.nodes.find((n) => n.kind === "read")?.title, "Observation");

  const failed = { id: "c2", description: "boom", status: "error", timestamp: 2 } as any;
  assert.equal(buildReActTrace([failed], "en").nodes.find((n) => n.kind === "read")?.title, "Observation failed");
});