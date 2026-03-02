const BASE_URL = "http://localhost:8000/api";

// cookie helpers
export function setTokenCookie(token) {
  document.cookie = `token=${encodeURIComponent(token)};path=/`;
}
export function getTokenCookie() {
  const match = document.cookie.match(/(^|;)\s*token=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : null;
}
export function clearTokenCookie() {
  document.cookie = 'token=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

async function request(path, options = {}) {
  // automatically append token from cookie to request body if not provided
  let body = options.body ? JSON.parse(options.body) : {};
  const cookieToken = getTokenCookie();
  if (cookieToken && !body.token) {
    body.token = cookieToken;
  }

  // For GET requests, move body properties into query string
  if (options.method === "GET") {
    const params = new URLSearchParams(body).toString();
    if (params) {
      path += (path.includes("?") ? "&" : "?") + params;
    }
    options.body = undefined;
  } else {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const resBody = await res.json().catch(() => null);
  if (!res.ok) {
    throw resBody || { message: res.statusText };
  }
  return resBody;
}

export const createPerson = (payload) => request(`/person`, { method: "POST", body: JSON.stringify(payload) });
export const deletePerson = (payload) => request(`/person/delete`, { method: "POST", body: JSON.stringify(payload) });
export const getPersonByToken = (payload) => request(`/person/get`, { method: "GET", body: JSON.stringify(payload) });
export const getAllPersons = (payload) => request(`/person/getAll`, { method: "GET", body: JSON.stringify(payload) });
export const renamePerson = (payload) => request(`/person/rename`, { method: "POST", body: JSON.stringify(payload) });
export const updatePersonPassword = (payload) => request(`/person/updatepassword`, { method: "POST", body: JSON.stringify(payload) });
export const loginPerson = (payload) => request(`/person/login`, { method: "POST", body: JSON.stringify(payload) });
export const toggleDiscoverability = (payload) => request(`/person/togglediscoverability`, { method: "POST", body: JSON.stringify(payload) });

export const createRelationship = (payload) => request(`/relationship`, { method: "POST", body: JSON.stringify(payload) });
export const joinRelationship = (payload) => request(`/relationship/join`, { method: "POST", body: JSON.stringify(payload) });
export const endRelationship = (payload) => request(`/relationship/end`, { method: "POST", body: JSON.stringify(payload) });
export const editRelationship = (payload) => request(`/relationship/edit`, { method: "POST", body: JSON.stringify(payload) });
export const cleanRelationships = () => request(`/relationship/clean`, { method: "POST", body: JSON.stringify({}) });
export const getRelatedPersons = (payload) => request(`/relationship/related`, { method: "GET", body: JSON.stringify(payload) });
export const getPendingRelationships = (payload) => request(`/relationship/pending`, { method: "GET", body: JSON.stringify(payload) });
