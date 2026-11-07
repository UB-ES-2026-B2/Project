import { SpaceTypeIcon } from './icons.jsx';

const SPACE_TYPES = [
  { id: 'piso', label: 'Pisos', description: 'Vivienda urbana' },
  { id: 'casa', label: 'Casas', description: 'Más espacio para vivir' },
  { id: 'local', label: 'Locales', description: 'Ideas que toman forma' },
  { id: 'oficina', label: 'Oficinas', description: 'Tu próximo espacio de trabajo' },
  { id: 'garaje', label: 'Garajes', description: 'Un sitio para aparcar' },
  { id: 'trastero', label: 'Trasteros', description: 'Espacio extra para guardar' },
];

function SpaceTypeGrid() {
  return (
    <section id="tipos" className="home-section space-type-section" aria-labelledby="types-title">
      <div className="home-section__header">
        <div>
          <p className="home-section__eyebrow">MÁS QUE VIVIENDAS</p>
          <h2 id="types-title" className="home-section__title">Explora por tipo de espacio</h2>
        </div>
        <p className="home-section__description">
          Encuentra el lugar que encaja con tu forma de vivir, trabajar o emprender.
        </p>
      </div>
      <ul className="space-types">
        {SPACE_TYPES.map(({ id, label, description }) => (
          <li className="space-type" key={id}>
            <span className="space-type__icon">
              <SpaceTypeIcon type={id} size={26} />
            </span>
            <span className="space-type__label">{label}</span>
            <span className="space-type__description">{description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SpaceTypeGrid;
