import Icon from './Icon.jsx';
const fields = [
  ['length', 'Interior length'],
  ['width', 'Interior width'],
  ['height', 'Interior height'],
  ['maxPayloadKg', 'Max. payload'],
  ['rearDoorWidth', 'Rear-door width'],
  ['rearDoorHeight', 'Rear-door height'],
];
export default function VehicleForm({
  value,
  onChange,
  vehicles = [],
  onSave,
  busy,
}) {
  const update = (key, val) => onChange({ ...value, [key]: val });
  return (
    <div className="vehicle-form">
      <div className="vehicle-diagram">
        <svg
          viewBox="0 0 360 180"
          role="img"
          aria-label="Vehicle dimension preview"
        >
          <path
            d="M68 73 185 24 302 67 184 120 68 73Z"
            fill="#dbe5d8"
            stroke="#879c84"
          />
          <path
            d="M68 73v54l116 41v-48L68 73Zm116 47 118-53v55l-118 46v-48Z"
            fill="#edf1e9"
            stroke="#879c84"
          />
          <path d="M68 127 184 168 302 122" fill="none" stroke="#879c84" />
          <path
            d="m62 138 112 40m22-4 116-46M53 74v52"
            stroke="#698360"
            strokeDasharray="3 3"
          />
          <text x="92" y="166">
            {value.length} cm
          </text>
          <text x="257" y="160">
            {value.width} cm
          </text>
          <text x="18" y="107">
            {value.height}
          </text>
          <text x="89" y="115" fill="#3b6547">
            REAR
          </text>
        </svg>
        <span>
          <Icon name="info" size={14} /> X: length · Y: width · Z: height
        </span>
      </div>
      <div className="vehicle-fields">
        <fieldset disabled={busy}>
          {vehicles.length > 0 && (
            <label className="field">
              Saved vehicle
              <select
                value=""
                onChange={(e) => {
                  const v = vehicles.find((v) => v._id === e.target.value);
                  if (v) onChange(v);
                }}
              >
                <option value="">Select a saved vehicle</option>
                {vehicles.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            Vehicle name
            <input
              required
              maxLength={100}
              value={value.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <div className="form-grid">
            {fields.map(([key, label]) => (
              <label className="field" key={key}>
                {label}
                <div className="input-unit">
                  <input
                    required
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={value[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                  <span>{key === 'maxPayloadKg' ? 'kg' : 'cm'}</span>
                </div>
              </label>
            ))}
          </div>
          {onSave && (
            <button
              className="button secondary small"
              type="button"
              disabled={busy}
              onClick={onSave}
            >
              <Icon name="save" size={16} /> Save vehicle preset
            </button>
          )}
        </fieldset>
      </div>
    </div>
  );
}
