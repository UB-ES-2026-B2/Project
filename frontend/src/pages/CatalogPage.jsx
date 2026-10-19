import PropertyCard, { PropertyCardSkeleton } from '../../components/catalog/PropertyCard.tsx';
import useProperties from '../../components/catalog/useProperties.js';

// Pantalla inicial del equipo de frontend (PR #5 y #6), conservada tal cual como
// catálogo completo. Se abre desde la landing en #/catalogo.
function CatalogPage() {
  const { properties, isLoading } = useProperties();

  return (
    <main className="app">
      <a className="catalog-back" href="#inicio">← Volver al inicio</a>
      <header className="page-header">
        <p className="eyebrow">HOGARES EN BARCELONA</p>
        <h1>Encuentra tu próximo hogar</h1>
      </header>
      <section className="property-grid" aria-label="Inmuebles disponibles">
        {isLoading
          ? Array.from({ length: 3 }, (_, index) => <PropertyCardSkeleton key={index} />)
          : properties.map((property) => <PropertyCard key={property.id} property={property} />)}
      </section>
    </main>
  );
}

export default CatalogPage;
