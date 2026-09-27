/**
 * 节日主题工具模块：检测当前是否处于中秋节等特定传统节日期间
 */

// 预置 2024~2035 年中秋节公历公认节日窗口 (中秋节正日前后各 3 天)
const MID_AUTUMN_FESTIVAL_RANGES: Record<number, { start: [number, number]; end: [number, number] }> = {
  2024: { start: [9, 14], end: [9, 20] }, // 2024-09-17 (农历八月十五)
  2025: { start: [10, 3], end: [10, 9] }, // 2025-10-06
  2026: { start: [9, 22], end: [9, 28] }, // 2026-09-25
  2027: { start: [9, 12], end: [9, 18] }, // 2027-09-15
  2028: { start: [9, 30], end: [10, 6] }, // 2028-10-03
  2029: { start: [9, 19], end: [9, 25] }, // 2029-09-22
  2030: { start: [9, 9], end: [9, 15] },  // 2030-09-12
  2031: { start: [9, 28], end: [10, 4] }, // 2031-10-01
  2032: { start: [9, 16], end: [9, 22] }, // 2032-09-19
  2033: { start: [9, 5], end: [9, 11] },  // 2033-09-08
  2034: { start: [9, 24], end: [9, 30] }, // 2034-09-27
  2035: { start: [9, 13], end: [9, 19] }, // 2035-09-16
};

/**
 * 判断指定日期是否处于中秋节期间
 * 包含：
 * 1. 现代浏览器 Intl 农历精确判断 (农历八月十二 ~ 农历八月十八)
 * 2. 预设公历对照表兜底
 * 3. URL 参数 (?theme=midautumn 或 ?festival=midautumn) 调试覆盖
 * 4. 本地存储 (localStorage) 调试覆盖
 */
export function isMidAutumnFestival(targetDate: Date = new Date()): boolean {
  // 1. 允许通过 URL 参数快速调试或演示节日主题
  if (typeof window !== "undefined") {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const themeParam = searchParams.get("theme") || searchParams.get("festival");
      if (themeParam === "midautumn" || themeParam === "mid-autumn" || themeParam === "zhongqiu") {
        return true;
      }
      if (themeParam === "normal" || themeParam === "default") {
        return false;
      }

      // 允许 localStorage 开发者覆盖
      const stored = localStorage.getItem("force_festival_theme");
      if (stored === "midautumn") return true;
      if (stored === "none") return false;
    } catch {
      // 忽略沙箱环境解析异常
    }
  }

  // 2. 使用标准农历转换 Intl.DateTimeFormat (覆盖所有年份农历八月十三至八月十七)
  try {
    const lunarFormatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      month: "numeric",
      day: "numeric"
    });
    const formatted = lunarFormatter.format(targetDate);
    // 匹配如 "8月14日", "8月15日", "8月16日", "8/15" 等
    const monthMatch = formatted.match(/(\d+)\s*(?:月|\/)/);
    const dayMatch = formatted.match(/(?:月|\/)\s*(\d+)/);

    if (monthMatch && dayMatch) {
      const lunarMonth = parseInt(monthMatch[1], 10);
      const lunarDay = parseInt(dayMatch[1], 10);
      // 农历八月十二到八月十八为中秋节黄金期
      if (lunarMonth === 8 && lunarDay >= 12 && lunarDay <= 18) {
        return true;
      }
    }
  } catch {
    // 降级使用预设对照表
  }

  // 3. 预设公历年份对照表兜底
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1; // 1-indexed
  const day = targetDate.getDate();

  const range = MID_AUTUMN_FESTIVAL_RANGES[year];
  if (range) {
    const [startMonth, startDay] = range.start;
    const [endMonth, endDay] = range.end;

    // 当月范围校验
    if (startMonth === endMonth) {
      if (month === startMonth && day >= startDay && day <= endDay) {
        return true;
      }
    } else {
      // 跨月情况（如 9月30日 - 10月6日）
      if (month === startMonth && day >= startDay) {
        return true;
      }
      if (month === endMonth && day <= endDay) {
        return true;
      }
    }
  }

  return false;
}
