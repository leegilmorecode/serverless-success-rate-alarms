export type Film = {
  id?: string;
  created?: string;
  title: string;
  description: string;
  genre: string[];
  release_date: string;
  duration: string;
  rating: {
    average: number;
    count: number;
  };
  cast: {
    name: string;
    role: string;
  }[];
  directors: string[];
  writers: string[];
  production_studio: string;
  language: string;
  subtitles: string[];
  poster_url: string;
  trailer_url: string;
  video_quality: string[];
  audio_languages: string[];
  availability: {
    start_date: string;
    end_date: string;
  };
  streaming_info: {
    provider: string;
    url: string;
    expires_at: string;
  }[];
};
