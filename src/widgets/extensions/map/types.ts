export interface MapPoiItem {
  id: string;
  name: string;
  category: "attraction" | "hotel" | "food" | "transit" | "general";
  address: string;
  rating?: number;
  tags?: string[];
  distance?: string;
  lat?: number;
  lng?: number;
  description?: string;
  openingHours?: string;
}

export interface MapWidgetData {
  cityOrRegion: string;
  centerLocationName: string;
  destinationType?: string;
  overviewSummary: string;
  pois: MapPoiItem[];
  transportAdvice?: string;
}
