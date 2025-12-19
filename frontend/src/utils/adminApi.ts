import axios from "axios";

// ==========================================
// Configuration
// ==========================================

const API_BASE_URL = "http://localhost:3001";

const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ==========================================
// Interceptors
// ==========================================

/**
 * Request Interceptor:
 * Automatically attaches the 'admin_token' from localStorage to every request
 * made via this instance.
 */
adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("admin_token");
    
    if (token) {
      // Ensure headers object exists
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default adminApi;