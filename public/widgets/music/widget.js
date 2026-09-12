/**
 * Music Player CDN Widget Module for EdgeOne
 * Cache-Control: public, max-age=3600
 */
export default {
  id: "music",
  name: "多媒体音乐播放器",
  version: "1.0.0",
  render(data) {
    return {
      title: data?.title || "Chill Beats",
      artist: data?.artist || "Lofi Studio",
      isPlaying: false
    };
  }
};
