export const IN_PROD = import.meta.env.MODE === "production";
export const API_BASE_URL = IN_PROD ? "" : "http://localhost:6969";
