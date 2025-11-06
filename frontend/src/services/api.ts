import axios from 'axios';

// Base URL for your backend API
const API_BASE_URL = 'http://localhost:3001';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types for API requests and responses
export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: {
    id: string | number;
    name: string;
    email: string;
    role: 'student' | 'lecturer';
  };
}

// Login API call
export const loginUser = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/login', credentials);
  return response.data;
};

export default api;