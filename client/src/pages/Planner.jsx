import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, post, exportCsv } from '../services/api.js';
import { defaultVehicle, demoPlan, colorForStop } from '../data/demo.js';
import { useAuth, AccountNotice } from '../auth/AuthContext.jsx';
import Icon from '../components/Icon.jsx';
import VehicleForm from '../components/VehicleForm.jsx';
import PackageModal from '../components/PackageModal.jsx';
import Instructions from '../components/Instructions.jsx';
import UnloadingPanel from '../components/UnloadingPanel.jsx';
const CargoViewer = lazy(() => import('../components/CargoViewer.jsx'));

export default function Planner({ health }) {
  const auth = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState({
    name: 'Untitled load plan',
    vehicle: { ...defaultVehicle },
    packages: [],
  });
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState('packages');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [editing, setEditing] = useState(undefined);
  const [selected, setSelected] = useState(null);
  const [hidden, setHidden] = useState([]);
  const [instructions, setInstructions] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [simStep, setSimStep] = useState(0);
  const [importErrors, setImportErrors] = useState([]);
  const [search, setSearch] = useState('');
  const fileRef = useRef();
  const versionRef = useRef(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setResult(null);
    setSelected(null);
    setSimulation(null);
    setHidden([]);
    setSimStep(0);
    (auth.user ? api('/vehicles') : Promise.resolve([]))
      .then((v) => active && setVehicles(v))
      .catch(() => {});
    (async () => {
      try {
        if (id === 'demo') {
          const r = await post('/optimize', demoPlan);
          if (active) {
            setPlan(structuredClone(demoPlan));
            setResult(r);
          }
        } else if (id === 'new') {
          if (active)
            setPlan({
              name: 'Untitled load plan',
              vehicle: { ...defaultVehicle },
              packages: [],
            });
        } else {
          if (auth.loading) return;
          if (!auth.user)
            throw new Error(
              'Sign in with Google to open your private saved plan.',
            );
          const saved = await api(`/load-plans/${id}`);
          if (active) {
            setPlan(saved);
            setResult(saved.result);
          }
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, auth.loading, auth.user]);

  function change(next) {
    versionRef.current++;
    setPlan(next);
    setResult(null);
    setSimulation(null);
    setSimStep(0);
    setSelected(null);
    setNotice('');
    setHidden([]);
  }
  async function optimize() {
    setBusy(true);
    setError('');
    setNotice('');
    const version = versionRef.current;
    try {
      const r = await post('/optimize', plan);
      if (version === versionRef.current) {
        setResult(r);
        setSimulation(null);
        setSimStep(0);
        setHidden([]);
        if (r.unplaced.length)
          setNotice(
            `${r.placed.length} packages placed. Review ${r.unplaced.length} unplaced package${r.unplaced.length > 1 ? 's' : ''} below.`,
          );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!auth.user) {
      setError(
        'Sign in with Google before saving. Your current draft stays here until you leave this page.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await post(
        id === 'new' || id === 'demo' ? '/load-plans' : `/load-plans/${id}`,
        { ...plan, optimize: Boolean(result) },
        id === 'new' || id === 'demo' ? 'POST' : 'PUT',
      );
      setNotice('Load plan saved.');
      if (id !== saved._id) navigate(`/plans/${saved._id}`, { replace: true });
      else setPlan(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveVehicle() {
    if (!auth.user) {
      setError('Sign in with Google to save vehicle presets.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const vehicle = await post('/vehicles', plan.vehicle);
      setVehicles([vehicle, ...vehicles]);
      setNotice('Vehicle preset saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setImportErrors([]);
    try {
      const data = new FormData();
      data.append('file', file);
      const imported = await api('/import/csv', { method: 'POST', body: data });
      const existingIds = new Set(plan.packages.map((p) => p.id));
      const duplicates = imported.packages.filter((p) => existingIds.has(p.id));
      const additions = imported.packages.filter((p) => !existingIds.has(p.id));
      if (additions.length + plan.packages.length > 100)
        throw new Error(
          'A load plan supports up to 100 packages. Remove packages before importing.',
        );
      change({ ...plan, packages: [...plan.packages, ...additions] });
      setImportErrors([
        ...imported.errors,
        ...duplicates.map((p) => ({
          message: `${p.id}: already exists in this plan; skipped.`,
          details: [],
        })),
      ]);
      setNotice(
        `${additions.length} valid package${additions.length === 1 ? '' : 's'} imported.${imported.errors.length + duplicates.length ? ' Invalid or duplicate rows were skipped.' : ''}`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }
  async function simulate(step) {
    setBusy(true);
    setError('');
    try {
      const state = await post('/simulate', {
        ...plan,
        completedStopCount: step,
      });
      setSimulation(state);
      setSimStep(step);
      setHidden([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const selectedPackage = result?.placed.find((p) => p.id === selected);
  const totalWeight = plan.packages.reduce((n, p) => n + Number(p.weight), 0);
  const stops = [...new Set(plan.packages.map((p) => p.stop))].sort(
    (a, b) => a - b,
  );
  const displayedPackages = plan.packages.filter((p) =>
    `${p.id} ${p.label} ${p.stop}`.toLowerCase().includes(search.toLowerCase()),
  );
  if (loading)
    return (
      <div className="page loading-page">
        <span className="spinner" />
        Preparing your load plan…
      </div>
    );
  return (
    <div className="page planner-page">
      <div className="planner-heading">
        <div>
          <Link className="back-link" to="/">
            <Icon name="arrow" size={14} />
            All load plans
          </Link>
          <div className="plan-title">
            <input
              aria-label="Load plan name"
              maxLength={100}
              value={plan.name}
              disabled={busy}
              onChange={(e) => setPlan({ ...plan, name: e.target.value })}
            />
            <span className={`pill ${result ? 'success' : 'neutral'}`}>
              {result ? 'Optimized' : 'Draft'}
            </span>
          </div>
          <p>
            {plan.vehicle.name} <span>·</span> {plan.packages.length} packages{' '}
            <span>·</span> {stops.length} delivery stops
          </p>
        </div>
        <div className="heading-actions">
          <button className="button secondary" disabled={busy} onClick={save}>
            <Icon name="save" size={16} />
            Save plan
          </button>
          <button
            className="button primary"
            disabled={busy || !plan.packages.length}
            onClick={optimize}
          >
            {busy ? (
              <span className="spinner small" />
            ) : (
              <Icon name="spark" size={17} />
            )}
            {result ? 'Re-optimize load' : 'Optimize load'}
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="error-banner">
          <Icon name="alert" size={18} />
          {error}
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="notice-banner">
          <Icon name="check" size={17} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      <AccountNotice />
      <div className="planner-metrics">
        {[
          [
            'cube',
            'Packages placed',
            result ? `${result.placed.length} / ${plan.packages.length}` : '—',
            result ? `${result.unplaced.length} unplaced` : 'Ready to optimize',
          ],
          [
            'layers',
            'Volume utilization',
            result ? `${result.metrics.volumeUtilization}%` : '—',
            'Of interior cargo space',
          ],
          [
            'weight',
            'Payload utilization',
            result ? `${result.metrics.payloadUtilization}%` : '—',
            `${totalWeight.toFixed(1)} / ${plan.vehicle.maxPayloadKg} kg`,
          ],
          [
            'route',
            'Delivery accessibility',
            result
              ? result.accessibility.valid
                ? 'All clear'
                : 'Review'
              : '—',
            result ? 'Straight-extraction validated' : 'Awaiting optimization',
          ],
        ].map(([icon, label, value, hint]) => (
          <div key={label} className="planner-metric">
            <span>
              <Icon name={icon} size={17} />
              {label}
            </span>
            <strong>
              {value}
              {label === 'Delivery accessibility' &&
                result?.accessibility.valid && (
                  <span className="success-circle">
                    <Icon name="check" size={14} />
                  </span>
                )}
            </strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>
      <div className="results-layout">
        <div className="viewer-card">
          <div className="card-heading">
            <h2>
              <Icon name="cube" size={19} />
              Your load, in perspective
            </h2>
            <span className="mini-label">
              {plan.vehicle.length} × {plan.vehicle.width} ×{' '}
              {plan.vehicle.height} CM
            </span>
          </div>
          <Suspense
            fallback={<div className="viewer-fallback">Preparing 3D view…</div>}
          >
            <CargoViewer
              vehicle={plan.vehicle}
              result={result}
              selectedId={selected}
              onSelect={setSelected}
              hidden={hidden}
              simulation={simulation}
            />
          </Suspense>
          {!result && (
            <div className="viewer-empty">
              <Icon name="spark" size={16} />
              Add packages, then optimize to see their actual placements.
            </div>
          )}
          <div className="viewer-bottom">
            <Icon name="info" size={15} />
            <span>
              Click a package to inspect it. The green frame marks the rear
              door.
            </span>
            <span className="axis-key">
              <b>X</b>Length <b>Y</b>Width <b>Z</b>Height
            </span>
          </div>
        </div>
        <UnloadingPanel
          result={result}
          stops={stops}
          simulation={simulation}
          simStep={simStep}
          busy={busy}
          onSimulate={simulate}
          onReset={() => {
            setSimulation(null);
            setSimStep(0);
          }}
        />
      </div>
      {selectedPackage && (
        <div className="selection-panel">
          <span
            className="selection-color"
            style={{ background: colorForStop(selectedPackage.stop) }}
          />
          <div>
            <small>SELECTED PACKAGE</small>
            <strong>
              {selectedPackage.label} <span>{selectedPackage.id}</span>
            </strong>
          </div>
          <span>Stop {selectedPackage.stop}</span>
          <span>
            {selectedPackage.length} × {selectedPackage.width} ×{' '}
            {selectedPackage.height} cm
          </span>
          <span>{selectedPackage.weight} kg</span>
          <span>
            Position: {selectedPackage.x}, {selectedPackage.y},{' '}
            {selectedPackage.z}
          </span>
          <span>
            {selectedPackage.fragile ? 'Fragile · ' : ''}
            {selectedPackage.noStack ? 'No stacking · ' : ''}
            {selectedPackage.maxStackingLoadKg != null
              ? `Max. top load ${selectedPackage.maxStackingLoadKg} kg · `
              : ''}
            {selectedPackage.baseRotationAllowed
              ? 'Rotation allowed'
              : 'Fixed orientation'}
          </span>
          <button
            className="button secondary small"
            onClick={() =>
              setHidden(
                hidden.includes(selected)
                  ? hidden.filter((v) => v !== selected)
                  : [...hidden, selected],
              )
            }
          >
            <Icon name="eye" size={14} />
            {hidden.includes(selected) ? 'Show' : 'Hide'}
          </button>
          <button
            aria-label="Close package details"
            className="icon-button"
            onClick={() => setSelected(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {hidden.length > 0 && (
        <button className="text-link show-all" onClick={() => setHidden([])}>
          <Icon name="eye" size={15} />
          Show all {hidden.length} hidden packages
        </button>
      )}
      {result && (
        <div className="validation-strip">
          <span>
            <Icon name="check" size={14} />
            Vehicle boundaries
          </span>
          <span>
            <Icon name="check" size={14} />
            No overlaps
          </span>
          <span>
            <Icon name="check" size={14} />
            Door clearance
          </span>
          <span>
            <Icon name="check" size={14} />
            70% support rule
          </span>
          <span>
            <Icon name="check" size={14} />
            Payload & stacking
          </span>
          <span>
            <Icon name="check" size={14} />
            Delivery order
          </span>
          <em>ALL PLACED PACKAGES VALID</em>
        </div>
      )}
      <section className="cargo-section">
        <div className="cargo-section-top">
          <div className="tabs">
            <button
              className={tab === 'packages' ? 'active' : ''}
              onClick={() => setTab('packages')}
            >
              <Icon name="box" size={17} />
              Cargo manifest<span>{plan.packages.length}</span>
            </button>
            <button
              className={tab === 'vehicle' ? 'active' : ''}
              onClick={() => setTab('vehicle')}
            >
              <Icon name="truck" size={17} />
              Vehicle configuration
            </button>
          </div>
          <div className="cargo-export-actions">
            <button
              disabled={!result?.placed.length || busy}
              onClick={async () => {
                try {
                  await exportCsv(plan);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <Icon name="download" size={15} />
              Export CSV
            </button>
            <button
              disabled={!result?.placed.length}
              onClick={() => setInstructions(true)}
            >
              <Icon name="print" size={15} />
              Loading instructions
            </button>
          </div>
        </div>
        {tab === 'vehicle' ? (
          <div className="vehicle-tab">
            <VehicleForm
              value={plan.vehicle}
              onChange={(vehicle) => change({ ...plan, vehicle })}
              vehicles={vehicles}
              onSave={saveVehicle}
              busy={busy}
            />
          </div>
        ) : (
          <>
            <div className="manifest-toolbar">
              <div>
                <h3>The cargo manifest</h3>
                <p>
                  {plan.packages.length} packages <span>·</span>{' '}
                  {totalWeight.toFixed(1)} kg total <span>·</span> Dimensions in
                  centimetres
                </p>
              </div>
              <div className="manifest-buttons">
                <input
                  aria-label="Search packages"
                  placeholder="Find a package…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <input
                  type="file"
                  ref={fileRef}
                  accept=".csv,text/csv"
                  hidden
                  onChange={importFile}
                />
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => fileRef.current.click()}
                >
                  <Icon name="upload" size={15} />
                  Import CSV
                </button>
                <button
                  className="button primary small"
                  disabled={busy || plan.packages.length >= 100}
                  onClick={() => setEditing(null)}
                >
                  <Icon name="plus" size={16} />
                  Add package
                </button>
              </div>
            </div>
            {importErrors.length > 0 && (
              <div className="import-errors" role="alert">
                <strong>{importErrors.length} CSV rows skipped</strong>
                {importErrors.map((e, i) => (
                  <p key={i}>
                    {e.row ? `Row ${e.row}: ` : ''}
                    {e.message} {e.details.join(' ')}
                  </p>
                ))}
              </div>
            )}
            <div className="manifest-table-wrap">
              <table className="manifest-table">
                <thead>
                  <tr>
                    <th>PACKAGE</th>
                    <th>DIMENSIONS (L × W × H)</th>
                    <th>WEIGHT</th>
                    <th>STOP</th>
                    <th>HANDLING</th>
                    <th>STATUS</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {displayedPackages.map((p) => {
                    const placed = result?.placed.find((x) => x.id === p.id);
                    const unplaced = result?.unplaced.find(
                      (x) => x.id === p.id,
                    );
                    return (
                      <tr
                        key={p.id}
                        className={selected === p.id ? 'selected-row' : ''}
                      >
                        <td>
                          <button
                            className="package-name"
                            disabled={!placed}
                            onClick={() => setSelected(p.id)}
                          >
                            <span
                              className="package-dot"
                              style={{ background: colorForStop(p.stop) }}
                            >
                              <Icon name="box" size={17} />
                            </span>
                            <span>
                              <strong>{p.label}</strong>
                              <small>{p.id}</small>
                            </span>
                          </button>
                        </td>
                        <td className="numeric">
                          {p.length} × {p.width} × {p.height}
                        </td>
                        <td className="numeric">
                          {p.weight} <small>kg</small>
                        </td>
                        <td>
                          <span
                            className="stop-badge"
                            style={{ '--stop-color': colorForStop(p.stop) }}
                          >
                            {String(p.stop).padStart(2, '0')}
                          </span>
                        </td>
                        <td>
                          <div className="handling-tags">
                            {p.fragile && <span>Fragile</span>}
                            {p.noStack && <span>No stack</span>}
                            {!p.baseRotationAllowed && <span>Fixed</span>}
                            {!p.fragile &&
                              !p.noStack &&
                              p.baseRotationAllowed && (
                                <span className="standard">Standard</span>
                              )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`status-tag ${placed ? 'placed' : unplaced ? 'unplaced' : ''}`}
                            title={unplaced?.reason}
                          >
                            {placed ? (
                              <>
                                <Icon name="check" size={12} />
                                Placed
                              </>
                            ) : unplaced ? (
                              'Unplaced'
                            ) : (
                              'Pending'
                            )}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              aria-label={`Edit ${p.label}`}
                              disabled={busy}
                              onClick={() => setEditing(p)}
                            >
                              <Icon name="edit" size={15} />
                            </button>
                            <button
                              aria-label={`Remove ${p.label}`}
                              disabled={busy}
                              onClick={() =>
                                change({
                                  ...plan,
                                  packages: plan.packages.filter(
                                    (x) => x.id !== p.id,
                                  ),
                                })
                              }
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!displayedPackages.length && (
                <div className="empty-state">
                  <Icon name="box" size={32} />
                  <h3>
                    {search
                      ? 'No matching cargo.'
                      : 'An empty van. Plenty of possibilities.'}
                  </h3>
                  <p>
                    {search
                      ? 'Try another package label or ID.'
                      : 'Add your first package or import a CSV to get started.'}
                  </p>
                  {!search && (
                    <button
                      className="button secondary small"
                      onClick={() => setEditing(null)}
                    >
                      Add your first package
                      <Icon name="plus" size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="manifest-footer">
              <span>
                <Icon name="info" size={14} />
                Up to 100 packages per load plan. Heights stay vertical.
              </span>
              <a href="/sample-packages.csv" download>
                <Icon name="download" size={14} />
                Download sample CSV
              </a>
            </div>
          </>
        )}
      </section>
      {result?.unplaced.length > 0 && (
        <section className="unplaced-section">
          <h3>
            <Icon name="alert" size={18} />
            Cargo that needs another plan <span>{result.unplaced.length}</span>
          </h3>
          {result.unplaced.map((p) => (
            <div key={p.id}>
              <strong>
                {p.label}
                <small>{p.id}</small>
              </strong>
              <p>{p.reason}</p>
            </div>
          ))}
        </section>
      )}
      <p className="algorithm-note">
        <Icon name="info" size={14} />
        DockPlan uses a deterministic extreme-point heuristic. Results are
        constraint-checked, but are not a guarantee of the mathematical optimum.{' '}
        <Link to="/guide">
          How it works
          <Icon name="external" size={12} />
        </Link>
      </p>
      {health?.storage === 'memory' && (
        <p className="memory-note">
          Plans are saved for this server session. Enable MongoDB for durable
          storage.
        </p>
      )}
      {editing !== undefined && (
        <PackageModal
          initial={editing}
          existingIds={plan.packages.map((p) => p.id)}
          onClose={() => setEditing(undefined)}
          onSave={(pkg) => {
            change({
              ...plan,
              packages: editing
                ? plan.packages.map((p) => (p.id === editing.id ? pkg : p))
                : [...plan.packages, pkg],
            });
            setEditing(undefined);
          }}
        />
      )}{' '}
      {instructions && (
        <Instructions
          plan={plan}
          result={result}
          onClose={() => setInstructions(false)}
        />
      )}
    </div>
  );
}
