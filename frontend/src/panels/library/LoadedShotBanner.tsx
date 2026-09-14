import { useQuery } from '@tanstack/react-query';
import type { ShotMeta } from '../../api/types';
import { matchesQuery } from '../../api/library';
import { useStore } from '../../store';
import { selectIsModified } from '../../store/selectors';
import { matchScore } from './MatchSelect';

const pct = (p: number | null) => (p == null ? '—' : `${Math.round(p * 100)}%`);

export function LoadedShotBanner() {
  const loaded = useStore((s) => s.library.loadedShot);
  const modified = useStore(selectIsModified);
  if (!loaded) return null;
  const { meta } = loaded.detail;
  return <Banner meta={meta} ours={loaded.realPrediction.xg} modified={modified} />;
}

type BannerProps = { meta: ShotMeta; ours: number; modified: boolean };

function Banner({ meta, ours, modified }: BannerProps) {
  const { resetToReal, clearLoadedShot } = useStore.getState();
  // Score and stage live on the match, not the shot; the matches list is cached per season.
  const { data: matches } = useQuery(matchesQuery(meta.competition_id, meta.season_id));
  const match = matches?.find((m) => m.match_id === meta.match_id);
  const score = match ? matchScore(match) : `${meta.home_team} v ${meta.away_team}`;
  const foot = meta.dominant_foot === 'Unknown' ? null : `${meta.dominant_foot}-footed`;
  return (
    <div className="loaded-banner" role="status" data-testid="loaded-banner">
      <div className="loaded-main">
        <strong data-testid="loaded-player">{meta.player_name ?? 'Unknown player'}</strong>
        <span>
          {[meta.team_name, meta.minute != null && `${meta.minute}'`, meta.outcome]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className="loaded-xg">
          StatsBomb <b>{pct(meta.statsbomb_xg)}</b> · Ours <b>{pct(ours)}</b>
        </span>
        {foot && <span className="pill">{foot}</span>}
        {meta.weak_foot && <span className="pill pill-warn">Weak foot</span>}
        {modified && (
          <span className="pill pill-accent" data-testid="modified-pill">
            Modified
          </span>
        )}
      </div>
      <div className="loaded-meta">
        {[score, match?.stage, meta.match_date, `${meta.competition_name} ${meta.season_name}`]
          .filter(Boolean)
          .join(' · ')}
      </div>
      <div className="loaded-actions">
        <button type="button" onClick={resetToReal} disabled={!modified} data-testid="reset-real">
          Reset to real positions
        </button>
        <button type="button" onClick={clearLoadedShot} data-testid="clear-shot">
          Clear
        </button>
      </div>
    </div>
  );
}
