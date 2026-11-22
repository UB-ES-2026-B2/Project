import { test, expect } from '@playwright/test';

// Cada ejecución genera un correo diferente para evitar conflictos
// con cuentas creadas en ejecuciones anteriores.
const createTestUser = () => ({
  email: `e2e-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`,
  password: 'Password123!',
});

// Registra un usuario mediante la API para preparar los tests
// que necesitan una cuenta existente.
async function registerUser(request, user) {
  const response = await request.post('/api/auth/register', {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  expect(
    response.ok(),
    `No se pudo registrar el usuario de prueba: ${await response.text()}`
  ).toBeTruthy();
}

// Inicia sesión a través de la interfaz.
async function loginThroughUI(page, user) {
    await page.goto('/login');
    await page.locator('#login-email').fill(user.email);
    await page.locator('#login-password').fill(user.password);
  
    const loginResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/auth/login')
    );
  
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
  
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.ok()).toBeTruthy();
}

// TEST 1: Registro de usuario
test('un usuario puede registrarse', async ({ page }) => {
  const user = createTestUser();

  await page.goto('/register');

  await page.locator('#register-email').fill(user.email);
  await page.locator('#register-password').fill(user.password);
  await page.locator('#register-terms').check();

  const registerResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/auth/register')
  );

  await page.getByRole('button', { name: /crear cuenta/i }).click();

  const registerResponse = await registerResponsePromise;

  expect(registerResponse.ok()).toBeTruthy();
});

// TEST 2: Inicio de sesión
test('un usuario registrado puede iniciar sesión', async ({
  page,
  request,
}) => {
  const user = createTestUser();

  // Preparamos una cuenta nueva.
  await registerUser(request, user);

  // Comprobamos el inicio de sesión desde la interfaz.
  await loginThroughUI(page, user);

  // El formulario de login ya no debería mostrar errores.
  await expect(page.getByRole('alert')).toHaveCount(0);
});

// TEST 3: Publicación de inmueble
test('un usuario autenticado puede publicar un inmueble', async ({
  page,
  request,
}) => {
  const user = createTestUser();

  await registerUser(request, user);
  await loginThroughUI(page, user);

  await page.goto('/publicar');

  // Seleccionamos el tipo de operación y de inmueble.
  await page.locator('#property-operation').selectOption('venta');
  await page.locator('#property-space-type').selectOption('piso');

  // Completamos los datos del inmueble.
  await page.locator('#property-price').fill('250000');
  await page.locator('#property-surface').fill('85');
  await page.locator('#property-address').fill('Carrer de prova 10');
  await page
    .locator('#property-description')
    .fill('Piso luminoso de dos habitaciones con terraza.');

  const publishResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/properties') &&
    response.request().method() === 'POST'
  );

  await page.getByRole('button', { name: /publicar anuncio/i }).click();

  const publishResponse = await publishResponsePromise;

  expect(publishResponse.ok()).toBeTruthy();

  await expect(
    page.getByRole('status')
  ).toContainText('Tu anuncio se ha publicado correctamente.');
});

// TEST 4: Visualización del catálogo de inmuebles
test('un visitante puede ver el catálogo de inmuebles', async ({ page }) => {
  const propertiesResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/v1/properties') &&
    response.request().method() === 'GET'
  );

  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /anuncios destacados/i })
  ).toBeVisible();

  const propertiesResponse = await propertiesResponsePromise;

  expect(propertiesResponse.ok()).toBeTruthy();

  const properties = await propertiesResponse.json();

  expect(properties.items).toBeDefined();
  expect(Array.isArray(properties.items)).toBeTruthy();

  // El catálogo debe mostrar anuncios o el mensaje de catálogo vacío.
  if (properties.items.length === 0) {
    await expect(
      page.getByText(/aún no hay anuncios disponibles/i)
    ).toBeVisible();
  } else {
    // Si hay anuncios, comprobamos que se haya cargado al menos uno.
    await expect(page.locator('#destacados')).toBeVisible();
  }
});