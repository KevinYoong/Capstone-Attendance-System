import axios from "axios";

const API_BASE_URL = "http://localhost:3001";

const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // do NOT set Authorization here permanently; use interceptor to pick up the latest token
});

// Add request interceptor to attach admin_token from localStorage
adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      config.headers = config.headers ?? {};
      // set only if URL starts with /admin or config.url contains '/admin'
      // but since adminApi is only used for admin endpoints, we can set unconditionally here
      (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default adminApi;