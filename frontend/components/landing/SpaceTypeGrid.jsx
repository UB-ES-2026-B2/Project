import { SPACE_TYPES } from '../catalog/spaceTypes.js';
import { SpaceTypeIcon } from './icons.jsx';

function SpaceTypeGrid({ counts, activeType, onSelect }) {
  return (
    <section id="tipos" className="section" aria-labelledby="tipos-title">
      <div className="section__header">
        <h2 id="tipos-title" className="section__title">Explora por tipo de espacio</h2>
        <p className="section__lead">
          No solo viviendas: encuentra también el local para tu negocio, una oficina o dónde aparcar.
        </p>
      </div>
      <ul className="space-types">
        {SPACE_TYPES.map((type) => {
          const count = counts[type.id] ?? 0;
          return (
            <li key={type.id}>
              <button
                className="space-type"
                type="button"
                aria-pressed={activeType === type.id}
                onClick={() => onSelect(type.id)}
              >
                <span className="space-type__icon"><SpaceTypeIcon type={type.id} size={28} /></span>
                <span className="space-type__label">{type.plural}</span>
                <span className="space-type__count">
                  {count} {count === 1 ? 'anuncio' : 'anuncios'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default SpaceTypeGrid;
