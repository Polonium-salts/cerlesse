import React from "react";
import { WidgetModule } from "../sdk/types.js";
import { WeatherWidget } from "../components/WeatherWidget.js";
import { manifestMeta } from "../manifests/moduleMeta.js";

export const weatherModule: WidgetModule = {
  ...manifestMeta("weather"),
  render: (ctx) => {
    return <WeatherWidget activeResult={ctx.activeResult!} isCompact={ctx.isCompact} />;
  }
};

