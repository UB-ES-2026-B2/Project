import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';

type ImageGalleryLightboxProps = {
  images: string[];
  initialIndex: number;
  title: string;
  onClose: () => void;
};

function ImageGalleryLightbox({
  images,
  initialIndex,
  title,
  onClose,
}: ImageGalleryLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const changeImage = useCallback((direction: number) => {
    setCurrentIndex((current) => (
      (current + direction + images.length) % images.length
    ));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') changeImage(-1);
      if (event.key === 'ArrowRight') changeImage(1);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [changeImage, onClose]);

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>, index: number) => {
    setFailedImages((current) => ({ ...current, [index]: true }));
    event.currentTarget.style.display = 'none';
  };

  return (
    <div
      className="property-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Galería de fotos de ${title}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        className="property-lightbox__close"
        type="button"
        aria-label="Cerrar galería"
        onClick={onClose}
      >
        ×
      </button>
      <button
        className="property-lightbox__nav property-lightbox__nav--previous"
        type="button"
        aria-label="Foto anterior"
        onClick={() => changeImage(-1)}
        disabled={images.length < 2}
      >
        ‹
      </button>
      <div className="property-lightbox__image-wrap">
        {failedImages[currentIndex] ? (
          <p className="property-lightbox__fallback">Imagen no disponible</p>
        ) : (
          <img
            src={images[currentIndex]}
            alt={`${title} - foto ${currentIndex + 1}`}
            onError={(event) => handleImageError(event, currentIndex)}
          />
        )}
      </div>
      <button
        className="property-lightbox__nav property-lightbox__nav--next"
        type="button"
        aria-label="Foto siguiente"
        onClick={() => changeImage(1)}
        disabled={images.length < 2}
      >
        ›
      </button>
      <p className="property-lightbox__count" aria-live="polite">
        {currentIndex + 1} / {images.length}
      </p>
    </div>
  );
}

export default ImageGalleryLightbox;
