import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { apiFetch } from '../../api/client';

/** Foto tal y como la devuelve `GET /api/v1/properties/{id}/images`. */
export type PropertyImage = { id: number; url: string; position: number };

type UploadUrlResponse = {
  image: PropertyImage;
  upload_url: string;
  headers: Record<string, string>;
};

type PropertyImageManagerProps = {
  propertyId: number | string;
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGES = 20;

/** Devuelve el motivo por el que no se puede subir el fichero, o null si es válido. */
export function fileError(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `${file.name}: solo se admiten fotos JPG, PNG o WebP.`;
  }
  if (file.size > MAX_FILE_SIZE) return `${file.name}: la foto supera los 5 MB.`;
  return null;
}

/**
 * Gestor de fotos de un anuncio (US 6.2.2): subida directa a S3 con URL prefirmada,
 * portada, orden y borrado. La primera foto es la portada del anuncio.
 */
function PropertyImageManager({ propertyId }: PropertyImageManagerProps) {
  const base = `/api/v1/properties/${encodeURIComponent(String(propertyId))}/images`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(base)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: PropertyImage[]) => {
        if (!cancelled) setImages(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [base]);

  const uploadOne = async (file: File): Promise<PropertyImage> => {
    const response = await apiFetch(`${base}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
    });
    if (!response.ok) {
      throw new Error(
        response.status === 409
          ? `${file.name}: el anuncio ya tiene el máximo de ${MAX_IMAGES} fotos.`
          : `${file.name}: no se pudo preparar la subida.`,
      );
    }
    const { image, upload_url: uploadUrl, headers } = (await response.json()) as UploadUrlResponse;
    try {
      const put = await fetch(uploadUrl, { method: 'PUT', headers, body: file });
      if (!put.ok) throw new Error('upload failed');
    } catch {
      // La foto quedó reservada en la API: se quita para no dejar una foto rota.
      await apiFetch(`${base}/${image.id}`, { method: 'DELETE' }).catch(() => undefined);
      throw new Error(`${file.name}: no se pudo subir la foto.`);
    }
    return image;
  };

  const addFiles = async (files: File[]) => {
    const problems: string[] = [];
    const valid = files.filter((file) => {
      const problem = fileError(file);
      if (problem) problems.push(problem);
      return !problem;
    });
    setErrors(problems);
    if (valid.length === 0) return;

    setUploading((count) => count + valid.length);
    for (const file of valid) {
      try {
        const image = await uploadOne(file);
        setImages((current) => [...current, image]);
      } catch (error) {
        setErrors((current) => [...current, (error as Error).message]);
      } finally {
        setUploading((count) => count - 1);
      }
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void addFiles(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  };

  const saveOrder = async (ordered: PropertyImage[]) => {
    const previous = images;
    setImages(ordered.map((image, position) => ({ ...image, position })));
    const response = await apiFetch(`${base}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_ids: ordered.map(({ id }) => id) }),
    }).catch(() => null);
    if (!response?.ok) {
      setImages(previous);
      setErrors(['No se pudo guardar el orden de las fotos.']);
    }
  };

  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= images.length) return;
    const ordered = [...images];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    void saveOrder(ordered);
  };

  const makeCover = (index: number) => {
    if (index === 0) return;
    const ordered = [images[index], ...images.filter((_, i) => i !== index)];
    void saveOrder(ordered);
  };

  const remove = async (image: PropertyImage) => {
    const previous = images;
    setImages(images.filter(({ id }) => id !== image.id));
    const response = await apiFetch(`${base}/${image.id}`, { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) {
      setImages(previous);
      setErrors(['No se pudo eliminar la foto.']);
    }
  };

  return (
    <section className="image-manager" aria-labelledby="image-manager-title">
      <h2 id="image-manager-title">Fotos del anuncio</h2>
      <p className="image-manager__hint">
        JPG, PNG o WebP de hasta 5 MB. La primera foto es la portada; usa las flechas para cambiar
        el orden.
      </p>

      <div
        className={`image-manager__dropzone${isDragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <p>Arrastra aquí tus fotos o</p>
        <button
          type="button"
          className="image-manager__pick"
          onClick={() => inputRef.current?.click()}
          disabled={images.length >= MAX_IMAGES}
        >
          Elegir fotos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          hidden
          aria-label="Elegir fotos"
          onChange={handleInput}
        />
      </div>

      {uploading > 0 && (
        <p className="image-manager__status" role="status">
          Subiendo {uploading === 1 ? '1 foto' : `${uploading} fotos`}…
        </p>
      )}
      {errors.length > 0 && (
        <ul className="image-manager__errors" role="alert">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}

      {images.length > 0 && (
        <ol className="image-manager__grid" aria-label="Fotos del anuncio">
          {images.map((image, index) => (
            <li className="image-manager__item" key={image.id}>
              <img src={image.url} alt={`Foto ${index + 1}`} />
              {index === 0 && <span className="image-manager__badge">Portada</span>}
              <div className="image-manager__actions">
                <button
                  type="button"
                  aria-label={`Usar la foto ${index + 1} como portada`}
                  aria-pressed={index === 0}
                  onClick={() => makeCover(index)}
                >
                  ★
                </button>
                <button
                  type="button"
                  aria-label={`Mover la foto ${index + 1} a la izquierda`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={`Mover la foto ${index + 1} a la derecha`}
                  disabled={index === images.length - 1}
                  onClick={() => move(index, 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar la foto ${index + 1}`}
                  onClick={() => void remove(image)}
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default PropertyImageManager;
