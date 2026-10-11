export interface ClanInfo {
  id: string;
  name: string;
  master: string | null;
  memberCount: number | null;
  maxMembers: number | null;
  createdAt: string | null;
  rank: {
    name: string | null;
    iconUrl: string | null;
    progressPercentage: number | null;
    exp: number | null;
  };
  statistics: {
    totalMatches: number | null;
    wins: number | null;
    losses: number | null;
    winRate: number | null;
    lossRate: number | null;
  };
  logo?: Buffer;
}

export interface ClanSnapshot {
  info: ClanInfo;
  html: string;
  sourceUrl: string;
}
