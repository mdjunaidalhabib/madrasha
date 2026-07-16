import axios from "axios";
import { useAdminAuthStore } from "../store/adminAuthStore";
import { useToastStore } from "../store/toastStore";

import { API_BASE_URL } from "./apiConfig";

const baseURL = API_BASE_URL;

const adminApi = axios.create({ baseURL });

adminApi.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      useAdminAuthStore.getState().logout();
    }

    const msg = err?.response?.data?.message || err?.message || "Something went wrong";

    useToastStore.getState().push("error", msg);

    return Promise.reject(err);
  },
);

export default adminApi;
