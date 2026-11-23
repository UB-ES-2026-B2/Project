import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PropertyImageManager, { fileError } from './PropertyImageManager.tsx';

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const BASE = '/api/v1/properties/7/images';

function fakeApi({ images = [], putFails = false, reorderFails = false } = {}) {
  let nextId = 100;
  const calls = [];
  const fetchMock = vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body });
    if (url === BASE && method === 'GET') return json(images);
    if (url === `${BASE}/upload-url`) {
      const { content_type: contentType } = JSON.parse(init.body);
      const id = nextId++;
      return json({
        image: { id, url: `/media/properties/7/${id}.jpg`, position: 0 },
        upload_url: `https://s3.example.com/${id}`,
        headers: { 'Content-Type': contentType },
      }, 201);
    }
    if (url.startsWith('https://s3.example.com/')) return { ok: !putFails, status: putFails ? 403 : 200 };
    if (url === `${BASE}/reorder`) return reorderFails ? json({}, 500) : json([]);
    if (method === 'DELETE') return { ok: true, status: 204 };
    return json({}, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

const photo = (name = 'salon.jpg', type = 'image/jpeg', size = 1000) => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const pick = (files) => fireEvent.change(screen.getByLabelText('Elegir fotos', { selector: 'input' }), {
  target: { files },
});

beforeEach(() => localStorage.setItem('access_token', 'token'));
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('fileError', () => {
  it('accepts JPG, PNG and WebP up to 5 MB', () => {
    expect(fileError(photo('a.webp', 'image/webp', 5 * 1024 * 1024))).toBeNull();
  });

  it('rejects other types and files over 5 MB', () => {
    expect(fileError(photo('a.gif', 'image/gif'))).toMatch(/JPG, PNG o WebP/);
    expect(fileError(photo('big.jpg', 'image/jpeg', 6 * 1024 * 1024))).toMatch(/5 MB/);
  });
});

describe('PropertyImageManager', () => {
  it('shows the existing photos with the first one as cover', async () => {
    fakeApi({ images: [{ id: 1, url: '/media/a.jpg', position: 0 }, { id: 2, url: '/media/b.jpg', position: 1 }] });
    render(<PropertyImageManager propertyId={7} />);

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Portada')).toBeInTheDocument();
    expect(within(items[1]).queryByText('Portada')).not.toBeInTheDocument();
  });

  it('asks for a pre-signed URL and uploads the file straight to S3', async () => {
    const calls = fakeApi();
    render(<PropertyImageManager propertyId={7} />);

    pick([photo()]);

    expect(await screen.findByAltText('Foto 1')).toHaveAttribute('src', '/media/properties/7/100.jpg');
    const request = calls.find(({ url }) => url === `${BASE}/upload-url`);
    expect(JSON.parse(request.body)).toEqual({ filename: 'salon.jpg', content_type: 'image/jpeg', size: 1000 });
    const put = calls.find(({ url }) => url === 'https://s3.example.com/100');
    expect(put.method).toBe('PUT');
  });

  it('validates type and size before asking the API', async () => {
    const calls = fakeApi();
    render(<PropertyImageManager propertyId={7} />);

    pick([photo('plano.pdf', 'application/pdf'), photo('enorme.jpg', 'image/jpeg', 6 * 1024 * 1024)]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('plano.pdf');
    expect(alert).toHaveTextContent('enorme.jpg');
    expect(calls.some(({ url }) => url.endsWith('/upload-url'))).toBe(false);
  });

  it('removes the reserved photo when the upload to S3 fails', async () => {
    const calls = fakeApi({ putFails: true });
    render(<PropertyImageManager propertyId={7} />);

    pick([photo()]);

    expect(await screen.findByRole('alert')).toHaveTextContent('no se pudo subir');
    await waitFor(() => expect(calls).toContainEqual(expect.objectContaining({ url: `${BASE}/100`, method: 'DELETE' })));
    expect(screen.queryByAltText('Foto 1')).not.toBeInTheDocument();
  });

  it('makes a photo the cover and saves the new order', async () => {
    const calls = fakeApi({ images: [{ id: 1, url: '/media/a.jpg', position: 0 }, { id: 2, url: '/media/b.jpg', position: 1 }] });
    render(<PropertyImageManager propertyId={7} />);

    fireEvent.click(await screen.findByLabelText('Usar la foto 2 como portada'));

    await waitFor(() => expect(screen.getByAltText('Foto 1')).toHaveAttribute('src', '/media/b.jpg'));
    const reorder = calls.find(({ url }) => url === `${BASE}/reorder`);
    expect(JSON.parse(reorder.body)).toEqual({ image_ids: [2, 1] });
  });

  it('moves photos with the arrows and restores the order if saving fails', async () => {
    fakeApi({
      images: [{ id: 1, url: '/media/a.jpg', position: 0 }, { id: 2, url: '/media/b.jpg', position: 1 }],
      reorderFails: true,
    });
    render(<PropertyImageManager propertyId={7} />);

    fireEvent.click(await screen.findByLabelText('Mover la foto 1 a la derecha'));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el orden');
    expect(screen.getByAltText('Foto 1')).toHaveAttribute('src', '/media/a.jpg');
  });

  it('deletes a photo', async () => {
    const calls = fakeApi({ images: [{ id: 1, url: '/media/a.jpg', position: 0 }] });
    render(<PropertyImageManager propertyId={7} />);

    fireEvent.click(await screen.findByLabelText('Eliminar la foto 1'));

    await waitFor(() => expect(screen.queryByAltText('Foto 1')).not.toBeInTheDocument());
    expect(calls).toContainEqual(expect.objectContaining({ url: `${BASE}/1`, method: 'DELETE' }));
  });
});
