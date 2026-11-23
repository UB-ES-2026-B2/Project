import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import SiteFooter from '../../../components/landing/SiteFooter';
import SiteHeader from '../../../components/landing/SiteHeader';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import PropertyFormPreview from './PropertyFormPreview';

type PropertyFormValues = {
  operation: string;
  spaceType: string;
  price: string;
  surface: string;
  address: string;
  description: string;
};

type PropertyFormErrors = Partial<Record<keyof PropertyFormValues, string>>;
type PropertyField = keyof PropertyFormValues;

const OPERATIONS = [
  { value: 'venta', label: 'Venta' },
  { value: 'alquiler', label: 'Alquiler' },
];

const SPACE_TYPES = [
  { value: 'piso', label: 'Piso' },
  { value: 'casa', label: 'Casa' },
  { value: 'local', label: 'Local' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'garaje', label: 'Garaje' },
  { value: 'trastero', label: 'Trastero' },
];

const INITIAL_VALUES: PropertyFormValues = {
  operation: '',
  spaceType: '',
  price: '',
  surface: '',
  address: '',
  description: '',
};

function validate(values: PropertyFormValues): PropertyFormErrors {
  const errors: PropertyFormErrors = {};
  const price = Number(values.price);
  const surface = Number(values.surface);

  if (!values.operation) errors.operation = 'Selecciona el tipo de operación.';
  if (!values.spaceType) errors.spaceType = 'Selecciona el tipo de espacio.';
  if (!values.price.trim() || !Number.isFinite(price) || price <= 0) {
    errors.price = 'Introduce un precio mayor que cero.';
  }
  if (!values.surface.trim() || !Number.isInteger(surface) || surface <= 0) {
    errors.surface = 'Introduce una superficie entera mayor que cero.';
  }
  if (!values.address.trim()) errors.address = 'Introduce la dirección del inmueble.';
  if (!values.description.trim()) errors.description = 'Introduce una descripción.';

  return errors;
}

function CreatePropertyPage() {
  const { isAuthenticated } = useAuth();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [touched, setTouched] = useState<Partial<Record<PropertyField, boolean>>>({});
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const errors = validate(values);
  const isValid = Object.keys(errors).length === 0;
  const isPreviewable = Boolean(
    values.operation
    && values.spaceType
    && values.price.trim()
    && Number.isFinite(Number(values.price))
    && Number(values.price) > 0
    && values.surface.trim()
    && Number.isInteger(Number(values.surface))
    && Number(values.surface) > 0
    && values.address.trim(),
  );

  const updateField = (field: PropertyField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setTouched((current) => ({ ...current, [field]: true }));
    setServerError('');
    setSuccessMessage('');
  };

  const handleChange = (field: PropertyField) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => updateField(field, event.target.value);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !isValid) return;

    setIsSubmitting(true);
    setServerError('');
    setSuccessMessage('');
    try {
      const response = await apiFetch('/api/v1/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: values.operation,
          space_type: values.spaceType,
          price: Number(values.price),
          surface_m2: Number(values.surface),
          address: values.address.trim(),
          description: values.description.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Tu sesión ha caducado. Inicia sesión de nuevo para publicar el anuncio.'
            : 'No se pudo publicar el anuncio. Inténtalo de nuevo.',
        );
      }

      setSuccessMessage('Tu anuncio se ha publicado correctamente.');
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'No se pudo publicar el anuncio. Inténtalo de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleError = (field: PropertyField) => (
    touched[field] ? errors[field] : undefined
  );

  if (!isAuthenticated) {
    return (
      <>
        <SiteHeader />
        <main className="create-property-page">
          <section className="create-property-card" aria-labelledby="create-property-title">
            <h1 id="create-property-title">Inicia sesión para publicar</h1>
            <p>Necesitas una cuenta para crear y publicar un anuncio.</p>
            <a className="create-property__submit" href="/login">Iniciar sesión</a>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  const selectedOperation = OPERATIONS.find(({ value }) => value === values.operation);
  const selectedSpaceType = SPACE_TYPES.find(({ value }) => value === values.spaceType);

  return (
    <>
      <SiteHeader />
      <main className="create-property-page">
        <section className="create-property-heading" aria-labelledby="create-property-title">
          <p className="eyebrow">PUBLICA TU INMUEBLE</p>
          <h1 id="create-property-title">Crea tu anuncio</h1>
          <p>Cuéntanos qué espacio ofreces y cómo pueden encontrarlo.</p>
        </section>

        <div className="create-property-card">
          <div className="property-form__tabs" role="tablist" aria-label="Formulario del anuncio">
            <button
              id="property-edit-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === 'edit'}
              aria-controls="property-edit-panel"
              onClick={() => setActiveTab('edit')}
            >
              Modo Edición
            </button>
            <button
              id="property-preview-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === 'preview'}
              aria-controls="property-preview-panel"
              onClick={() => setActiveTab('preview')}
            >
              Modo Vista Previa
            </button>
          </div>

          {activeTab === 'edit' ? (
            <form
              id="property-edit-panel"
              className="property-form"
              role="tabpanel"
              aria-labelledby="property-edit-tab"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="property-form__field">
                <label htmlFor="property-operation">Operación</label>
                <select
                  id="property-operation"
                  name="operation"
                  value={values.operation}
                  aria-required="true"
                  aria-invalid={Boolean(visibleError('operation'))}
                  aria-describedby={visibleError('operation') ? 'property-operation-error' : undefined}
                  onChange={handleChange('operation')}
                  onBlur={() => setTouched((current) => ({ ...current, operation: true }))}
                >
                  <option value="">Selecciona una operación</option>
                  {OPERATIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {visibleError('operation') && (
                  <p id="property-operation-error" className="property-form__error">
                    {visibleError('operation')}
                  </p>
                )}
              </div>

              <div className="property-form__field">
                <label htmlFor="property-space-type">Tipo de espacio</label>
                <select
                  id="property-space-type"
                  name="spaceType"
                  value={values.spaceType}
                  aria-required="true"
                  aria-invalid={Boolean(visibleError('spaceType'))}
                  aria-describedby={visibleError('spaceType') ? 'property-space-type-error' : undefined}
                  onChange={handleChange('spaceType')}
                  onBlur={() => setTouched((current) => ({ ...current, spaceType: true }))}
                >
                  <option value="">Selecciona un tipo de espacio</option>
                  {SPACE_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {visibleError('spaceType') && (
                  <p id="property-space-type-error" className="property-form__error">
                    {visibleError('spaceType')}
                  </p>
                )}
              </div>

              <div className="property-form__field">
                <label htmlFor="property-price">Precio (€)</label>
                <input
                  id="property-price"
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={values.price}
                  aria-required="true"
                  aria-invalid={Boolean(visibleError('price'))}
                  aria-describedby={visibleError('price') ? 'property-price-error' : undefined}
                  onChange={handleChange('price')}
                  onBlur={() => setTouched((current) => ({ ...current, price: true }))}
                />
                {visibleError('price') && (
                  <p id="property-price-error" className="property-form__error">
                    {visibleError('price')}
                  </p>
                )}
              </div>

              <div className="property-form__field">
                <label htmlFor="property-surface">Superficie (m²)</label>
                <input
                  id="property-surface"
                  name="surface"
                  type="number"
                  min="1"
                  step="1"
                  value={values.surface}
                  aria-required="true"
                  aria-invalid={Boolean(visibleError('surface'))}
                  aria-describedby={visibleError('surface') ? 'property-surface-error' : undefined}
                  onChange={handleChange('surface')}
                  onBlur={() => setTouched((current) => ({ ...current, surface: true }))}
                />
                {visibleError('surface') && (
                  <p id="property-surface-error" className="property-form__error">
                    {visibleError('surface')}
                  </p>
                )}
              </div>

              <div className="property-form__field property-form__field--full">
                <label htmlFor="property-address">Dirección</label>
                <input
                  id="property-address"
                  name="address"
                  type="text"
                  autoComplete="street-address"
                  value={values.address}
                  aria-required="true"
                  aria-invalid={Boolean(visibleError('address'))}
                  aria-describedby={visibleError('address') ? 'property-address-error' : undefined}
                  onChange={handleChange('address')}
                  onBlur={() => setTouched((current) => ({ ...current, address: true }))}
                />
                {visibleError('address') && (
                  <p id="property-address-error" className="property-form__error">
                    {visibleError('address')}
                  </p>
                )}
              </div>

              <div className="property-form__field property-form__field--full">
                <label htmlFor="property-description">Descripción</label>
                <textarea
                  id="property-description"
                  name="description"
                  rows={5}
                  value={values.description}
                  aria-required="true"
                  aria-invalid={Boolean(visibleError('description'))}
                  aria-describedby={visibleError('description') ? 'property-description-error' : undefined}
                  onChange={handleChange('description')}
                  onBlur={() => setTouched((current) => ({ ...current, description: true }))}
                />
                {visibleError('description') && (
                  <p id="property-description-error" className="property-form__error">
                    {visibleError('description')}
                  </p>
                )}
              </div>

              {serverError && <p className="property-form__server-error" role="alert">{serverError}</p>}
              {successMessage && <p className="property-form__success" role="status">{successMessage}</p>}
              <button
                className="create-property__submit property-form__submit"
                type="submit"
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? 'Publicando…' : 'Publicar anuncio'}
              </button>
            </form>
          ) : (
            <div
              id="property-preview-panel"
              role="tabpanel"
              aria-labelledby="property-preview-tab"
            >
              <PropertyFormPreview
                isPreviewable={isPreviewable}
                operationLabel={selectedOperation?.label ?? ''}
                spaceTypeLabel={selectedSpaceType?.label ?? 'Inmueble'}
                price={Number(values.price)}
                surface={Number(values.surface)}
                address={values.address.trim()}
                description={values.description}
              />
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export default CreatePropertyPage;
