import React from "react";
import { MindMapNode, ComparisonDimension, SearchResult } from "../types.js";
import { 
  GitFork, 
  Scale, 
  Sparkles, 
  ArrowUpRight, 
  Layers, 
  Cpu, 
  CheckCircle2,
  Globe,
  ExternalLink,
  ShieldCheck
} from "lucide-react";

interface GoogleKnowledgePanelProps {
  query: string;
  mindMap: MindMapNode;
  comparisonTable: ComparisonDimension[];
  onOpenMindMap: () => void;
  onOpenComparison: () => void;
  modelUsed: string;
  rawResultCount: number;
  filteredCount: number;
  officialWebsite?: SearchResult;
}

export const GoogleKnowledgePanel: React.FC<GoogleKnowledgePanelProps> = ({
  query,
  mindMap,
  comparisonTable,
  onOpenMindMap,
  onOpenComparison,
  modelUsed,
  rawResultCount,
  filteredCount,
  officialWebsite
}) => {
  const modelShortName = modelUsed.split("/").pop()?.replace(":free", "") || "Llama 3.3 70B";

  return (
    <div className="w-full rounded-3xl border border-[#dfe1e5] dark:border-[#3c4043] bg-white dark:bg-[#303134] p-5 shadow-xs space-y-5">
      {/* Knowledge Panel Header */}
      <div className="pb-3 border-b border-zinc-100 dark:border-zinc-700/60">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium mb-1">
          <Sparkles className="w-3.5 h-3.5 text-[#4285F4]" />
          <span>Google 知识图谱 & 决策面板</span>
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-[#e8eaed] leading-snug">
          {query}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-[#9aa0a6] mt-1">
          由高精度多源引擎与 OpenRouter 大模型自动构建的深度知识实体
        </p>
      </div>

      {/* Prominent Official Website Feature Card */}
      {officialWebsite && (
        <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/80 bg-gradient-to-br from-blue-50/90 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-blue-950 dark:text-blue-100">
                认证官方入口
              </span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-200/80 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200">
              官方正版
            </span>
          </div>
          
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
            {officialWebsite.title}
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
            {officialWebsite.url}
          </p>

          <a
            href={officialWebsite.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs"
          >
            <span>立即直达官方网站</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Mind Map Quick Card Preview */}
      <div 
        onClick={onOpenMindMap}
        className="p-4 rounded-2xl border border-purple-100 dark:border-purple-950 bg-purple-50/60 dark:bg-purple-950/20 hover:border-purple-300 dark:hover:border-purple-800 transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              交互式思维导图
            </span>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-purple-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
          已自动解析核心实体："{mindMap.label}"，包含 {mindMap.children?.length || 0} 个主干分支与下沉知识树。
        </p>
        <div className="mt-3 flex items-center justify-between text-[11px] text-purple-700 dark:text-purple-300 font-medium">
          <span>点击进入全屏缩放画布</span>
          <span>→</span>
        </div>
      </div>

      {/* Comparison Matrix Summary */}
      {comparisonTable && comparisonTable.length > 0 && (
        <div 
          onClick={onOpenComparison}
          className="p-4 rounded-2xl border border-amber-100 dark:border-amber-950 bg-amber-50/60 dark:bg-amber-950/20 hover:border-amber-300 dark:hover:border-amber-800 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                多源对比矩阵 ({comparisonTable.length} 维度)
              </span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
          <div className="space-y-1.5 mt-2">
            {comparisonTable.slice(0, 3).map((dim, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="truncate">{dim.dimension}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
            查看多方观点与权威共识 →
          </div>
        </div>
      )}

      {/* Engine & Synthesis Telemetry */}
      <div className="pt-2 text-xs space-y-2 border-t border-zinc-100 dark:border-zinc-700/60 text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>检索信源过滤</span>
          </span>
          <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium">
            {filteredCount} / {rawResultCount} 条
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-zinc-400" />
            <span>推理大模型</span>
          </span>
          <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[140px]">
            {modelShortName}
          </span>
        </div>
      </div>
    </div>
  );
};
