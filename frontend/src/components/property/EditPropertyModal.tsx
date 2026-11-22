import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '../../api/client';
import PropertyImageManager from './PropertyImageManager';

/** Anuncio tal y como lo devuelve `GET /api/v1/properties/mine`. */
export type OwnProperty = {
  id: number;
  title: string;
  location: string;
  price: number;
  previous_price: number | null;
  bedrooms: number;
  bathrooms: number;
  area: number;
  image_url: string | null;
  is_active: boolean;
};

type EditPropertyModalProps = {
  property: OwnProperty;
  onClose: () => void;
  onSaved: (property: OwnProperty) => void;
};

type FormValues = { title: string; price: string; area: string; bedrooms: string; bathrooms: string };

export function validateEdit(values: FormValues): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  const title = values.title.trim();
  if (title.length < 5 || title.length > 120) errors.title = 'El título debe tener entre 5 y 120 caracteres.';
  const price = Number(values.price);
  if (!values.price.trim() || !Number.isFinite(price) || price <= 0) errors.price = 'Introduce un precio mayor que cero.';
  const area = Number(values.area);
  if (!Number.isInteger(area) || area <= 0) errors.area = 'Introduce una superficie entera mayor que cero.';
  for (const field of ['bedrooms', 'bathrooms'] as const) {
    const value = Number(values[field]);
    if (!Number.isInteger(value) || value < 0 || value > 50) errors[field] = 'Introduce un número entre 0 y 50.';
  }
  return errors;
}

/** Diálogo para editar un anuncio propio (US 6.3.2), con sus fotos (US 6.2.2). */
function EditPropertyModal({ property, onClose, onSaved }: EditPropertyModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<FormValues>({
    title: property.title,
    price: String(property.price),
    area: String(property.area),
    bedrooms: String(property.bedrooms),
    bathrooms: String(property.bathrooms),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const errors = validateEdit(values);
  const isValid = Object.keys(errors).length === 0;

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const field = (name: keyof FormValues, label: string, type = 'number') => (
    <div className="property-form__field">
      <label htmlFor={`edit-${name}`}>{label}</label>
      <input
        id={`edit-${name}`}
        type={type}
        value={values[name]}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `edit-${name}-error` : undefined}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
      />
      {errors[name] && <p id={`edit-${name}-error`} className="property-form__error">{errors[name]}</p>}
    </div>
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      const response = await apiFetch(`/api/v1/properties/${property.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title.trim(),
          price: Number(values.price),
          area: Number(values.area),
          bedrooms: Number(values.bedrooms),
          bathrooms: Number(values.bathrooms),
        }),
      });
      if (!response.ok) throw new Error();
      onSaved((await response.json()) as OwnProperty);
    } catch {
      setError('No se pudieron guardar los cambios. Inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-property-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="edit-property-title">Editar anuncio</h2>
        <form className="property-form" onSubmit={handleSubmit} noValidate>
          {field('title', 'Título', 'text')}
          {field('price', 'Precio (€)')}
          {field('area', 'Superficie (m²)')}
          {field('bedrooms', 'Habitaciones')}
          {field('bathrooms', 'Baños')}
          {error && <p className="property-form__server-error" role="alert">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="modal__secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="create-property__submit" disabled={!isValid || isSaving}>
              {isSaving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
        <PropertyImageManager propertyId={property.id} />
      </div>
    </div>
  );
}

export default EditPropertyModal;
