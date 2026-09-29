import React from "react";
import { SourcesWidget, SourcesWidgetProps, OfficialSiteEntry } from "./SourcesWidget.js";

export type RelatedLinksWidgetProps = SourcesWidgetProps;
export type { OfficialSiteEntry };

/**
 * 网站跳转与信源存证小组件（已与信源存证合并为一站式组件）
 */
export const RelatedLinksWidget: React.FC<RelatedLinksWidgetProps> = (props) => {
  return <SourcesWidget {...props} />;
};
