import React, { useState } from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import { MarkdownContent } from "./MarkdownContent.js";
import { Layers } from "lucide-react";
import { SearchResult } from "../../types.js";

interface TopicDigestWidgetProps {
  summary: string;
  query: string;
  filteredResults: SearchResult[];
}

/**
 * 分面专题研报 (topic_digest)
 *
 * shadcn/ui 重做要点：
 *   · 专题切换由自制"药丸组"改为 shadcn Tabs ——
 *     bg-muted 槽 + 白底激活项 + rounded-lg/rounded-md 双层圆角，
 *     与 shadcn 原版的 TabsList / TabsTrigger 尺寸（h-9 / p-[3px]）完全一致；
 *   · 正文交给共用的 MarkdownContent（shadcn Typography 语汇）；
 *   · 移除装饰徽标与"下一专题"冗余控件，专题条本身即导航。
 */
export const TopicDigestWidget: React.FC<TopicDigestWidgetProps> = ({ summary }) => {
  // 依据 markdown 二级标题切分专题；无标题时按段落对半切两段
  const sections = React.useMemo(() => {
    const rawSections = summary.split(/(?=\n##\s)/g).filter((s) => s.trim().length > 0);
    if (rawSections.length <= 1) {
      const paras = summary.split("\n\n").filter((p) => p.trim());
      return [
        {
          title: "核心研报解析",
          content: paras.slice(0, 3).join("\n\n")
        },
        paras.length > 3
          ? {
              title: "架构与技术要点",
              content: paras.slice(3).join("\n\n")
            }
          : null
      ].filter(Boolean) as { title: string; content: string }[];
    }

    return rawSections.map((sec, idx) => {
      const lines = sec.trim().split("\n");
      const firstLine = lines[0].replace(/^##\s*/, "").replace(/^#\s*/, "");
      const body = lines.slice(1).join("\n").trim();
      return {
        title: firstLine || `专题分面 ${idx + 1}`,
        content: body || lines[0]
      };
    });
  }, [summary]);

  const [activeSecIndex, setActiveSecIndex] = useState(0);
  const currentSection = sections[activeSecIndex] || sections[0];

  return (
    <IOSWidget
      id="widget-topic-digest"
      title="分面专题研报"
      icon={<Layers className="size-4" />}
      className="w-full h-full"
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <Tabs
          value={String(activeSecIndex)}
          onValueChange={(v) => setActiveSecIndex(Number(v))}
        >
          <TabsList>
            {sections.map((sec, index) => (
              <TabsTrigger key={index} value={String(index)}>
                <span className="max-w-[9rem] truncate">{sec.title}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="min-h-0 flex-1 overflow-hidden">
          <MarkdownContent>{currentSection?.content || ""}</MarkdownContent>
        </div>
      </div>
    </IOSWidget>
  );
};
