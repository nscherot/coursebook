export type Profile = {
  id: string;
  username: string;
  display_name: string;
  list_title: string;
  list_size: number;
};

export type Entry = {
  id: string;
  user_id: string;
  rank: number;
  name: string;
  location: string;
  lat: number | null;
  lng: number | null;
  note: string;
};

export type Round = {
  id: string;
  user_id: string;
  entry_id: string;
  played_on: string | null;
  score: number | null;
  notes: string;
  scorecard_path: string | null;
  created_at?: string;
};
