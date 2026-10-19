import { useRef } from 'react';
import { OPERATIONS, SPACE_TYPES } from '../catalog/spaceTypes.js';
import { SearchIcon } from './icons.jsx';

const OPERATION_IDS = Object.keys(OPERATIONS);

/**
 * Buscador controlado: el estado vive en HomePage, que también lo cambia desde
 * la cabecera, la cuadrícula de tipos y los chips de filtros.
 */
function HeroSearch({ search, onChange, onSubmit, totalListings }) {
  const tabRefs = useRef({});

  const selectTab = (operation) => {
    onChange({ ...search, operation });
    tabRefs.current[operation]?.focus();
  };

  // Patrón de pestañas de WAI-ARIA: flechas, Inicio y Fin mueven la selección.
  const handleTabKeyDown = (event) => {
    const index = OPERATION_IDS.indexOf(search.operation);
    const last = OPERATION_IDS.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectTab(OPERATION_IDS[next]);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(search);
  };

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__inner">
        <p className="hero__eyebrow">Pisos · Casas · Locales · Oficinas · Garajes · Trasteros</p>
        <h1 id="hero-title" className="hero__title">
          Compra o alquila el espacio que necesitas
        </h1>
        <p className="hero__subtitle">
          Viviendas, locales y espacios de trabajo en Barcelona y alrededores, reunidos en un solo buscador.
        </p>

        <div className="search-card">
          <div className="search-card__tabs" role="tablist" aria-label="Tipo de operación">
            {OPERATION_IDS.map((operation) => {
              const isSelected = search.operation === operation;
              return (
                <button
                  key={operation}
                  ref={(element) => { tabRefs.current[operation] = element; }}
                  id={`search-tab-${operation}`}
                  className="search-card__tab"
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="search-panel"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => selectTab(operation)}
                  onKeyDown={handleTabKeyDown}
                >
                  {OPERATIONS[operation].tab}
                </button>
              );
            })}
          </div>

          <form
            id="search-panel"
            className="search-card__form"
            role="tabpanel"
            aria-labelledby={`search-tab-${search.operation}`}
            onSubmit={handleSubmit}
          >
            <div className="field field--location">
              <label htmlFor="search-location">Ubicación</label>
              <input
                id="search-location"
                type="search"
                placeholder="Ciudad, barrio o código postal"
                autoComplete="off"
                value={search.location}
                onChange={(event) => onChange({ ...search, location: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="search-space-type">Tipo de espacio</label>
              <select
                id="search-space-type"
                value={search.spaceType}
                onChange={(event) => onChange({ ...search, spaceType: event.target.value })}
              >
                <option value="all">Todos</option>
                {SPACE_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.plural}</option>
                ))}
              </select>
            </div>
            <button className="button button--accent search-card__submit" type="submit">
              <SearchIcon size={20} />
              Buscar
            </button>
          </form>
        </div>

        <ul className="hero__facts" aria-label="El portal en cifras">
          <li><strong>{totalListings}</strong> anuncios</li>
          <li><strong>{SPACE_TYPES.length}</strong> tipos de espacio</li>
          <li><strong>Venta</strong> y alquiler</li>
        </ul>
      </div>
    </section>
  );
}

export default HeroSearch;
