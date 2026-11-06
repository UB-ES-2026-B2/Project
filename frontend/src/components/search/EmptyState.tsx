type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Mensaje para cuando una búsqueda no devuelve resultados, con una acción para salir de él. */
function EmptyState({
  title,
  description,
  actionLabel = 'Limpiar búsqueda',
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__description">{description}</p>}
      {onAction && (
        <button className="empty-state__action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
