import { useEffect, useState } from 'react';
import { useAuth, AccountNotice } from '../auth/AuthContext.jsx';
import { api, post } from '../services/api.js';
import { defaultVehicle } from '../data/demo.js';
import Icon from '../components/Icon.jsx';
import VehicleForm from '../components/VehicleForm.jsx';
export default function Vehicles() {
  const auth = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [value, setValue] = useState({ ...defaultVehicle });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (auth.user ? api('/vehicles') : Promise.resolve([]))
      .then(setVehicles)
      .catch((e) => setError(e.message));
  }, [auth.user]);
  async function save(e) {
    e.preventDefault();
    if (!auth.user) {
      setError('Sign in with Google to save vehicle presets.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await post('/vehicles', value);
      setVehicles([saved, ...vehicles]);
      setNotice(
        'Vehicle preset saved. Select it when configuring a load plan.',
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            <span />
            YOUR FLEET, MEASURED
          </div>
          <h1>Know your space.</h1>
          <p>Set up a vehicle once. Plan the next load a little faster.</p>
        </div>
        <Icon name="truck" size={48} />
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice-banner" role="status">
          {notice}
        </div>
      )}
      <AccountNotice />
      <div className="content-card">
        <div className="card-heading">
          <h2>Vehicle configuration</h2>
          <span className="mini-label">CENTIMETRES · KILOGRAMS</span>
        </div>
        <form onSubmit={save} className="vehicle-page-form">
          <VehicleForm value={value} onChange={setValue} busy={busy} />
          <div className="modal-actions">
            <button className="button primary" disabled={busy}>
              <Icon name="save" size={16} />
              Save vehicle preset
            </button>
          </div>
        </form>
      </div>
      <div className="section-heading">
        <h2>
          Saved vehicles <span>{vehicles.length}</span>
        </h2>
      </div>
      <div className="vehicle-cards">
        {vehicles.length ? (
          vehicles.map((v) => (
            <button
              className="vehicle-preset"
              key={v._id}
              onClick={() => {
                setValue(v);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <span className="metric-icon">
                <Icon name="truck" size={25} />
              </span>
              <strong>{v.name}</strong>
              <span>
                {v.length} × {v.width} × {v.height} cm
              </span>
              <small>
                {v.maxPayloadKg} kg payload · door {v.rearDoorWidth} ×{' '}
                {v.rearDoorHeight} cm
              </small>
              <span className="text-link">
                Use these dimensions
                <Icon name="arrow" size={15} />
              </span>
            </button>
          ))
        ) : (
          <div className="empty-state">
            <Icon name="truck" size={32} />
            <h3>Your first vehicle is a measurement away.</h3>
            <p>Save the configuration above to create your first preset.</p>
          </div>
        )}
      </div>
    </div>
  );
}
