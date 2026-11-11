import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, post } from '../services/api.js';
import { demoPlan } from '../data/demo.js';
import { useAuth, AccountNotice } from '../auth/AuthContext.jsx';
import Icon from '../components/Icon.jsx';
const CargoViewer = lazy(() => import('../components/CargoViewer.jsx'));

export default function Dashboard({ health }) {
  const auth = useAuth();
  const [plans, setPlans] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([
      auth.user ? api('/load-plans') : Promise.resolve([]),
      post('/optimize', demoPlan),
    ])
      .then(([saved, optimized]) => {
        if (active) {
          setPlans(saved);
          setResult(optimized);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [auth.user]);
  async function removePlan(id) {
    try {
      await api(`/load-plans/${id}`, { method: 'DELETE' });
      setPlans(plans.filter((p) => p._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="page dashboard">
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            <span /> THE LOADING DESK
          </div>
          <h1>
            A little planning.
            <br />A much better delivery.
          </h1>
          <p>Make the most of your van. Make every stop easier.</p>
        </div>
        <Link className="button primary" to="/plans/new">
          <Icon name="plus" size={18} />
          Create load plan
        </Link>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </div>
      )}
      <section className="hero-card">
        <div className="hero-copy">
          <span className="pill light">
            <span className="pulse-dot" />
            MEET YOUR NEXT LOAD
          </span>
          <h2>
            Everything fits.
            <br />
            In the right order.
          </h2>
          <p>
            Pack smarter with 3D cargo planning that thinks about your last stop
            as much as your first.
          </p>
          <Link className="button primary" to="/plans/demo">
            Explore the demo
            <Icon name="arrow" size={17} />
          </Link>
          <div className="hero-footnote">
            <Icon name="check" size={14} />
            Real cargo. Real coordinates. No guesswork.
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-visual-heading">
            <span>
              <i /> DELIVERY-AWARE PACKING
            </span>
            <span>LIVE PREVIEW</span>
          </div>
          {result ? (
            <Suspense
              fallback={<div className="viewer-fallback">Preparing 3D…</div>}
            >
              <CargoViewer
                vehicle={demoPlan.vehicle}
                result={result}
                miniature
              />
            </Suspense>
          ) : (
            <div className="viewer-fallback">
              <Icon name="cube" size={38} />
              {loading
                ? 'Finding a better fit…'
                : 'Start the API to explore the live demo.'}
            </div>
          )}
          <div className="floating-route">
            <span className="route-ring">
              <Icon name="route" size={19} />
            </span>
            <div>
              <strong>Northside · Afternoon route</strong>
              <small>
                16 packages <span>·</span> 4 delivery stops
              </small>
            </div>
            <span className="route-tag">DEMO</span>
          </div>
        </div>
      </section>
      <div className="metric-grid dashboard-metrics">
        <div className="metric-card">
          <span className="metric-icon">
            <Icon name="cube" />
          </span>
          <div>
            <span className="metric-caption">A place for every package</span>
            <strong>
              {result
                ? `${result.placed.length} / ${demoPlan.packages.length}`
                : '—'}
              <small>packages placed</small>
            </strong>
          </div>
          <span className="metric-note">DEMO LOAD</span>
        </div>
        <div className="metric-card">
          <span className="metric-icon">
            <Icon name="layers" />
          </span>
          <div>
            <span className="metric-caption">Space put to work</span>
            <strong>
              {result?.metrics.volumeUtilization ?? '—'}
              <em>%</em>
              <small>volume utilization</small>
            </strong>
          </div>
          <div className="utilization-meter" aria-hidden="true">
            <i
              style={{ width: `${result?.metrics.volumeUtilization ?? 0}%` }}
            />
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-icon">
            <Icon name="route" />
          </span>
          <div>
            <span className="metric-caption">Ready for the road</span>
            <strong>
              {result
                ? result.accessibility.valid
                  ? 'All clear'
                  : 'Review'
                : '—'}
              <small>delivery accessibility</small>
            </strong>
          </div>
          <span className="success-circle">
            <Icon name="check" size={17} />
          </span>
        </div>
      </div>
      <AccountNotice />
      <section className="recent-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow subtle">PICK UP WHERE YOU LEFT OFF</span>
            <h2>
              Your load plans <span>{plans.length}</span>
            </h2>
          </div>
          <Link to="/plans/new" className="text-link">
            New plan
            <Icon name="plus" size={16} />
          </Link>
        </div>
        <div className="plans-table">
          <div className="plans-table-head">
            <span>LOAD PLAN</span>
            <span>VEHICLE</span>
            <span>LAST UPDATED</span>
            <span />
          </div>
          {plans.length ? (
            plans.map((p) => (
              <div key={p._id} className="plan-row">
                <Link to={`/plans/${p._id}`} className="plan-name">
                  <span className="plan-box">
                    <Icon name="box" size={21} />
                  </span>
                  <div>
                    <strong>{p.name}</strong>
                    <small>Saved load plan</small>
                  </div>
                </Link>
                <span className="vehicle-cell">
                  <Icon name="truck" size={16} />
                  {p.vehicle.name}
                </span>
                <span className="date-cell">
                  {new Date(p.updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <div className="row-actions">
                  <button
                    aria-label={`Delete ${p.name}`}
                    title="Delete plan"
                    onClick={() => removePlan(p._id)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                  <Link to={`/plans/${p._id}`} aria-label={`Open ${p.name}`}>
                    <Icon name="arrow" size={18} />
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-plans">
              <span className="plan-box">
                <Icon name="layers" size={25} />
              </span>
              <div>
                <strong>Your next great load starts here.</strong>
                <p>Create a plan or take our 16-package demo for a spin.</p>
              </div>
              <Link to="/plans/demo" className="button secondary small">
                Open demo
                <Icon name="arrow" size={15} />
              </Link>
            </div>
          )}
          {auth.user && health?.storage !== 'mongodb' && (
            <div className="table-note">
              <Icon name="info" size={14} />
              Local development storage resets on restart. Connect MongoDB for
              durable account storage.
            </div>
          )}
        </div>
      </section>
      <div className="workflow-strip">
        <span className="eyebrow subtle">FROM EMPTY VAN TO OPEN ROAD</span>
        <div>
          <span>
            <b>01</b>Define your vehicle
          </span>
          <Icon name="chevron" size={15} />
          <span>
            <b>02</b>Add your cargo
          </span>
          <Icon name="chevron" size={15} />
          <span>
            <b>03</b>Find the best fit
          </span>
          <Icon name="chevron" size={15} />
          <span>
            <b>04</b>Deliver in order
          </span>
        </div>
      </div>
    </div>
  );
}
