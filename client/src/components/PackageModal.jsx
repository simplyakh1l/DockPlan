import { useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
export default function PackageModal({
  initial,
  onSave,
  onClose,
  existingIds,
}) {
  let nextId = 1;
  while (existingIds.includes(`DP-${String(nextId).padStart(3, '0')}`))
    nextId++;
  const [data, setData] = useState(
    initial ?? {
      id: `DP-${String(nextId).padStart(3, '0')}`,
      label: '',
      length: '',
      width: '',
      height: '',
      weight: '',
      stop: 1,
      fragile: false,
      noStack: false,
      baseRotationAllowed: true,
      maxStackingLoadKg: '',
    },
  );
  const [error, setError] = useState('');
  const update = (key, value) => setData({ ...data, [key]: value });
  function submit(e) {
    e.preventDefault();
    if (existingIds.includes(data.id) && data.id !== initial?.id)
      return setError('A package already uses this ID.');
    if (!data.id.trim() || !data.label.trim())
      return setError('Enter an ID and a package label.');
    onSave({
      ...data,
      id: data.id.trim(),
      label: data.label.trim(),
      ...Object.fromEntries(
        ['length', 'width', 'height', 'weight', 'stop'].map((k) => [
          k,
          Number(data[k]),
        ]),
      ),
      maxStackingLoadKg:
        data.maxStackingLoadKg === '' || data.maxStackingLoadKg == null
          ? null
          : Number(data.maxStackingLoadKg),
    });
  }
  return (
    <Modal
      title={initial ? 'Edit package' : 'Add a package'}
      subtitle="A few details for a better load."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && (
          <div role="alert" className="error-banner">
            {error}
          </div>
        )}
        <div className="form-grid">
          <label className="field">
            Package ID
            <input
              autoFocus
              required
              maxLength={60}
              value={data.id}
              onChange={(e) => update('id', e.target.value)}
            />
          </label>
          <label className="field">
            Delivery stop
            <input
              required
              type="number"
              min="1"
              step="1"
              value={data.stop}
              onChange={(e) => update('stop', e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          Package label
          <input
            required
            maxLength={100}
            placeholder="e.g. Ceramic collection"
            value={data.label}
            onChange={(e) => update('label', e.target.value)}
          />
        </label>
        <div className="form-grid three">
          {[
            ['length', 'Length', 'cm'],
            ['width', 'Width', 'cm'],
            ['height', 'Height', 'cm'],
          ].map(([key, label, unit]) => (
            <label key={key} className="field">
              {label}
              <div className="input-unit">
                <input
                  required
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={data[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
                <span>{unit}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="form-grid">
          <label className="field">
            Weight
            <div className="input-unit">
              <input
                required
                type="number"
                min="0.1"
                step="0.1"
                value={data.weight}
                onChange={(e) => update('weight', e.target.value)}
              />
              <span>kg</span>
            </div>
          </label>
          <label className="field">
            Max. stacking load <small>optional</small>
            <div className="input-unit">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Unlimited"
                value={data.maxStackingLoadKg ?? ''}
                onChange={(e) => update('maxStackingLoadKg', e.target.value)}
              />
              <span>kg</span>
            </div>
          </label>
        </div>
        <div className="restriction-options">
          {[
            ['fragile', 'Fragile', 'Cannot support any package'],
            ['noStack', 'No stacking on top', 'Keep the top surface clear'],
            [
              'baseRotationAllowed',
              'Allow base rotation',
              'May rotate 90°; always kept upright',
            ],
          ].map(([key, label, hint]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={data[key]}
                onChange={(e) => update(key, e.target.checked)}
              />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            <Icon name="check" size={16} />
            {initial ? 'Save changes' : 'Add package'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
