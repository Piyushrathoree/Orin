export const getOrinBackendUrl = () =>
  process.env.ORIN_BACKEND_URL?.replace(/\/$/, "") || "http://localhost:3030";

