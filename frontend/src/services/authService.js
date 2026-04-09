import apiClient from "../api/client";

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    name: user.name || user.full_name || ""
  };
}

export async function login(credentials) {
  try {
    const response = await apiClient.post("/auth/login", credentials);
    return {
      ...response.data,
      user: normalizeUser(response.data.user)
    };
  } catch (error) {
    throw new Error(error.response?.data?.message || "Login failed");
  }
}

export async function register(payload) {
  try {
    const response = await apiClient.post("/auth/register", payload);
    return {
      ...response.data,
      user: normalizeUser(response.data.user)
    };
  } catch (error) {
    throw new Error(error.response?.data?.message || "Registration failed");
  }
}

export async function getProfile() {
  try {
    const response = await apiClient.get("/auth/profile");
    return normalizeUser(response.data);
  } catch (error) {
    throw new Error(error.response?.data?.message || "Unable to fetch profile");
  }
}
