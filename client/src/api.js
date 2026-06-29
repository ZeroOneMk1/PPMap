const BASE_URL = "/api";

async function request(path, options = {}) {
  const init = {
    credentials: "include",
    ...options,
  };
  if (init.body) {
    init.headers = { "Content-Type": "application/json", ...(init.headers || {}) };
  }
  const res = await fetch(`${BASE_URL}${path}`, init);
  const resBody = await res.json().catch(() => null);
  if (!res.ok) {
    throw resBody || { message: res.statusText };
  }
  return resBody;
}

function withQuery(path, params) {
  const entries = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return path;
  const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  return `${path}?${qs}`;
}

export const createPerson = (payload) => request(`/person`, { method: "POST", body: JSON.stringify(payload) });
export const deletePerson = () => request(`/person/delete`, { method: "POST" });
export const getPersonByToken = () => request(`/person/get`, { method: "GET" });
export const getAllPersons = () => request(`/person/getAll`, { method: "GET" });
export const updatePersonPassword = (payload) => request(`/person/updatepassword`, { method: "POST", body: JSON.stringify(payload) });
export const loginPerson = (payload) => request(`/person/login`, { method: "POST", body: JSON.stringify(payload) });
export const logout = () => request(`/person/logout`, { method: "POST" });
export const toggleDiscoverability = (payload) => request(`/person/togglediscoverability`, { method: "POST", body: JSON.stringify(payload) });

export const createRelationship = (payload) => request(`/relationship`, { method: "POST", body: JSON.stringify(payload) });
export const joinRelationship = (payload) => request(`/relationship/join`, { method: "POST", body: JSON.stringify(payload) });
export const endRelationship = (payload) => request(`/relationship/end`, { method: "POST", body: JSON.stringify(payload) });
export const editRelationship = (payload) => request(`/relationship/edit`, { method: "POST", body: JSON.stringify(payload) });
export const getDirectRelationships = () => request(`/relationship/direct`, { method: "GET" });
export const getRelationshipGraph = (payload) => request(withQuery(`/relationship/graph`, payload), { method: "GET" });
