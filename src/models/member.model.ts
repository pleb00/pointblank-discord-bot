export interface ClanMember {
  nickname: string;
  /** Exact HTML attribute; decoded once when constructing a request. */
  env: string;
  rankIconUrl: string | null;
}

export interface MemberDetail {
  nickname: string;
  exp: number | null;
  kills: number | null;
  deaths: number | null;
  headshots: number | null;
  rankIconUrl: string | null;
  clanName: string | null;
}
