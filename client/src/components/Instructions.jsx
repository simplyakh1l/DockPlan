import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
export default function Instructions({ plan, result, onClose }) {
  const sequence = [...result.unloadingOrder]
    .reverse()
    .map((id) => result.placed.find((p) => p.id === id));
  return (
    <Modal
      title="Loading instructions"
      subtitle={`${plan.name} · ${plan.vehicle.name}`}
      wide
      onClose={onClose}
    >
      <div className="print-instructions">
        <p className="instruction-note">
          <Icon name="info" size={18} /> Load in reverse unloading order.
          Positions are measured from the rear-left floor corner; keep each box
          upright.
        </p>
        <table>
          <thead>
            <tr>
              <th>Load</th>
              <th>Package</th>
              <th>Stop</th>
              <th>Position X / Y / Z</th>
              <th>Base rotation</th>
            </tr>
          </thead>
          <tbody>
            {sequence.map((p, i) => (
              <tr key={p.id}>
                <td>{String(i + 1).padStart(2, '0')}</td>
                <td>
                  <strong>{p.label}</strong>
                  <small>{p.id}</small>
                </td>
                <td>{p.stop}</td>
                <td>
                  {p.x} / {p.y} / {p.z} cm
                </td>
                <td>{p.rotation}°</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.unplaced.length > 0 && (
          <p className="error-banner">
            {result.unplaced.length} package(s) are unplaced. Do not load them
            using these instructions.
          </p>
        )}
        <p className="muted">
          Unloading: {result.unloadingOrder.join(' → ') || 'No packages placed'}
          . Straight extraction along −X; remove upper packages before their
          supports.
        </p>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Close
        </button>
        <button className="button primary" onClick={() => window.print()}>
          <Icon name="print" size={16} /> Print / Save PDF
        </button>
      </div>
    </Modal>
  );
}
