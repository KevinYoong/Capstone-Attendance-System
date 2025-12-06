import axios from "axios";

const API_BASE_URL = "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Types
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
    role: "student" | "lecturer" | "admin";
  };
  token?: string; // optional — present only for admin
}

export const loginUser = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>("/login", credentials);
  return response.data;
};

export default api;