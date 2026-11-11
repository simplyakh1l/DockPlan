let csrfToken = null;
export const setCsrfToken = (token) => {
  csrfToken = token;
};
export async function api(path, options = {}) {
  const headers =
    options.body instanceof FormData
      ? {}
      : { 'Content-Type': 'application/json' };
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...headers,
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      'Cannot reach DockPlan. Check your connection and try again.',
    );
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'The server did not respond. Check that the API is running.',
    }));
    throw new Error([error.message, ...(error.details ?? [])].join(' '));
  }
  if (response.status === 204) return null;
  return response.json();
}
export const post = (path, body, method = 'POST') =>
  api(path, { method, body: JSON.stringify(body) });
export async function exportCsv(plan) {
  const response = await fetch('/api/export/csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });
  if (!response.ok) {
    const e = await response.json();
    throw new Error(e.message);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `${plan.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-placements.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
