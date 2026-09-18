export interface WeatherForecastItem {
  day: string;
  temperature: string;
  condition: string;
}

export interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  high: number;
  low: number;
  humidity?: string;
  wind?: string;
  uv?: string;
  airQuality?: string;
  forecast: WeatherForecastItem[];
}
