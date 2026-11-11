import Icon from './Icon.jsx';
import { colorForStop } from '../data/demo.js';

export default function UnloadingPanel({
  result,
  stops,
  simulation,
  simStep,
  busy,
  onSimulate,
  onReset,
}) {
  const placedStops = [
    ...new Set((result?.placed ?? []).map((p) => p.stop)),
  ].sort((a, b) => a - b);
  return (
    <aside className="simulation-card">
      <div className="card-heading">
        <h2>
          <Icon name="route" size={19} />
          The unloading run
        </h2>
        <span className="pill neutral">SIMULATOR</span>
      </div>
      <div className="simulation-copy">
        <h3>One stop at a time.</h3>
        <p>See how your load clears as the route moves forward.</p>
      </div>
      <div className="stop-track">
        {(result ? placedStops : stops).map((stop, i) => (
          <div
            key={stop}
            className={`stop-track-item ${simulation?.completedStops.includes(stop) ? 'completed' : simulation?.nextStop === stop ? 'current' : ''}`}
          >
            <span style={{ '--stop-color': colorForStop(stop) }}>
              {simulation?.completedStops.includes(stop) ? (
                <Icon name="check" size={15} />
              ) : (
                String(stop).padStart(2, '0')
              )}
            </span>
            <div>
              <strong>Delivery stop {String(stop).padStart(2, '0')}</strong>
              <small>
                {result
                  ? `${result.placed.filter((p) => p.stop === stop).length} packages`
                  : 'Waiting for a load'}
                {simulation?.completedStops.includes(stop) && ' · delivered'}
              </small>
            </div>
            {simulation?.nextStop === stop && <span className="next-dot" />}
          </div>
        ))}
      </div>
      {simulation && (
        <div className="sim-summary">
          <div>
            <strong>{simulation.unloadedIds.length}</strong>
            <span>unloaded</span>
          </div>
          <div>
            <strong>{simulation.remaining}</strong>
            <span>remaining</span>
          </div>
          <span className="pill success">
            {simulation.complete
              ? 'Route complete'
              : `Next: stop ${simulation.nextStop}`}
          </span>
        </div>
      )}
      <div className="simulation-controls">
        {simulation?.readyIds.length > 0 && (
          <div className="sim-ready">
            <span>FIRST OUT AT STOP {simulation.nextStop}</span>
            <strong>
              {
                result.placed.find((p) => p.id === simulation.readyIds[0])
                  ?.label
              }
            </strong>
            <small>{simulation.readyIds[0]}</small>
          </div>
        )}
        {!simulation ? (
          <button
            className="button primary full"
            disabled={!result?.placed.length || busy}
            onClick={() => onSimulate(0)}
          >
            <Icon name="play" size={16} />
            Start simulation
          </button>
        ) : (
          <>
            <button
              className="button primary full"
              disabled={simulation.complete || busy}
              onClick={() => onSimulate(simStep + 1)}
            >
              <Icon name="arrow" size={16} />
              {simulation.complete
                ? 'Route completed'
                : `Complete stop ${simulation.nextStop}`}
            </button>
            <div className="sim-secondary">
              <button
                disabled={simStep === 0 || busy}
                onClick={() => onSimulate(simStep - 1)}
              >
                Previous stop
              </button>
              <button disabled={busy} onClick={onReset}>
                <Icon name="reset" size={13} />
                Reset
              </button>
            </div>
          </>
        )}
        <span className="sim-assumption">
          <Icon name="check" size={13} />
          {result
            ? 'Unloading order validated by the engine'
            : 'Optimize a load to begin'}
        </span>
      </div>
    </aside>
  );
}
