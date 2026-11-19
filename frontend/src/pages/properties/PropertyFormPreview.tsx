import PropertyCard from '../../../components/catalog/PropertyCard';

type PropertyFormPreviewProps = {
  isPreviewable: boolean;
  operationLabel: string;
  spaceTypeLabel: string;
  price: number;
  surface: number;
  address: string;
  description: string;
};

function PropertyFormPreview({
  isPreviewable,
  operationLabel,
  spaceTypeLabel,
  price,
  surface,
  address,
  description,
}: PropertyFormPreviewProps) {
  if (!isPreviewable) {
    return (
      <div className="property-form-preview__empty" role="status">
        Completa el tipo de operación, el espacio, el precio, la superficie y la dirección
        para previsualizar tu anuncio.
      </div>
    );
  }

  return (
    <div className="property-form-preview">
      <PropertyCard
        property={{
          id: 'preview',
          title: `${spaceTypeLabel} en ${operationLabel.toLowerCase()}`,
          location: address,
          price,
          area: surface,
          images: [],
        }}
        showFavorite={false}
        showDetailsLink={false}
      />
      <section className="property-form-preview__description" aria-labelledby="preview-description-title">
        <h3 id="preview-description-title">Descripción</h3>
        <p>{description.trim() || 'La descripción de tu anuncio aparecerá aquí.'}</p>
      </section>
    </div>
  );
}

export default PropertyFormPreview;
