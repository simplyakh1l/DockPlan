import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
export default function Guide() {
  return (
    <div className="page guide-page">
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            <span />
            THE FIELD GUIDE
          </div>
          <h1>A good load has a logic.</h1>
          <p>Here’s the thinking behind every box DockPlan places.</p>
        </div>
        <Link className="button primary" to="/plans/demo">
          Try the demo
          <Icon name="arrow" size={17} />
        </Link>
      </div>
      <div className="guide-grid">
        {[
          [
            '01',
            'Measure the van',
            'Enter interior length, width, height, rear-door opening and maximum payload. All measurements use centimetres and kilograms. The preview uses X along the length, Y across the width and Z vertically. The floor-level door is centered across the width.',
          ],
          [
            '02',
            'Tell us about the cargo',
            'Add packages manually or import the sample CSV. Assign delivery stop numbers in route order. Fragile and no-stack boxes cannot support cargo. Allow base rotation only when a 90° turn is acceptable.',
          ],
          [
            '03',
            'Find a feasible fit',
            'The engine tries three deterministic package orderings and tests extreme points around placed boxes. It rejects overlaps, boundary or payload failures, invalid support, stacking violations and blocked delivery sequences.',
          ],
          [
            '04',
            'Inspect, then hit the road',
            'Rotate the 3D scene, select any package, and check all unplaced cargo. Simulate each stop to verify access. Loading instructions reverse the safe unloading sequence; export the coordinates or print a PDF.',
          ],
        ].map(([n, title, copy]) => (
          <article className="guide-step" key={n}>
            <span>{n}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </div>
      <section className="guide-details">
        <div>
          <span className="eyebrow subtle">WHAT THE ENGINE ASSUMES</span>
          <h2>
            Simple geometry.
            <br />
            Clear boundaries.
          </h2>
        </div>
        <div>
          <p>
            Each package is an upright, axis-aligned box. It can rotate 0° or
            90° on its base. A package on another package needs at least 70% of
            its bottom footprint supported. Fragile and no-stack packages keep
            their top surfaces clear.
          </p>
          <p>
            Unloading follows a straight line through the rear door along
            negative X. Every box stays within the centered, floor-level door’s
            width and height corridor; side space outside that corridor is
            intentionally unused. Packages closer to the door obstruct boxes
            behind them when their Y/Z footprints overlap. Same-stop cargo is
            sequenced so blockers and upper boxes leave first.
          </p>
          <p>
            Maximum stacking load is conservative: each supporting box carries
            the full weight of every box above it, including indirect stacks.
            DockPlan does not model a moving vehicle, weight balance, friction,
            load securing, tilting or physical lifting.
          </p>
          <p>
            The heuristic finds useful, valid arrangements, but may leave a box
            unplaced even when a different arrangement could fit it. Always
            review the cargo and secure the real load.
          </p>
          <a className="text-link" href="/sample-packages.csv" download>
            Download the sample manifest
            <Icon name="download" size={16} />
          </a>
        </div>
      </section>
    </div>
  );
}
