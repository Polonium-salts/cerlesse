/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 链接展示（角标 / 预览卡 / 背面信源列表）的纯函数契约。
 * 这些函数决定了「用户看到的是不是人话」，所以单独锁住：
 * 尤其 formatSourceHost 对非法输入返回空串而不是回显原文 ——
 * 返回原文会被当成可点击域名显示，是会骗人的。
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  formatSourceHost,
  isBareUrlLabel,
  isExternalUrl,
  middleTruncate,
  prettySourceUrl,
  sourceHostColors
} from "../../src/widgets/components/SourceLink.js";

test("isExternalUrl：只认 http/https", () => {
  assert.equal(isExternalUrl("https://example.com"), true);
  assert.equal(isExternalUrl("HTTP://example.com"), true);
  assert.equal(isExternalUrl("  https://example.com  "), true);
  // 危险协议与非 http 协议一律不算外链（不能给它挂外链图标/宿主跳转通道）
  assert.equal(isExternalUrl("javascript:alert(1)"), false);
  assert.equal(isExternalUrl("mailto:a@b.com"), false);
  assert.equal(isExternalUrl("/local/path"), false);
  assert.equal(isExternalUrl("#anchor"), false);
  assert.equal(isExternalUrl(""), false);
  assert.equal(isExternalUrl(undefined), false);
  assert.equal(isExternalUrl(null), false);
});

test("formatSourceHost：去协议与 www.，保留子域", () => {
  assert.equal(formatSourceHost("https://www.example.com/a/b?c=1"), "example.com");
  assert.equal(formatSourceHost("http://docs.example.co.uk/x"), "docs.example.co.uk");
  assert.equal(formatSourceHost("https://m.example.com"), "m.example.com");
});

test("formatSourceHost：无法解析的输入返回空串而不是回显原文", () => {
  // 回显原文会被界面当成域名显示，是骗人的行为
  assert.equal(formatSourceHost("javascript:alert(1)"), "");
  assert.equal(formatSourceHost("/relative/path"), "");
  assert.equal(formatSourceHost("not a url at all"), "");
  assert.equal(formatSourceHost(""), "");
  assert.equal(formatSourceHost(undefined), "");
});

test("middleTruncate：超长时中间省略且首尾都在", () => {
  assert.equal(middleTruncate("short", 20), "short");
  const long = "a".repeat(40) + "TAIL";
  const out = middleTruncate(long, 12);
  assert.equal(out.length, 12);
  assert.ok(out.includes("…"), "省略号必须在");
  assert.ok(out.startsWith("aaaa"), "头部保留");
  assert.ok(out.endsWith("TAIL"), "尾部保留");
});

test("prettySourceUrl：正文里把裸 URL 压成可读形态", () => {
  assert.equal(prettySourceUrl("https://www.example.com/"), "example.com");
  assert.equal(prettySourceUrl("https://example.com/a/b"), "example.com/a/b");
  assert.equal(prettySourceUrl("https://example.com/a/"), "example.com/a");
  assert.equal(prettySourceUrl("https://example.com/?q=1"), "example.com/?q=1");
  assert.equal(prettySourceUrl(""), "");
  // 非外链原样（截断）返回，不假装解析成功
  assert.equal(prettySourceUrl("#anchor", 40), "#anchor");
});

test("prettySourceUrl：超长地址中间省略而不是把域名截掉", () => {
  const out = prettySourceUrl("https://example.com/very/long/path/segment", 20);
  assert.equal(out.length, 20);
  assert.ok(out.includes("…"));
  assert.ok(out.includes("example"), "域名必须完整保留，否则认不出站点");
});

test("isBareUrlLabel：识别模型把地址直接当正文写出来的情况", () => {
  assert.equal(isBareUrlLabel("https://example.com/a", "https://example.com/a"), true);
  assert.equal(isBareUrlLabel("http://example.com", "https://example.com/a"), true);
  assert.equal(isBareUrlLabel("example.com/guide", "https://example.com/guide"), true);
  assert.equal(isBareUrlLabel("www.example.com", "https://example.com"), true);
});

test("isBareUrlLabel：不把带 TLD 的普通数字文本误判成链接", () => {
  // "3.14" / "v1.2" 是正文不是网址；TLD 必须≥2 个字母才认
  assert.equal(isBareUrlLabel("3.14", "https://example.com/pi"), false);
  assert.equal(isBareUrlLabel("v1.2", "https://example.com/changelog"), false);
});

test("isBareUrlLabel：有意义的锚文本不算裸链接", () => {
  assert.equal(isBareUrlLabel("官方文档", "https://example.com"), false);
  assert.equal(isBareUrlLabel("Project Euler #57", "https://example.com"), false);
  // 带空格的长句更不可能是 URL
  assert.equal(isBareUrlLabel("见 example.com/guide 获取详情", "https://example.com/guide"), false);
  assert.equal(isBareUrlLabel("", "https://example.com"), false);
  assert.equal(isBareUrlLabel("https://example.com", ""), false);
});

test("sourceHostColors：同一站点颜色稳定，不同站点不同", () => {
  assert.deepEqual(sourceHostColors("example.com"), sourceHostColors("example.com"));
  assert.notDeepEqual(sourceHostColors("example.com"), sourceHostColors("other.com"));
  // 无 host 也必须有可用的兜底色，不能抛错
  assert.equal(typeof sourceHostColors("").bg, "string");
  assert.equal(typeof sourceHostColors("").fg, "string");
});