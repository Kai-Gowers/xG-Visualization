import { BODY_PARTS, PLAY_PATTERNS, PREFERRED_FEET, SHOT_TYPES, TECHNIQUES } from '../api/types';
import { useStore } from '../store';
import { Segmented, Toggle } from './controls';

const FLAGS = [
  ['first_time', 'First time'],
  ['under_pressure', 'Under pressure'],
  ['one_on_one', 'One on one'],
  ['open_goal', 'Open goal'],
] as const;

export function ControlPanel() {
  const attrs = useStore((s) => s.scenario.attrs);
  const setAttr = useStore((s) => s.setAttr);
  return (
    <section className="section" aria-label="Shot attributes">
      <h2>Shot</h2>
      <Segmented
        label="Body part"
        options={BODY_PARTS}
        value={attrs.body_part}
        onChange={(v) => setAttr('body_part', v)}
      />
      <Segmented
        label="Technique"
        options={TECHNIQUES}
        value={attrs.technique}
        onChange={(v) => setAttr('technique', v)}
      />
      <Segmented
        label="Shot type"
        options={SHOT_TYPES}
        value={attrs.shot_type}
        onChange={(v) => setAttr('shot_type', v)}
      />
      <Segmented
        label="Phase of play"
        options={PLAY_PATTERNS}
        value={attrs.play_pattern}
        onChange={(v) => setAttr('play_pattern', v)}
      />
      <Segmented
        label="Preferred foot"
        options={PREFERRED_FEET}
        value={attrs.preferred_foot}
        onChange={(v) => setAttr('preferred_foot', v)}
      />
      <div className="toggles">
        {FLAGS.map(([key, label]) => (
          <Toggle key={key} label={label} checked={attrs[key]} onChange={(v) => setAttr(key, v)} />
        ))}
      </div>
    </section>
  );
}
