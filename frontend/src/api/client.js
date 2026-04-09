import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api",
  timeout: 8000
});

apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("travel_auth_token") || localStorage.getItem("travel_auth_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default apiClient;
