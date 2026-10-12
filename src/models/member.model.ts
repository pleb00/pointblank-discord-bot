export interface PlayerIdentity {
  nickname: string;
  /** Exact HTML attribute; decoded once when constructing a request. */
  env: string;
  rankIconUrl: string | null;
}

export type ClanMember = PlayerIdentity;

export interface PlayerSearchResult extends PlayerIdentity {
  ranking: number | null;
  rankName: string | null;
  exp: number | null;
}

export interface MemberDetail {
  nickname: string;
  exp: number | null;
  kills: number | null;
  deaths: number | null;
  headshots: number | null;
  rankIconUrl: string | null;
  clanName: string | null;
  clanMemberCount: number | null;
  clanRanking: number | null;
}

export interface PlayerDetail extends MemberDetail {
  ranking: number | null;
  rankName: string | null;
  killDeathRatio: number | null;
  /** Headshots divided by kills, expressed as a percentage. */
  headshotRatio: number | null;
}
