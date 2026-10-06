import type { SearchSynthesisResult, AgentStep } from "../../../types.js";

export interface AiAnswerData {
  query: string;
  summary: string;
  activeResult?: SearchSynthesisResult;
  /**
   * ReAct-Read 循环思维链的真实执行步骤。
   * 由宿主注入，组件只做投影展示；缺失时时间线自动隐藏而非伪造。
   */
  agentSteps?: AgentStep[];
}
