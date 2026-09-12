/**
 * Software Hub CDN Widget Module for EdgeOne
 * Cache-Control: public, max-age=3600
 */
export default {
  id: "software_hub",
  name: "软件官方与下载枢纽",
  version: "1.0.0",
  render(data) {
    return {
      entity: data?.entity || "Software",
      version: data?.version || "Latest",
      downloadUrl: data?.downloadUrl || "#"
    };
  }
};
