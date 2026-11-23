import { useCallback, useEffect, useState } from 'react';
import SiteFooter from '../../../components/landing/SiteFooter';
import SiteHeader from '../../../components/landing/SiteHeader';
import { apiFetch } from '../../api/client';
import EditPropertyModal, { type OwnProperty } from '../../components/property/EditPropertyModal';
import { useAuth } from '../../context/AuthContext';

const PLACEHOLDER_IMAGE = '/assets/property-placeholder.webp';
const formatPrice = (price: number) => `${new Intl.NumberFormat('es-ES').format(price)} €`;

/** Panel "Mis anuncios" (US 6.3.2): estado, activar/desactivar, editar y borrar. */
function MyPropertiesPage() {
  const { isAuthenticated } = useAuth();
  const [properties, setProperties] = useState<OwnProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState<OwnProperty | null>(null);
  const [deleting, setDeleting] = useState<OwnProperty | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    apiFetch('/api/v1/properties/mine')
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: { items: OwnProperty[] }) => {
        if (!cancelled) setProperties(data.items);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const replace = (updated: OwnProperty) => setProperties((current) => (
    current.map((property) => (property.id === updated.id ? updated : property))
  ));

  const toggle = async (property: OwnProperty) => {
    const isActive = !property.is_active;
    replace({ ...property, is_active: isActive });
    const response = await apiFetch(`/api/v1/properties/${property.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    }).catch(() => null);
    if (response?.ok) {
      setToast(isActive ? 'Anuncio activado.' : 'Anuncio desactivado: ya no sale en las búsquedas.');
    } else {
      replace(property);
      setToast('No se pudo cambiar el estado del anuncio.');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    const response = await apiFetch(`/api/v1/properties/${target.id}`, { method: 'DELETE' }).catch(() => null);
    if (response?.ok) {
      setProperties((current) => current.filter(({ id }) => id !== target.id));
      setToast('Anuncio eliminado.');
    } else {
      setToast('No se pudo eliminar el anuncio.');
    }
  };

  const handleSaved = useCallback((updated: OwnProperty) => {
    replace(updated);
    setEditing(null);
    setToast('Cambios guardados.');
  }, []);
  const handleClose = useCallback(() => setEditing(null), []);

  if (!isAuthenticated) {
    return (
      <>
        <SiteHeader />
        <main className="my-properties">
          <h1>Mis anuncios</h1>
          <p>Inicia sesión para gestionar tus anuncios.</p>
          <a className="create-property__submit" href="/login">Iniciar sesión</a>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="my-properties">
        <div className="my-properties__header">
          <h1>Mis anuncios</h1>
          <a className="create-property__submit" href="/publicar">Publicar anuncio</a>
        </div>

        {toast && <p className="my-properties__toast" role="status">{toast}</p>}
        {isLoading && <p aria-busy="true">Cargando tus anuncios…</p>}
        {!isLoading && loadError && (
          <p className="catalog-empty" role="alert">No se han podido cargar tus anuncios.</p>
        )}
        {!isLoading && !loadError && properties.length === 0 && (
          <p className="catalog-empty">Todavía no has publicado ningún anuncio.</p>
        )}

        {properties.length > 0 && (
          <ul className="my-properties__list" aria-label="Mis anuncios">
            {properties.map((property) => (
              <li className="my-properties__item" key={property.id}>
                <img src={property.image_url ?? PLACEHOLDER_IMAGE} alt="" />
                <div className="my-properties__info">
                  <a href={`/inmueble/${property.id}`}><strong>{property.title}</strong></a>
                  <span>{property.location}</span>
                  <span>{formatPrice(property.price)} · {property.area} m²</span>
                </div>
                <span className={`status-badge ${property.is_active ? 'is-active' : 'is-inactive'}`}>
                  {property.is_active ? 'Activo' : 'Desactivado'}
                </span>
                <div className="my-properties__actions">
                  <label className="switch">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={property.is_active}
                      aria-label={`Anuncio ${property.title} activo`}
                      onChange={() => void toggle(property)}
                    />
                    <span aria-hidden="true" />
                  </label>
                  <button type="button" onClick={() => setEditing(property)}>Editar</button>
                  <button type="button" className="danger" onClick={() => setDeleting(property)}>
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />

      {editing && <EditPropertyModal property={editing} onClose={handleClose} onSaved={handleSaved} />}

      {deleting && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-description"
          >
            <h2 id="delete-title">Eliminar anuncio</h2>
            <p id="delete-description">
              ¿Seguro que deseas eliminar este anuncio? Esta acción no se puede deshacer.
            </p>
            <div className="modal__actions">
              <button type="button" className="modal__secondary" onClick={() => setDeleting(null)}>
                Cancelar
              </button>
              <button type="button" className="danger" onClick={() => void confirmDelete()}>
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MyPropertiesPage;
