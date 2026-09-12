/**
 * Weather CDN Widget Module for EdgeOne
 * Cache-Control: public, max-age=3600
 */
export default {
  id: "weather",
  name: "实时气象看板",
  version: "1.0.0",
  render(data) {
    return {
      temperature: data?.temp || "24°C",
      condition: data?.condition || "晴",
      humidity: data?.humidity || "45%"
    };
  }
};
