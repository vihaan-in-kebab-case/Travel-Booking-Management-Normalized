import apiClient from "../api/client";

function toMessage(error, fallback) {
  return error.response?.data?.message || fallback;
}

export async function searchTravels(filters = {}) {
  try {
    const response = await apiClient.get("/travels", { params: filters });
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, "Unable to fetch travels"));
  }
}

export async function getTravelSearchOptions() {
  try {
    const response = await apiClient.get("/travels/search-options");
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, "Unable to fetch travel search options"));
  }
}

export async function getTravelById(id) {
  try {
    const response = await apiClient.get(`/travels/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, "Unable to fetch travel details"));
  }
}

export async function createBooking(payload) {
  try {
    const response = await apiClient.post("/bookings", payload);
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, "Unable to create booking"));
  }
}

export async function getBookingsByUser(userId) {
  try {
    const response = await apiClient.get(`/bookings/user/${userId}`);
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, "Unable to fetch bookings"));
  }
}

export async function getCancellationsByUser(userId) {
  try {
    const response = await apiClient.get(`/bookings/user/${userId}/cancellations`);
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, "Unable to fetch cancellations"));
  }
}

export async function cancelBooking(bookingId) {
  try {
    const response = await apiClient.patch(`/bookings/${bookingId}/cancel`);
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, "Unable to cancel booking"));
  }
}

export async function getAdminOverview() {
  try {
    const response = await apiClient.get("/admin/overview");
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, "Unable to fetch admin overview"));
  }
}

export async function getAdminResource(resourceKey) {
  try {
    const response = await apiClient.get(`/admin/${resourceKey}`);
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, `Unable to fetch ${resourceKey}`));
  }
}

export async function getVehicleFormOptions() {
  try {
    const response = await apiClient.get("/admin/form-options/vehicles");
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, "Unable to fetch vehicle form options"));
  }
}

export async function getRouteFormOptions() {
  try {
    const response = await apiClient.get("/admin/form-options/routes");
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, "Unable to fetch route form options"));
  }
}

export async function upsertAdminResource(resourceKey, record) {
  try {
    const response = await apiClient.post(`/admin/${resourceKey}`, record);
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, `Unable to save ${resourceKey}`));
  }
}

export async function deleteAdminResource(resourceKey, recordId) {
  try {
    const response = await apiClient.delete(`/admin/${resourceKey}/${recordId}`);
    return response.data;
  } catch (error) {
    throw new Error(toMessage(error, `Unable to delete ${resourceKey}`));
  }
}
