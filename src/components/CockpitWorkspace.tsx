import React, { useState } from "react";
import {
  SearchSynthesisResult,
  UserSettings
} from "../types.js";
import {
  Sparkles,
  Globe,
  BrainCircuit,
  LayoutGrid
} from "lucide-react";
import { AiAnswerWidget } from "../widgets/components/AiAnswerWidget.js";
import { RelatedLinksWidget } from "../widgets/components/RelatedLinksWidget.js";
import { AgentProgressStream } from "./AgentProgressStream.js";
import { Button } from "./ui/button.js";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs.js";

interface CockpitWorkspaceProps {
  activeResult: SearchSynthesisResult;
  settings: UserSettings;
  onExecuteSearch: (query: string, deepSearch?: boolean) => void;
  onSwitchToBentoGrid?: () => void;
  initialTab?: "answer" | "links" | "reasoning";
  isDark?: boolean;
  openUrl?: (url: string) => void;
  copyText?: (text: string) => void;
}

type CockpitTab = "answer" | "links" | "reasoning";

export const CockpitWorkspace: React.FC<CockpitWorkspaceProps> = ({
  activeResult,
  settings,
  onExecuteSearch,
  onSwitchToBentoGrid,
  initialTab = "links",
  openUrl,
  copyText
}) => {
  const [activeTab, setActiveTab] = useState<CockpitTab>(initialTab);

  const navTabs: Array<{
    id: CockpitTab;
    label: string;
    icon: React.ElementType;
    hasContent: boolean;
  }> = [
    { id: "links", label: "官网跳转", icon: Globe, hasContent: true },
    { id: "answer", label: "AI 智能回答", icon: Sparkles, hasContent: true },
    { id: "reasoning", label: "检索推理日志", icon: BrainCircuit, hasContent: true }
  ];

  return (
    <div className="w-full flex flex-col gap-4 transition-all">
      {/* 模块切换 + 内容 */}
      <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col flex-1 min-h-[580px]">
        {/* 模块切换栏 */}
        <div className="px-4 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as CockpitTab)}
            className="min-w-0"
          >
            <TabsList className="overflow-x-auto no-scrollbar">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5 text-xs">
                    <Icon className="size-3.5" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {onSwitchToBentoGrid && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchToBentoGrid}
              className="text-xs h-8 gap-1.5 font-medium bg-primary/10 hover:bg-primary/20 text-primary border-primary/30"
              title="切换至搜索引擎小组件网格 (Live Tile 12 栅格全景视图)"
            >
              <LayoutGrid className="size-3.5" />
              <span>显示小组件网格</span>
            </Button>
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
          {activeTab === "answer" && (
            <div className="max-w-6xl mx-auto w-full">
              <AiAnswerWidget
                result={activeResult}
                query={activeResult.query}
                onExecuteSearch={onExecuteSearch}
                openUrl={openUrl}
                copyText={copyText}
              />
            </div>
          )}

          {activeTab === "links" && (
            <div className="max-w-6xl mx-auto w-full">
              <RelatedLinksWidget
                result={activeResult}
                query={activeResult.query}
                onExecuteSearch={onExecuteSearch}
                openUrl={openUrl}
                copyText={copyText}
              />
            </div>
          )}

          {activeTab === "reasoning" && (
            <div className="max-w-4xl mx-auto">
              <AgentProgressStream
                steps={activeResult.steps}
                query={activeResult.query}
                isComplete={true}
                executionTimeMs={activeResult.executionTimeMs}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

