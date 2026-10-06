/**
 * 全局语言设置（用户可见的「回答语言」）与界面文案字典。
 * ========================================================================
 * 这个模块是**前后端共用**的唯一定义处（server/ 侧本来就单向 import src/），
 * 所以：
 *   - 前端组件用它渲染界面文案、渲染设置页的语言下拉；
 *   - 服务端用它把 settings.language 归一成规范语言码，再注入 Agent 系统提示词。
 *
 * 为什么需要归一层（normalizeLanguagePreference）：
 * 设置项历史上写的是 `zh-CN`（BCP-47 写法），而 SUPPORTED_LANGUAGES / SearXNG
 * 一侧认的是两字母码 `zh`。两端各写各的时，`resolveTargetLanguage` 里的
 * `SUPPORTED_LANGUAGES[userPreference]` 查表直接 miss，于是「用户选了中文」
 * 这件事被静默吞掉、退化成「跟随查询语言」。这里统一按主语言子标签匹配。
 *
 * 约定：`AUTO_LANGUAGE = "auto"` 表示「不强制」，由 Agent 跟随用户查询语言作答
 * （沿用 codexConfig 里既有的 "Reply in the user's language" 语义）。
 */

export const AUTO_LANGUAGE = "auto";

export interface AppLanguageMeta {
  /** 规范两字母语言码，与 server/language.ts 的 SUPPORTED_LANGUAGES 键一致 */
  code: string;
  /** 该语言的英文名，写进系统提示词让模型明确知道要用哪种语言 */
  englishName: string;
  /** 该语言的本地名，用于设置页下拉展示（用户看母语最直观） */
  localName: string;
  flag: string;
}

/**
 * 设置页语言下拉的选项来源。
 *
 * 顺序与 server/language.ts 的 SUPPORTED_LANGUAGES 保持一致；SearXNG 的
 * locale 映射仍由那边负责，这里不重复声明 searxngCode，避免两份映射漂移。
 */
export const APP_LANGUAGES: AppLanguageMeta[] = [
  { code: "zh", englishName: "Chinese", localName: "中文", flag: "🇨🇳" },
  { code: "en", englishName: "English", localName: "English", flag: "🇺🇸" },
  { code: "ja", englishName: "Japanese", localName: "日本語", flag: "🇯🇵" },
  { code: "ko", englishName: "Korean", localName: "한국어", flag: "🇰🇷" },
  { code: "es", englishName: "Spanish", localName: "Español", flag: "🇪🇸" },
  { code: "fr", englishName: "French", localName: "Français", flag: "🇫🇷" },
  { code: "de", englishName: "German", localName: "Deutsch", flag: "🇩🇪" },
  { code: "ru", englishName: "Russian", localName: "Русский", flag: "🇷🇺" },
  { code: "pt", englishName: "Portuguese", localName: "Português", flag: "🇧🇷" },
  { code: "ar", englishName: "Arabic", localName: "العربية", flag: "🇸🇦" }
];

const LANGUAGE_BY_CODE = new Map(APP_LANGUAGES.map((l) => [l.code, l]));

/** 查语言元数据；未知码一律返回 undefined（调用方据此回退，不猜） */
export function getLanguageMeta(code: string | undefined): AppLanguageMeta | undefined {
  if (!code) return undefined;
  return LANGUAGE_BY_CODE.get(code);
}

/**
 * 把任意写法的语言设置归一成规范两字母码。
 *
 * - `zh-CN` / `zh_CN` / `ZH` → `zh`（按主语言子标签匹配，与 acceptLanguageFor 同思路）
 * - `auto` / 空 / undefined → `"auto"`（不强制，跟随查询语言）
 * - 无法识别的值 → `"auto"`（保守：不因为一个看不懂的设置值就锁死回答语言）
 */
export function normalizeLanguagePreference(raw: string | undefined | null): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return AUTO_LANGUAGE;
  const lower = trimmed.toLowerCase();
  if (lower === AUTO_LANGUAGE) return AUTO_LANGUAGE;
  const primary = lower.split(/[-_]/)[0];
  return LANGUAGE_BY_CODE.has(primary) ? primary : AUTO_LANGUAGE;
}

/** 是否强制指定语言（false = auto，Agent 跟随查询语言） */
export function isPinnedLanguage(raw: string | undefined | null): boolean {
  return normalizeLanguagePreference(raw) !== AUTO_LANGUAGE;
}

// ============================================================
// 界面文案字典
// ============================================================

export interface UiStrings {
  // ReAct 循环思维链
  reactExpand: string;
  reactCollapse: string;
  reactRunning: string;
  reactSynthesizing: string;
  reactEmpty: string;
  reactThought: (n: number) => string;
  reactAct: (n: number) => string;
  reactRead: (n: number) => string;
  /** 时间线折叠态标题 */
  reactHeader: string;
  /** Read 节点标题 */
  readResult: string;
  readFailed: string;
  /** Act 节点在步骤缺少 title 时的兜底标题 */
  toolGenericFallback: string;

  // AI 回答卡片
  aiTitle: string;
  aiThinking: string;
  aiCopyAll: string;
  aiCopied: string;
  aiCopy: string;
  aiFlip: string;
  aiProviderError: string;

  // 背面（元数据与信源溯源）
  aiBackTitle: string;
  aiBackToFront: string;
  aiMetricModel: string;
  aiMetricDuration: string;
  aiMetricSeconds: (n: number) => string;
  aiMetricChars: string;
  aiMetricCharCount: (n: number) => string;
  aiMetricSources: string;
  aiMetricSourceCount: (n: number) => string;
  aiKeySources: string;

  // 流式 / 空态 / 底部提示
  aiRetry: string;
  aiComposing: string;
  aiTurnEmpty: string;
  aiStreamingTitle: string;
  aiStreamingSub: string;
  aiEmptyTitle: string;
  aiEmptyHint: string;
  aiAskHint: string;
  aiSourceBasis: (n: number) => string;
  aiCopiedMarkdown: string;
  aiCopyMarkdown: string;

  // 代码块
  mdCopy: string;

  // 链接与信源展示（角标 / 预览卡 / 背面信源列表共用）
  linkOpenInTab: string;
  linkCopyUrl: string;
  linkCopied: string;
  linkUnmatchedSource: string;
  linkCitationLabel: (i: number) => string;

  // 服务端步骤标题（eventBridge 用同一套 key，保证前后端文案一致）
  toolSearchWeb: (q: string) => string;
  toolSearchImages: (q: string) => string;
  toolVerifySource: string;
  toolGetCatalog: string;
  toolPrepareWidget: (id: string) => string;
  toolSolveLayout: string;
  toolBrowserRead: (url: string) => string;
  toolInspectRepository: (r: string) => string;
  toolCreateAction: (label: string) => string;
  toolGeneric: (name: string) => string;
  toolArgs: (json: string) => string;
  reasoningTitle: string;
  reasoningAgentName: string;
  fallbackSummary: string;
}

const ZH: UiStrings = {
  reactExpand: "展开 ReAct 循环思维链",
  reactCollapse: "收起 ReAct 循环思维链",
  reactRunning: "执行中",
  reactSynthesizing: "归纳中",
  reactEmpty: "暂无 ReAct 循环记录",
  reactThought: (n) => `思考 ${n} 步`,
  reactAct: (n) => `调用 ${n} 次工具`,
  reactRead: (n) => `读回 ${n} 次`,
  reactHeader: "ReAct-Read 循环",
  readResult: "读回结果",
  readFailed: "读回失败",
  toolGenericFallback: "调用能力工具",

  aiTitle: "AI 智能回答",
  aiThinking: "正在思考中",
  aiCopyAll: "复制对话全文",
  aiCopied: "已复制",
  aiCopy: "复制",
  aiFlip: "翻转查看信源与元数据",
  aiProviderError: "AI 服务暂时不可用，已为你保留网页搜索结果",

  aiBackTitle: "AI 回答元数据与信源溯源",
  aiBackToFront: "返回正面",
  aiMetricModel: "推理模型",
  aiMetricDuration: "总耗时",
  aiMetricSeconds: (n) => `${n.toFixed(2)} 秒`,
  aiMetricChars: "字数统计",
  aiMetricCharCount: (n) => `${n} 字符`,
  aiMetricSources: "已研判信源",
  aiMetricSourceCount: (n) => `${n} 篇`,
  aiKeySources: "核心参引网页与文档",

  aiRetry: "重试",
  aiComposing: "正在组织深度回答...",
  aiTurnEmpty: "暂无回答内容",
  aiStreamingTitle: "Codex 智能体正在流式组织深度回答...",
  aiStreamingSub: "根据全网检索的权威信源交叉验证并撰写报告",
  aiEmptyTitle: "暂无 AI 回答内容",
  aiEmptyHint: "在顶部搜索栏输入问题即可获取 AI 回答",
  aiAskHint: "在顶部搜索栏输入即可继续提问",
  aiSourceBasis: (n) => `基于 ${n} 个权威信源多轮推理`,
  aiCopiedMarkdown: "已复制 Markdown",
  aiCopyMarkdown: "复制 Markdown 原文",

  mdCopy: "复制",

  // 链接与信源展示
  linkOpenInTab: "新标签页打开",
  linkCopyUrl: "复制链接",
  linkCopied: "已复制链接",
  linkUnmatchedSource: "未匹配到对应信源",
  linkCitationLabel: (i) => `引用 ${i}`,

  toolSearchWeb: (q) => `检索网络：${q}`,
  toolSearchImages: (q) => `检索配图：${q}`,
  toolVerifySource: "核验信源权威度与域安全",
  toolGetCatalog: "拉取组件注册中心完整目录",
  toolPrepareWidget: (id) => `绑定交付小组件：${id}`,
  toolSolveLayout: "装箱排版：计算 12 栅格最优错落布局",
  toolBrowserRead: (url) => `深度阅读页面：${url}`,
  toolInspectRepository: (r) => `检查开源仓库状态：${r}`,
  toolCreateAction: (label) => `生成可执行操作卡片：${label}`,
  toolGeneric: (name) => `调用能力工具 [${name}]`,
  toolArgs: (json) => `参数: ${json}`,
  reasoningTitle: "检索推理",
  reasoningAgentName: "检索推理层",
  fallbackSummary: "已完成检索并生成回答。"
};

const EN: UiStrings = {
  reactExpand: "Expand ReAct loop",
  reactCollapse: "Collapse ReAct loop",
  reactRunning: "Running",
  reactSynthesizing: "Synthesizing",
  reactEmpty: "No ReAct loop records",
  reactThought: (n) => `${n} thought step${n === 1 ? "" : "s"}`,
  reactAct: (n) => `${n} tool call${n === 1 ? "" : "s"}`,
  reactRead: (n) => `${n} observation${n === 1 ? "" : "s"}`,
  reactHeader: "ReAct-Read loop",
  readResult: "Observation",
  readFailed: "Observation failed",
  toolGenericFallback: "Tool call",

  aiTitle: "AI Answer",
  aiThinking: "Thinking...",
  aiCopyAll: "Copy full answer",
  aiCopied: "Copied",
  aiCopy: "Copy",
  aiFlip: "Flip to view sources and metadata",
  aiProviderError: "AI service is temporarily unavailable. Web search results are still shown.",

  aiBackTitle: "AI Answer Metadata and Source Traceability",
  aiBackToFront: "Back to answer",
  aiMetricModel: "Reasoning model",
  aiMetricDuration: "Total time",
  aiMetricSeconds: (n) => `${n.toFixed(2)} s`,
  aiMetricChars: "Character count",
  aiMetricCharCount: (n) => `${n} characters`,
  aiMetricSources: "Sources assessed",
  aiMetricSourceCount: (n) => `${n}`,
  aiKeySources: "Key cited pages and documents",

  aiRetry: "Retry",
  aiComposing: "Composing a deep answer...",
  aiTurnEmpty: "No answer content yet",
  aiStreamingTitle: "The Codex agent is streaming a deep answer...",
  aiStreamingSub: "Cross-verifying authoritative sources from across the web and writing the report",
  aiEmptyTitle: "No AI answer yet",
  aiEmptyHint: "Type a question in the search bar above to get an AI answer",
  aiAskHint: "Use the search bar above to keep asking",
  aiSourceBasis: (n) => `Multi-round reasoning over ${n} authoritative source${n === 1 ? "" : "s"}`,
  aiCopiedMarkdown: "Markdown copied",
  aiCopyMarkdown: "Copy raw Markdown",

  mdCopy: "Copy",

  // 链接与信源展示
  linkOpenInTab: "Open in new tab",
  linkCopyUrl: "Copy link",
  linkCopied: "Link copied",
  linkUnmatchedSource: "No matching source",
  linkCitationLabel: (i) => `Citation ${i}`,

  toolSearchWeb: (q) => `Search the web: ${q}`,
  toolSearchImages: (q) => `Search images: ${q}`,
  toolVerifySource: "Verify source credibility and domain safety",
  toolGetCatalog: "Fetch the full widget registry catalog",
  toolPrepareWidget: (id) => `Bind widget: ${id}`,
  toolSolveLayout: "Solve layout: compute the 12-column grid placement",
  toolBrowserRead: (url) => `Deep-read page: ${url}`,
  toolInspectRepository: (r) => `Inspect repository: ${r}`,
  toolCreateAction: (label) => `Create action card: ${label}`,
  toolGeneric: (name) => `Call tool [${name}]`,
  toolArgs: (json) => `Args: ${json}`,
  reasoningTitle: "Search reasoning",
  reasoningAgentName: "Retrieval reasoning layer",
  fallbackSummary: "Search completed and an answer was generated."
};

const JA: UiStrings = {
  reactExpand: "ReAct ループを展開",
  reactCollapse: "ReAct ループを折りたたむ",
  reactRunning: "実行中",
  reactSynthesizing: "要約中",
  reactEmpty: "ReAct ループの記録はありません",
  reactThought: (n) => `思考 ${n} ステップ`,
  reactAct: (n) => `ツール ${n} 回呼び出し`,
  reactRead: (n) => `読み取り ${n} 回`,
  reactHeader: "ReAct-Read ループ",
  readResult: "読み取り結果",
  readFailed: "読み取り失敗",
  toolGenericFallback: "ツール呼び出し",

  aiTitle: "AI 回答",
  aiThinking: "思考中...",
  aiCopyAll: "回答全文をコピー",
  aiCopied: "コピーしました",
  aiCopy: "コピー",
  aiFlip: "情報源とメタデータを表示",
  aiProviderError: "AI サービスは一時的に利用できません。ウェブ検索結果は表示しています。",

  aiBackTitle: "AI 回答のメタデータと情報源の追跡",
  aiBackToFront: "本文に戻る",
  aiMetricModel: "推論モデル",
  aiMetricDuration: "所要時間",
  aiMetricSeconds: (n) => `${n.toFixed(2)} 秒`,
  aiMetricChars: "文字数",
  aiMetricCharCount: (n) => `${n} 文字`,
  aiMetricSources: "評価した情報源",
  aiMetricSourceCount: (n) => `${n} 件`,
  aiKeySources: "主な引用元ページと資料",

  aiRetry: "再試行",
  aiComposing: "詳細な回答を作成しています...",
  aiTurnEmpty: "回答内容がまだありません",
  aiStreamingTitle: "Codex エージェントが詳細な回答をストリーミングしています...",
  aiStreamingSub: "ウェブ全体の信頼できる情報源を照合しながらレポートを作成しています",
  aiEmptyTitle: "AI 回答はまだありません",
  aiEmptyHint: "上部の検索バーに質問を入力すると AI 回答が得られます",
  aiAskHint: "上部の検索バーから続けて質問できます",
  aiSourceBasis: (n) => `${n} 件の信頼できる情報源に基づく複数ラウンドの推論`,
  aiCopiedMarkdown: "Markdown をコピーしました",
  aiCopyMarkdown: "Markdown 原文をコピー",

  mdCopy: "コピー",

  // 链接与信源展示
  linkOpenInTab: "新しいタブで開く",
  linkCopyUrl: "リンクをコピー",
  linkCopied: "リンクをコピーしました",
  linkUnmatchedSource: "対応する情報源が見つかりません",
  linkCitationLabel: (i) => `参照 ${i}`,

  toolSearchWeb: (q) => `ウェブ検索: ${q}`,
  toolSearchImages: (q) => `画像検索: ${q}`,
  toolVerifySource: "情報源の信頼性とドメイン安全性を検証",
  toolGetCatalog: "ウィジェット登録カタログ全体を取得",
  toolPrepareWidget: (id) => `ウィジェットをバインド: ${id}`,
  toolSolveLayout: "レイアウト解決: 12 列グリッドを計算",
  toolBrowserRead: (url) => `ページを詳細に読み取り: ${url}`,
  toolInspectRepository: (r) => `リポジトリを確認: ${r}`,
  toolCreateAction: (label) => `操作カードを作成: ${label}`,
  toolGeneric: (name) => `ツール呼び出し [${name}]`,
  toolArgs: (json) => `引数: ${json}`,
  reasoningTitle: "検索推論",
  reasoningAgentName: "検索推論レイヤー",
  fallbackSummary: "検索が完了し、回答を生成しました。"
};

const KO: UiStrings = {
  reactExpand: "ReAct 루프 펼치기",
  reactCollapse: "ReAct 루프 접기",
  reactRunning: "실행 중",
  reactSynthesizing: "요약 중",
  reactEmpty: "ReAct 루프 기록이 없습니다",
  reactThought: (n) => `사고 ${n} 단계`,
  reactAct: (n) => `도구 ${n}회 호출`,
  reactRead: (n) => `관찰 ${n}회`,
  reactHeader: "ReAct-Read 루프",
  readResult: "관찰 결과",
  readFailed: "관찰 실패",
  toolGenericFallback: "도구 호출",

  aiTitle: "AI 답변",
  aiThinking: "생각 중...",
  aiCopyAll: "답변 전체 복사",
  aiCopied: "복사됨",
  aiCopy: "복사",
  aiFlip: "출처와 메타데이터 보기",
  aiProviderError: "AI 서비스를 일시적으로 사용할 수 없습니다. 웹 검색 결과는 표시됩니다.",

  aiBackTitle: "AI 답변 메타데이터 및 출처 추적",
  aiBackToFront: "본문으로 돌아가기",
  aiMetricModel: "추론 모델",
  aiMetricDuration: "총 소요 시간",
  aiMetricSeconds: (n) => `${n.toFixed(2)}초`,
  aiMetricChars: "글자 수",
  aiMetricCharCount: (n) => `${n}자`,
  aiMetricSources: "검토한 출처",
  aiMetricSourceCount: (n) => `${n}개`,
  aiKeySources: "핵심 인용 페이지 및 문서",

  aiRetry: "다시 시도",
  aiComposing: "깊은 답변을 작성하는 중...",
  aiTurnEmpty: "아직 답변 내용이 없습니다",
  aiStreamingTitle: "Codex 에이전트가 깊은 답변을 스트리밍 중...",
  aiStreamingSub: "웹 전역의 권위 있는 출처를 교차 검증하며 보고서를 작성합니다",
  aiEmptyTitle: "아직 AI 답변이 없습니다",
  aiEmptyHint: "위 검색창에 질문을 입력하면 AI 답변을 받을 수 있습니다",
  aiAskHint: "위 검색창에서 계속 질문할 수 있습니다",
  aiSourceBasis: (n) => `권위 있는 출처 ${n}개에 기반한 다중 라운드 추론`,
  aiCopiedMarkdown: "Markdown 복사됨",
  aiCopyMarkdown: "Markdown 원문 복사",

  mdCopy: "복사",

  // 链接与信源展示
  linkOpenInTab: "새 탭에서 열기",
  linkCopyUrl: "링크 복사",
  linkCopied: "링크를 복사했습니다",
  linkUnmatchedSource: "일치하는 출처가 없습니다",
  linkCitationLabel: (i) => `인용 ${i}`,

  toolSearchWeb: (q) => `웹 검색: ${q}`,
  toolSearchImages: (q) => `이미지 검색: ${q}`,
  toolVerifySource: "출처 신뢰도와 도메인 안전성 검증",
  toolGetCatalog: "위젯 레지스트리 전체 카탈로그 조회",
  toolPrepareWidget: (id) => `위젯 바인딩: ${id}`,
  toolSolveLayout: "레이아웃 해결: 12열 그리드 계산",
  toolBrowserRead: (url) => `페이지 심층 읽기: ${url}`,
  toolInspectRepository: (r) => `저장소 확인: ${r}`,
  toolCreateAction: (label) => `작업 카드 생성: ${label}`,
  toolGeneric: (name) => `도구 호출 [${name}]`,
  toolArgs: (json) => `인자: ${json}`,
  reasoningTitle: "검색 추론",
  reasoningAgentName: "검색 추론 레이어",
  fallbackSummary: "검색을 완료하고 답변을 생성했습니다."
};

const ES: UiStrings = {
  reactExpand: "Desplegar bucle ReAct",
  reactCollapse: "Plegar bucle ReAct",
  reactRunning: "En ejecución",
  reactSynthesizing: "Sintetizando",
  reactEmpty: "Sin registros del bucle ReAct",
  reactThought: (n) => `${n} paso${n === 1 ? "" : "s"} de razonamiento`,
  reactAct: (n) => `${n} llamada${n === 1 ? "" : "s"} a herramienta`,
  reactRead: (n) => `${n} observaci${n === 1 ? "ón" : "ones"}`,
  reactHeader: "Bucle ReAct-Read",
  readResult: "Observación",
  readFailed: "Observación fallida",
  toolGenericFallback: "Llamada a herramienta",

  aiTitle: "Respuesta de IA",
  aiThinking: "Pensando...",
  aiCopyAll: "Copiar respuesta completa",
  aiCopied: "Copiado",
  aiCopy: "Copiar",
  aiFlip: "Ver fuentes y metadatos",
  aiProviderError: "El servicio de IA no está disponible temporalmente. Se mantienen los resultados de búsqueda web.",

  aiBackTitle: "Metadatos de la respuesta de IA y trazabilidad de fuentes",
  aiBackToFront: "Volver a la respuesta",
  aiMetricModel: "Modelo de razonamiento",
  aiMetricDuration: "Tiempo total",
  aiMetricSeconds: (n) => `${n.toFixed(2)} s`,
  aiMetricChars: "Número de caracteres",
  aiMetricCharCount: (n) => `${n} caracteres`,
  aiMetricSources: "Fuentes evaluadas",
  aiMetricSourceCount: (n) => `${n}`,
  aiKeySources: "Páginas y documentos citados clave",

  aiRetry: "Reintentar",
  aiComposing: "Componiendo una respuesta detallada...",
  aiTurnEmpty: "Aún no hay contenido de respuesta",
  aiStreamingTitle: "El agente Codex está generando una respuesta detallada...",
  aiStreamingSub: "Contrastando fuentes autorizadas de todo el web y redactando el informe",
  aiEmptyTitle: "Aún no hay respuesta de IA",
  aiEmptyHint: "Escribe una pregunta en la barra de búsqueda para obtener una respuesta de IA",
  aiAskHint: "Usa la barra de búsqueda para seguir preguntando",
  aiSourceBasis: (n) => `Razonamiento de varias rondas sobre ${n} fuente${n === 1 ? "" : "s"} autorizada${n === 1 ? "" : "s"}`,
  aiCopiedMarkdown: "Markdown copiado",
  aiCopyMarkdown: "Copiar Markdown original",

  mdCopy: "Copiar",

  // 链接与信源展示
  linkOpenInTab: "Abrir en pestaña nueva",
  linkCopyUrl: "Copiar enlace",
  linkCopied: "Enlace copiado",
  linkUnmatchedSource: "Sin fuente coincidente",
  linkCitationLabel: (i) => `Cita ${i}`,

  toolSearchWeb: (q) => `Buscar en la web: ${q}`,
  toolSearchImages: (q) => `Buscar imágenes: ${q}`,
  toolVerifySource: "Verificar credibilidad de la fuente y seguridad del dominio",
  toolGetCatalog: "Obtener el catálogo completo del registro de widgets",
  toolPrepareWidget: (id) => `Vincular widget: ${id}`,
  toolSolveLayout: "Resolver diseño: calcular la cuadrícula de 12 columnas",
  toolBrowserRead: (url) => `Leer la página en profundidad: ${url}`,
  toolInspectRepository: (r) => `Inspeccionar repositorio: ${r}`,
  toolCreateAction: (label) => `Crear tarjeta de acción: ${label}`,
  toolGeneric: (name) => `Llamar herramienta [${name}]`,
  toolArgs: (json) => `Argumentos: ${json}`,
  reasoningTitle: "Razonamiento de búsqueda",
  reasoningAgentName: "Capa de razonamiento de recuperación",
  fallbackSummary: "Búsqueda completada y respuesta generada."
};

const FR: UiStrings = {
  reactExpand: "Déplier la boucle ReAct",
  reactCollapse: "Replier la boucle ReAct",
  reactRunning: "En cours",
  reactSynthesizing: "Synthèse en cours",
  reactEmpty: "Aucun enregistrement de boucle ReAct",
  reactThought: (n) => `${n} étape${n === 1 ? "" : "s"} de réflexion`,
  reactAct: (n) => `${n} appel${n === 1 ? "" : "s"} d'outil`,
  reactRead: (n) => `${n} observation${n === 1 ? "" : "s"}`,
  reactHeader: "Boucle ReAct-Read",
  readResult: "Observation",
  readFailed: "Observation échouée",
  toolGenericFallback: "Appel d'outil",

  aiTitle: "Réponse IA",
  aiThinking: "Réflexion en cours...",
  aiCopyAll: "Copier toute la réponse",
  aiCopied: "Copié",
  aiCopy: "Copier",
  aiFlip: "Voir les sources et les métadonnées",
  aiProviderError: "Le service IA est temporairement indisponible. Les résultats de recherche web restent affichés.",

  aiBackTitle: "Métadonnées de la réponse IA et traçabilité des sources",
  aiBackToFront: "Retour à la réponse",
  aiMetricModel: "Modèle de raisonnement",
  aiMetricDuration: "Durée totale",
  aiMetricSeconds: (n) => `${n.toFixed(2)} s`,
  aiMetricChars: "Nombre de caractères",
  aiMetricCharCount: (n) => `${n} caractères`,
  aiMetricSources: "Sources évaluées",
  aiMetricSourceCount: (n) => `${n}`,
  aiKeySources: "Pages et documents cités",

  aiRetry: "Réessayer",
  aiComposing: "Composition d'une réponse détaillée...",
  aiTurnEmpty: "Aucun contenu de réponse",
  aiStreamingTitle: "L'agent Codex génère une réponse détaillée...",
  aiStreamingSub: "Confrontation des sources faisant autorité du web et rédaction du rapport",
  aiEmptyTitle: "Aucune réponse IA pour le moment",
  aiEmptyHint: "Posez une question dans la barre de recherche pour obtenir une réponse IA",
  aiAskHint: "Utilisez la barre de recherche pour continuer",
  aiSourceBasis: (n) => `Raisonnement sur ${n} source${n === 1 ? "" : "s"} faisant autorité`,
  aiCopiedMarkdown: "Markdown copié",
  aiCopyMarkdown: "Copier le Markdown brut",

  mdCopy: "Copier",

  // 链接与信源展示
  linkOpenInTab: "Ouvrir dans un nouvel onglet",
  linkCopyUrl: "Copier le lien",
  linkCopied: "Lien copié",
  linkUnmatchedSource: "Aucune source correspondante",
  linkCitationLabel: (i) => `Citation ${i}`,

  toolSearchWeb: (q) => `Recherche web : ${q}`,
  toolSearchImages: (q) => `Recherche d'images : ${q}`,
  toolVerifySource: "Vérifier la crédibilité de la source et la sécurité du domaine",
  toolGetCatalog: "Récupérer le catalogue complet du registre de widgets",
  toolPrepareWidget: (id) => `Associer le widget : ${id}`,
  toolSolveLayout: "Résoudre la mise en page : calculer la grille à 12 colonnes",
  toolBrowserRead: (url) => `Lecture approfondie de la page : ${url}`,
  toolInspectRepository: (r) => `Inspecter le dépôt : ${r}`,
  toolCreateAction: (label) => `Créer une carte d'action : ${label}`,
  toolGeneric: (name) => `Appel d'outil [${name}]`,
  toolArgs: (json) => `Arguments : ${json}`,
  reasoningTitle: "Raisonnement de recherche",
  reasoningAgentName: "Couche de raisonnement de récupération",
  fallbackSummary: "Recherche terminée et réponse générée."
};

const DE: UiStrings = {
  reactExpand: "ReAct-Schleife ausklappen",
  reactCollapse: "ReAct-Schleife einklappen",
  reactRunning: "Läuft",
  reactSynthesizing: "Wird zusammengefasst",
  reactEmpty: "Keine ReAct-Schleifen aufgezeichnet",
  reactThought: (n) => `${n} Denkschritt${n === 1 ? "" : "e"}`,
  reactAct: (n) => `${n} Werkzeugaufruf${n === 1 ? "" : "e"}`,
  reactRead: (n) => `${n} Beobachtung${n === 1 ? "" : "en"}`,
  reactHeader: "ReAct-Read-Schleife",
  readResult: "Beobachtung",
  readFailed: "Beobachtung fehlgeschlagen",
  toolGenericFallback: "Werkzeugaufruf",

  aiTitle: "KI-Antwort",
  aiThinking: "Denkt nach...",
  aiCopyAll: "Gesamte Antwort kopieren",
  aiCopied: "Kopiert",
  aiCopy: "Kopieren",
  aiFlip: "Quellen und Metadaten anzeigen",
  aiProviderError: "Der KI-Dienst ist vorübergehend nicht verfügbar. Die Web-Suchergebnisse bleiben sichtbar.",

  aiBackTitle: "KI-Antwort-Metadaten und Quellen-Nachvollziehbarkeit",
  aiBackToFront: "Zurück zur Antwort",
  aiMetricModel: "Reasoning-Modell",
  aiMetricDuration: "Gesamtdauer",
  aiMetricSeconds: (n) => `${n.toFixed(2)} s`,
  aiMetricChars: "Zeichenanzahl",
  aiMetricCharCount: (n) => `${n} Zeichen`,
  aiMetricSources: "Bewertete Quellen",
  aiMetricSourceCount: (n) => `${n}`,
  aiKeySources: "Wichtigste zitierte Seiten und Dokumente",

  aiRetry: "Erneut versuchen",
  aiComposing: "Vertiefte Antwort wird erstellt...",
  aiTurnEmpty: "Noch kein Antwortinhalt",
  aiStreamingTitle: "Der Codex-Agent erstellt eine vertiefte Antwort...",
  aiStreamingSub: "Belastbare Quellen aus dem gesamten Web werden abgeglichen und der Bericht geschrieben",
  aiEmptyTitle: "Noch keine KI-Antwort",
  aiEmptyHint: "Gib oben in der Suchleiste eine Frage ein, um eine KI-Antwort zu erhalten",
  aiAskHint: "Weiter fragen kannst du oben in der Suchleiste",
  aiSourceBasis: (n) => `Mehrstufiges Reasoning über ${n} belastbare${n === 1 ? " Quelle" : " Quellen"}`,
  aiCopiedMarkdown: "Markdown kopiert",
  aiCopyMarkdown: "Roh-Markdown kopieren",

  mdCopy: "Kopieren",

  // 链接与信源展示
  linkOpenInTab: "In neuem Tab öffnen",
  linkCopyUrl: "Link kopieren",
  linkCopied: "Link kopiert",
  linkUnmatchedSource: "Keine passende Quelle",
  linkCitationLabel: (i) => `Zitat ${i}`,

  toolSearchWeb: (q) => `Websuche: ${q}`,
  toolSearchImages: (q) => `Bildersuche: ${q}`,
  toolVerifySource: "Quellen-Glaubwürdigkeit und Domain-Sicherheit prüfen",
  toolGetCatalog: "Vollständigen Widget-Registry-Katalog abrufen",
  toolPrepareWidget: (id) => `Widget binden: ${id}`,
  toolSolveLayout: "Layout berechnen: 12-Spalten-Raster bestimmen",
  toolBrowserRead: (url) => `Seite gründlich lesen: ${url}`,
  toolInspectRepository: (r) => `Repository prüfen: ${r}`,
  toolCreateAction: (label) => `Aktionskarte erstellen: ${label}`,
  toolGeneric: (name) => `Werkzeug aufrufen [${name}]`,
  toolArgs: (json) => `Argumente: ${json}`,
  reasoningTitle: "Suchschlussfolgerung",
  reasoningAgentName: "Retrieval-Reasoning-Ebene",
  fallbackSummary: "Suche abgeschlossen und Antwort erzeugt."
};

const RU: UiStrings = {
  reactExpand: "Развернуть цикл ReAct",
  reactCollapse: "Свернуть цикл ReAct",
  reactRunning: "Выполняется",
  reactSynthesizing: "Обобщение",
  reactEmpty: "Нет записей цикла ReAct",
  reactThought: (n) => `Шагов рассуждения: ${n}`,
  reactAct: (n) => `Вызовов инструментов: ${n}`,
  reactRead: (n) => `Наблюдений: ${n}`,
  reactHeader: "Цикл ReAct-Read",
  readResult: "Результат наблюдения",
  readFailed: "Наблюдение не удалось",
  toolGenericFallback: "Вызов инструмента",

  aiTitle: "Ответ ИИ",
  aiThinking: "Думаю...",
  aiCopyAll: "Копировать весь ответ",
  aiCopied: "Скопировано",
  aiCopy: "Копировать",
  aiFlip: "Показать источники и метаданные",
  aiProviderError: "Сервис ИИ временно недоступен. Результаты веб-поиска по-прежнему показаны.",

  aiBackTitle: "Метаданные ответа ИИ и трассируемость источников",
  aiBackToFront: "Назад к ответу",
  aiMetricModel: "Модель рассуждения",
  aiMetricDuration: "Общее время",
  aiMetricSeconds: (n) => `${n.toFixed(2)} с`,
  aiMetricChars: "Количество символов",
  aiMetricCharCount: (n) => `${n} символов`,
  aiMetricSources: "Оценённые источники",
  aiMetricSourceCount: (n) => `${n}`,
  aiKeySources: "Ключевые цитируемые страницы и документы",

  aiRetry: "Повторить",
  aiComposing: "Формируется подробный ответ...",
  aiTurnEmpty: "Пока нет содержимого ответа",
  aiStreamingTitle: "Агент Codex формирует подробный ответ...",
  aiStreamingSub: "Сверяются авторитетные источники со всего веба и пишется отчёт",
  aiEmptyTitle: "Ответа ИИ пока нет",
  aiEmptyHint: "Введите вопрос в строке поиска выше, чтобы получить ответ ИИ",
  aiAskHint: "Продолжайте спрашивать в строке поиска выше",
  aiSourceBasis: (n) => `Многошаговое рассуждение по ${n} авторитетным источникам`,
  aiCopiedMarkdown: "Markdown скопирован",
  aiCopyMarkdown: "Копировать исходный Markdown",

  mdCopy: "Копировать",

  // 链接与信源展示
  linkOpenInTab: "Открыть в новой вкладке",
  linkCopyUrl: "Копировать ссылку",
  linkCopied: "Ссылка скопирована",
  linkUnmatchedSource: "Источник не найден",
  linkCitationLabel: (i) => `Цитата ${i}`,

  toolSearchWeb: (q) => `Поиск в вебе: ${q}`,
  toolSearchImages: (q) => `Поиск изображений: ${q}`,
  toolVerifySource: "Проверка достоверности источника и безопасности домена",
  toolGetCatalog: "Получить полный каталог реестра виджетов",
  toolPrepareWidget: (id) => `Привязать виджет: ${id}`,
  toolSolveLayout: "Расчёт раскладки: вычислить сетку из 12 колонок",
  toolBrowserRead: (url) => `Глубокое чтение страницы: ${url}`,
  toolInspectRepository: (r) => `Проверить репозиторий: ${r}`,
  toolCreateAction: (label) => `Создать карточку действия: ${label}`,
  toolGeneric: (name) => `Вызов инструмента [${name}]`,
  toolArgs: (json) => `Аргументы: ${json}`,
  reasoningTitle: "Поисковое рассуждение",
  reasoningAgentName: "Слой поискового рассуждения",
  fallbackSummary: "Поиск завершён, ответ сформирован."
};

const PT: UiStrings = {
  reactExpand: "Expandir ciclo ReAct",
  reactCollapse: "Recolher ciclo ReAct",
  reactRunning: "Em execução",
  reactSynthesizing: "Sintetizando",
  reactEmpty: "Sem registos do ciclo ReAct",
  reactThought: (n) => `${n} passo${n === 1 ? "" : "s"} de raciocínio`,
  reactAct: (n) => `${n} chamada${n === 1 ? "" : "s"} de ferramenta`,
  reactRead: (n) => `${n} observaç${n === 1 ? "ão" : "ões"}`,
  reactHeader: "Ciclo ReAct-Read",
  readResult: "Observação",
  readFailed: "Observação falhou",
  toolGenericFallback: "Chamada de ferramenta",

  aiTitle: "Resposta da IA",
  aiThinking: "A pensar...",
  aiCopyAll: "Copiar resposta completa",
  aiCopied: "Copiado",
  aiCopy: "Copiar",
  aiFlip: "Ver fontes e metadados",
  aiProviderError: "O serviço de IA está temporariamente indisponível. Os resultados da pesquisa web são mantidos.",

  aiBackTitle: "Metadados da resposta da IA e rastreabilidade das fontes",
  aiBackToFront: "Voltar à resposta",
  aiMetricModel: "Modelo de raciocínio",
  aiMetricDuration: "Tempo total",
  aiMetricSeconds: (n) => `${n.toFixed(2)} s`,
  aiMetricChars: "Número de caracteres",
  aiMetricCharCount: (n) => `${n} caracteres`,
  aiMetricSources: "Fontes avaliadas",
  aiMetricSourceCount: (n) => `${n}`,
  aiKeySources: "Páginas e documentos citados principais",

  aiRetry: "Tentar novamente",
  aiComposing: "A compor uma resposta detalhada...",
  aiTurnEmpty: "Ainda sem conteúdo de resposta",
  aiStreamingTitle: "O agente Codex está a gerar uma resposta detalhada...",
  aiStreamingSub: "A cruzar fontes autorizadas de toda a web e a redigir o relatório",
  aiEmptyTitle: "Ainda não há resposta da IA",
  aiEmptyHint: "Escreva uma pergunta na barra de pesquisa para obter uma resposta da IA",
  aiAskHint: "Use a barra de pesquisa para continuar a perguntar",
  aiSourceBasis: (n) => `Raciocínio de várias rondas sobre ${n} fonte${n === 1 ? "" : "s"} autorizada${n === 1 ? "" : "s"}`,
  aiCopiedMarkdown: "Markdown copiado",
  aiCopyMarkdown: "Copiar Markdown original",

  mdCopy: "Copiar",

  // 链接与信源展示
  linkOpenInTab: "Abrir em nova aba",
  linkCopyUrl: "Copiar link",
  linkCopied: "Link copiado",
  linkUnmatchedSource: "Nenhuma fonte correspondente",
  linkCitationLabel: (i) => `Citação ${i}`,

  toolSearchWeb: (q) => `Pesquisar na web: ${q}`,
  toolSearchImages: (q) => `Pesquisar imagens: ${q}`,
  toolVerifySource: "Verificar credibilidade da fonte e segurança do domínio",
  toolGetCatalog: "Obter o catálogo completo do registo de widgets",
  toolPrepareWidget: (id) => `Associar widget: ${id}`,
  toolSolveLayout: "Resolver layout: calcular a grelha de 12 colunas",
  toolBrowserRead: (url) => `Ler a página em profundidade: ${url}`,
  toolInspectRepository: (r) => `Inspecionar repositório: ${r}`,
  toolCreateAction: (label) => `Criar cartão de ação: ${label}`,
  toolGeneric: (name) => `Chamar ferramenta [${name}]`,
  toolArgs: (json) => `Argumentos: ${json}`,
  reasoningTitle: "Raciocínio de pesquisa",
  reasoningAgentName: "Camada de raciocínio de recuperação",
  fallbackSummary: "Pesquisa concluída e resposta gerada."
};

const AR: UiStrings = {
  reactExpand: "توسيع حلقة ReAct",
  reactCollapse: "طي حلقة ReAct",
  reactRunning: "قيد التنفيذ",
  reactSynthesizing: "جارٍ التلخيص",
  reactEmpty: "لا توجد سجلات لحلقة ReAct",
  reactThought: (n) => `${n} خطوة تفكير`,
  reactAct: (n) => `${n} استدعاء أداة`,
  reactRead: (n) => `${n} ملاحظة`,
  reactHeader: "حلقة ReAct-Read",
  readResult: "نتيجة الملاحظة",
  readFailed: "فشلت الملاحظة",
  toolGenericFallback: "استدعاء أداة",

  aiTitle: "إجابة الذكاء الاصطناعي",
  aiThinking: "جارٍ التفكير...",
  aiCopyAll: "نسخ الإجابة كاملة",
  aiCopied: "تم النسخ",
  aiCopy: "نسخ",
  aiFlip: "عرض المصادر والبيانات الوصفية",
  aiProviderError: "خدمة الذكاء الاصطناعي غير متاحة مؤقتًا. لا تزال نتائج البحث على الويب معروضة.",

  aiBackTitle: "بيانات وصفية للإجابة وتتبع المصادر",
  aiBackToFront: "العودة إلى الإجابة",
  aiMetricModel: "نموذج الاستدلال",
  aiMetricDuration: "الإجمالي الزمني",
  aiMetricSeconds: (n) => `${n.toFixed(2)} ث`,
  aiMetricChars: "عدد الأحرف",
  aiMetricCharCount: (n) => `${n} حرف`,
  aiMetricSources: "المصادر المُقيَّمة",
  aiMetricSourceCount: (n) => `${n}`,
  aiKeySources: "الصفحات والمستندات المستشهدة الأساسية",

  aiRetry: "إعادة المحاولة",
  aiComposing: "جارٍ صياغة إجابة مفصّلة...",
  aiTurnEmpty: "لا يوجد محتوى للرد بعد",
  aiStreamingTitle: "وكيل Codex يُنشئ إجابة مفصّلة...",
  aiStreamingSub: "تُقارَن المصادر الموثوقة من كامل الويب وتُكتب التقرير",
  aiEmptyTitle: "لا توجد إجابة من الذكاء الاصطناعي بعد",
  aiEmptyHint: "اكتب سؤالك في شريط البحث أعلى الصفحة للحصول على إجابة",
  aiAskHint: "استخدم شريط البحث أعلى الصفحة لمتابعة الأسئلة",
  aiSourceBasis: (n) => `استدلال متعدد الجولات عبر ${n} من المصادر الموثوقة`,
  aiCopiedMarkdown: "تم نسخ Markdown",
  aiCopyMarkdown: "نسخ Markdown الأصلي",

  mdCopy: "نسخ",

  // 链接与信源展示
  linkOpenInTab: "فتح في تبويب جديد",
  linkCopyUrl: "نسخ الرابط",
  linkCopied: "تم نسخ الرابط",
  linkUnmatchedSource: "لا يوجد مصدر مطابق",
  linkCitationLabel: (i) => `اقتباس ${i}`,

  toolSearchWeb: (q) => `البحث في الويب: ${q}`,
  toolSearchImages: (q) => `البحث عن صور: ${q}`,
  toolVerifySource: "التحقق من مصداقية المصدر وأمان النطاق",
  toolGetCatalog: "جلب كتالوج سجل الأدوات الكامل",
  toolPrepareWidget: (id) => `ربط الأداة: ${id}`,
  toolSolveLayout: "حساب التخطيط: احسب شبكة من 12 عمودًا",
  toolBrowserRead: (url) => `قراءة متعمقة للصفحة: ${url}`,
  toolInspectRepository: (r) => `فحص المستودع: ${r}`,
  toolCreateAction: (label) => `إنشاء بطاقة إجراء: ${label}`,
  toolGeneric: (name) => `استدعاء أداة [${name}]`,
  toolArgs: (json) => `المعاملات: ${json}`,
  reasoningTitle: "استدلال البحث",
  reasoningAgentName: "طبقة الاستدلال الاسترجاعي",
  fallbackSummary: "اكتمل البحث وتم توليد الإجابة."
};

const UI_STRINGS: Record<string, UiStrings> = {
  zh: ZH,
  en: EN,
  ja: JA,
  ko: KO,
  es: ES,
  fr: FR,
  de: DE,
  ru: RU,
  pt: PT,
  ar: AR
};

/**
 * 取界面文案。未知语言一律回退中文，而不是抛错 ——
 * 界面文案缺失不该让整个组件崩掉。
 */
export function getUiStrings(language: string | undefined | null): UiStrings {
  return UI_STRINGS[normalizeLanguagePreference(language)] ?? ZH;
}