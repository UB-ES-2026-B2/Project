import { useEffect, useMemo, useRef, useState } from 'react';
import useProperties from '../../components/catalog/useProperties.js';
import {
  EMPTY_FILTERS,
  countBySpaceType,
  describeResults,
  filterProperties,
} from '../../components/catalog/filterProperties.js';
import { BRAND_NAME } from '../../components/landing/brand.js';
import FeaturedListings from '../../components/landing/FeaturedListings.jsx';
import HeroSearch from '../../components/landing/HeroSearch.jsx';
import HowItWorks from '../../components/landing/HowItWorks.jsx';
import SiteFooter from '../../components/landing/SiteFooter.jsx';
import SiteHeader from '../../components/landing/SiteHeader.jsx';
import SpaceTypeGrid from '../../components/landing/SpaceTypeGrid.jsx';

const INITIAL_SEARCH = { operation: 'sale', location: '', spaceType: 'all' };
const NOTICE_DURATION_MS = 4000;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function HomePage() {
  const { properties, isLoading } = useProperties();
  // `search` es lo que hay escrito en el buscador; `filters`, lo que se está aplicando.
  const [search, setSearch] = useState(INITIAL_SEARCH);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [notice, setNotice] = useState('');
  const resultsTitleRef = useRef(null);

  const results = useMemo(() => filterProperties(properties, filters), [properties, filters]);
  const counts = useMemo(() => countBySpaceType(properties), [properties]);

  useEffect(() => {
    document.title = `${BRAND_NAME} · Compra y alquiler de pisos, locales, oficinas y más`;
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const showResults = () => {
    const title = resultsTitleRef.current;
    if (!title) return;
    title.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    title.focus({ preventScroll: true });
  };

  const applyFilters = (nextFilters) => {
    setFilters(nextFilters);
    setSearch((current) => ({
      operation: nextFilters.operation ?? current.operation,
      location: nextFilters.location,
      spaceType: nextFilters.spaceType,
    }));
    showResults();
  };

  const handleRemoveFilter = (key) => {
    applyFilters({ ...filters, [key]: EMPTY_FILTERS[key] });
  };

  return (
    <>
      <a className="skip-link" href="#destacados">Saltar a los anuncios</a>
      <SiteHeader
        onSelectOperation={(operation) => applyFilters({ ...filters, operation })}
        onComingSoon={(feature) => setNotice(`${feature}: próximamente.`)}
      />
      <main id="inicio" className="home">
        <HeroSearch
          search={search}
          onChange={setSearch}
          onSubmit={(submitted) => applyFilters({ ...submitted, location: submitted.location.trim() })}
          totalListings={properties.length}
        />
        <div className="home__content">
          <SpaceTypeGrid
            counts={counts}
            activeType={filters.spaceType}
            onSelect={(spaceType) => applyFilters({ ...filters, spaceType })}
          />
          <FeaturedListings
            ref={resultsTitleRef}
            properties={results}
            isLoading={isLoading}
            title={describeResults(results.length, filters)}
            filters={filters}
            onRemoveFilter={handleRemoveFilter}
            onClear={() => applyFilters(EMPTY_FILTERS)}
          />
          <HowItWorks onComingSoon={(feature) => setNotice(`${feature}: próximamente.`)} />
        </div>
      </main>
      <SiteFooter onSelectOperation={(operation) => applyFilters({ ...filters, operation })} />

      <div className="toast-region" role="status" aria-live="polite">
        {notice && <p className="toast">{notice}</p>}
      </div>
    </>
  );
}

export default HomePage;
