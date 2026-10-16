async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.fields = body.fields || {};
    throw err;
  }
  return body;
}

export const api = {
  meta: () => request('/meta'),
  students: () => request('/students'),
  student: (id) => request(`/students/${encodeURIComponent(id)}`),
  outreach: (advisor) => request(`/outreach${advisor ? `?advisor=${encodeURIComponent(advisor)}` : ''}`),
  dataIssues: () => request('/data-issues'),
  addNote: (id, note) =>
    request(`/students/${encodeURIComponent(id)}/notes`, { method: 'POST', body: JSON.stringify(note) }),
};
