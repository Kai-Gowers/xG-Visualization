import { ExplanationWaterfall } from './ExplanationWaterfall';
import { FeatureChips } from './FeatureChips';

export function ResultsPanel() {
  return (
    <>
      <FeatureChips />
      <section className="section" aria-label="Why this xG">
        <h2>Why this xG</h2>
        <p className="hint">
          Each bar moves the log-odds from the base rate; the axis reads in probability. Hover a row
          to highlight it in the scene.
        </p>
        <ExplanationWaterfall />
      </section>
    </>
  );
}
