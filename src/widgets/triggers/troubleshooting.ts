import type { SearchResult } from "../../types.js";

/**
 * 故障排查小组件多维启发式触发器与评分模型 (Troubleshooting Heuristic Scoring Engine)
 * ==============================================================================
 * 拒绝简单的 `query.includes("解决")` 单点断言，采用五维正向打分 + 负向衰减多层判据：
 * 1. 显式报错排查关键词 (Explicit Keywords)
 * 2. 错误码与典型异常特征正则 (Error Code Patterns)
 * 3. 失败句式与故障问句结构 (Failure Sentence Patterns)
 * 4. 运行环境与技术栈上下文 (Environment Context)
 * 5. 全网信源与 Issue 证据链 (Search Result Evidence)
 * 6. 负向意图柔性惩罚机制 (Negative Keyword Penalization, 衰减而非一票否决)
 */

export interface TroubleshootingTriggerResult {
  score: number; // 0 - 100
  confidence: number; // 0.0 - 1.0
  triggered: boolean;
  errorCodes: string[];
  matchedKeywords: string[];
  penaltyKeywords: string[];
  reasons: string[];
  environmentContext?: {
    platform?: string;
    runtime?: string;
    targetTool?: string;
  };
}

/** 1. 显式报错排查关键词词典 */
const EXPLICIT_KEYWORDS = [
  { pattern: /报错|错误|异常/i, weight: 35, label: "包含显式报错/异常关键词" },
  { pattern: /崩溃|闪退|无法启动|启动失败|打不开/i, weight: 40, label: "包含系统崩溃或无法启动表述" },
  { pattern: /安装失败|依赖冲突|编译失败|构建报错|编译错误/i, weight: 40, label: "包含安装/构建/依赖冲突现象" },
  { pattern: /解决办法|排查|排错|排障|故障|修复|避坑/i, weight: 30, label: "包含显式故障修复与排障诉求" },
  { pattern: /\b(error|failed|failure|exception|crash|fatal|segfault)\b/i, weight: 35, label: "包含英文 Error/Fatal 标识" },
  { pattern: /\b(cannot start|fail to start|unable to connect|timed out|rejected|denied)\b/i, weight: 35, label: "包含英文无法连接/启动/拒绝表述" },
  { pattern: /\b(troubleshoot|troubleshooting|debug|fix)\b/i, weight: 30, label: "包含英文 Debug/Fix 诉求" }
];

/** 2. 规范错误码正则库 */
const ERROR_CODE_PATTERNS = [
  // POSIX / Node.js errno: EACCES, ENOENT, ECONNREFUSED, ERESOLVE, etc.
  /\b(EACCES|ENOENT|ECONNREFUSED|ECONNRESET|EEXIST|EADDRINUSE|ETIMEDOUT|ERESOLVE|ENOTFOUND|EPERM)\b/gi,
  // Node / npm / Python / Java standard error codes
  /\b(ERR_[A-Z0-9_]+|npm ERR!|pip error)\b/gi,
  // HTTP status errors
  /\b(400|401|403|404|408|409|429|500|502|503|504)\s*(Bad Request|Unauthorized|Forbidden|Not Found|Internal Server Error|Bad Gateway|Gateway Timeout)?\b/gi,
  // Windows / DirectX / NT Hex error codes (0x80070005, 0xc0000005)
  /\b0x[0-9a-fA-F]{4,8}\b/gi,
  // Language Exceptions
  /\b(NullPointerException|TypeError|SyntaxError|ReferenceError|ModuleNotFoundError|ImportError|IndexError|KeyError|AttributeError|Uncaught\s+[A-Za-z]+Error)\b/gi,
  // Network / Security errors
  /\b(CORS|CERT_[A-Z_]+|SSL_ERROR_[A-Z_]+|NET::ERR_[A-Z_]+|Cross-Origin Request Blocked)\b/gi,
  // Exit codes
  /\b(exit code \d+|status code \d+|return code \d+|signal \d+)\b/gi
];

/** 3. 故障句式结构 */
const FAILURE_SENTENCE_PATTERNS = [
  { pattern: /(怎么|如何|怎样)(解决|搞定|修复).*(报错|失败|异常|无法)/i, weight: 30, label: "疑问句式：如何解决报错" },
  { pattern: /(为什么|为何).*(一直|老是|总是)?(闪退|崩溃|打不开|进不去|启动不了|运行不了)/i, weight: 30, label: "疑问句式：为何一直打不开/启动不了" },
  { pattern: /卡在.*(不动|很久|进度条|百分之|loading)/i, weight: 25, label: "现象描述：卡在特定环节" },
  { pattern: /(运行|执行|启动|打开|安装).*(报|提示|显示).*(错|error)/i, weight: 30, label: "现象描述：执行某操作时提示报错" },
  { pattern: /连不上|无法连接|连接超时|连接被重置/i, weight: 25, label: "网络现象：连接超时或被重置" },
  { pattern: /\bhow to (fix|resolve|troubleshoot|solve)\b/i, weight: 30, label: "英文疑问句式：How to fix" }
];

/** 4. 常见技术栈/环境上下文 */
const TECH_ENV_PATTERNS = [
  { pattern: /\b(docker|docker-compose|k8s|kubernetes|podman)\b/i, env: "Container/Docker" },
  { pattern: /\b(npm|pnpm|yarn|bun|node|nodejs)\b/i, env: "Node.js" },
  { pattern: /\b(pip|python|python3|conda|venv)\b/i, env: "Python" },
  { pattern: /\b(git|github|gitlab)\b/i, env: "Git" },
  { pattern: /\b(nginx|apache|caddy|tomcat)\b/i, env: "Web Server" },
  { pattern: /\b(mysql|postgresql|postgres|redis|mongodb|sqlite)\b/i, env: "Database" },
  { pattern: /\b(linux|ubuntu|centos|debian|macos|windows)\b/i, env: "OS" },
  { pattern: /\b(vite|webpack|rollup|esbuild|typescript|tsc|babel)\b/i, env: "Build Tools" },
  { pattern: /\b(react|vue|angular|nextjs|nuxt)\b/i, env: "Frontend Framework" }
];

/** 5. 负向意图词典（用于扣分降权，不采取一刀切拦截） */
const NEGATIVE_KEYWORDS = [
  { pattern: /是什么|定义|概念|原理|介绍|科普/i, penalty: 25, label: "概念定义/科普诉求" },
  { pattern: /官网|官方网站|正版下载|下载地址|下载安装包|客户端/i, penalty: 20, label: "正版下载/官网导航诉求" },
  { pattern: /从入门到精通|新手教程|零基础|速成教程/i, penalty: 18, label: "系统性学习教程诉求" },
  { pattern: /价格|多少钱|收费标准|优惠券/i, penalty: 30, label: "价格消费诉求" },
  { pattern: /哪个好|对比|区别|选哪个|评测/i, penalty: 20, label: "选型对比诉求" },
  { pattern: /\b(what is|download|pricing|vs|review|tutorial)\b/i, penalty: 20, label: "英文泛知识/下载/对比诉求" }
];

/**
 * 核心多维打分与触发仲裁函数
 */
export function scoreTroubleshootingTrigger(
  query: string,
  results: SearchResult[] = []
): TroubleshootingTriggerResult {
  const cleanQ = (query || "").trim();
  let totalScore = 0;
  const matchedKeywords: string[] = [];
  const penaltyKeywords: string[] = [];
  const reasons: string[] = [];
  const errorCodes: string[] = [];
  let detectedPlatform: string | undefined;
  let detectedRuntime: string | undefined;

  // 维度 1：显式关键词打分
  for (const item of EXPLICIT_KEYWORDS) {
    if (item.pattern.test(cleanQ)) {
      totalScore += item.weight;
      matchedKeywords.push(item.label);
      reasons.push(item.label);
    }
  }

  // 维度 2：错误码与典型异常特征提取
  for (const regex of ERROR_CODE_PATTERNS) {
    // 检查 query
    const matches = cleanQ.match(regex);
    if (matches && matches.length > 0) {
      for (const m of matches) {
        const trimmed = m.trim();
        if (!errorCodes.includes(trimmed)) {
          errorCodes.push(trimmed);
        }
      }
    }
  }

  if (errorCodes.length > 0) {
    const codeScore = Math.min(45, errorCodes.length * 35);
    totalScore += codeScore;
    reasons.push(`精准提取错误代码: [${errorCodes.join(", ")}]`);
  }

  // 维度 3：故障句式结构分析
  for (const item of FAILURE_SENTENCE_PATTERNS) {
    if (item.pattern.test(cleanQ)) {
      totalScore += item.weight;
      matchedKeywords.push(item.label);
      reasons.push(item.label);
    }
  }

  // 维度 4：环境上下文探测
  for (const item of TECH_ENV_PATTERNS) {
    if (item.pattern.test(cleanQ)) {
      if (!detectedRuntime) detectedRuntime = item.env;
      else if (!detectedPlatform) detectedPlatform = item.env;
      totalScore += 15;
      reasons.push(`命中运行环境上下文: ${item.env}`);
      break;
    }
  }

  // 维度 5：信源与检索结果证据链判定
  if (results && results.length > 0) {
    let issueEvidenceCount = 0;
    const combinedSnippet = results.slice(0, 6).map(r => `${r.title} ${r.snippet} ${r.url}`).join(" ");

    // 检查结果中是否有 StackOverflow / GitHub Issues / 社区排错讨论
    if (/stackoverflow\.com|github\.com\/.*\/issues|v2ex\.com|segmentfault\.com|csdn\.net/i.test(combinedSnippet)) {
      issueEvidenceCount += 2;
    }

    // 检查结果中是否频繁出现 error / fix / solution / 解决
    if (/(fix|solution|solved|workaround|排查步骤|解决方案|解决方法|报错解决)/i.test(combinedSnippet)) {
      issueEvidenceCount += 2;
    }

    // 额外在结果中补充挖掘错误代码
    if (errorCodes.length === 0) {
      for (const regex of ERROR_CODE_PATTERNS) {
        const resultMatches = combinedSnippet.match(regex);
        if (resultMatches) {
          for (const m of resultMatches.slice(0, 2)) {
            const trimmed = m.trim();
            if (!errorCodes.includes(trimmed)) {
              errorCodes.push(trimmed);
            }
          }
        }
      }
      if (errorCodes.length > 0) {
        totalScore += 20;
        reasons.push(`从全网信源证据中提取到错误码: [${errorCodes.join(", ")}]`);
      }
    }

    if (issueEvidenceCount > 0) {
      const evidenceScore = Math.min(25, issueEvidenceCount * 10);
      totalScore += evidenceScore;
      reasons.push("检索结果证实包含 GitHub Issue、StackOverflow 或高频排错方案");
    }
  }

  // 维度 6：负向意图柔性惩罚机制
  for (const neg of NEGATIVE_KEYWORDS) {
    if (neg.pattern.test(cleanQ)) {
      totalScore = Math.max(0, totalScore - neg.penalty);
      penaltyKeywords.push(neg.label);
      reasons.push(`负向意图衰减 (-${neg.penalty}): ${neg.label}`);
    }
  }

  // 归一化评分 (0 - 100)
  const normalizedScore = Math.min(100, Math.max(0, totalScore));
  const confidence = Number((normalizedScore / 100).toFixed(2));
  // 阈值判定：48 分及以上视为触发排错组件
  const triggered = normalizedScore >= 48;

  return {
    score: normalizedScore,
    confidence,
    triggered,
    errorCodes,
    matchedKeywords,
    penaltyKeywords,
    reasons,
    environmentContext: {
      platform: detectedPlatform,
      runtime: detectedRuntime,
      targetTool: errorCodes[0] || detectedRuntime
    }
  };
}
