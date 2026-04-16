export interface ScalaPlayer {
  id: number;
  name: string;
  playerDisplays?: ScalaPlayerDisplay[];
  playlistPreviews?: PlayerPlaylistPreview[];
}

export interface ScalaPlayersResponse {
  list: ScalaPlayer[];
  offset: number;
  count: number;
}

export interface ScalaPlayerDisplay {
  id: number;
  name: string;
  screenCounter?: number;
  channel?: {
    id: number;
    name: string;
  };
}

export interface PlayerPlaylistPreview {
  displayId: number;
  displayName: string;
  screenCounter: number | null;
  channelId: number | null;
  channelName: string | null;
  playlistId: number | null;
  playlistName: string | null;
  itemNames: string[];
}

export interface Location {
  code: string;       // e.g. "EV0040" or "AB0180"
  prefix: string;     // e.g. "EV" or "AB"
  city: string;       // e.g. "Den-Haag"
  area: string;       // e.g. "Leyweg"
  displayName: string; // human-readable
  players: ScalaPlayer[];
}

export interface Tag {
  id: string;
  label: string;
  color: string;
}

export interface PlayerTagSelection {
  playerId: number;
  playerName: string;
  tags: string[];
  comment: string;
  // Backward compatibility for older payloads
  remark?: string;
}

export interface LocationSubmission {
  locationCode: string;
  locationName: string;
  submittedAt: string;
  playerSelections: PlayerTagSelection[];
}
