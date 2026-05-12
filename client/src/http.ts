import axios from "axios";

const http = axios.create({ baseURL: "http://localhost:3001/api" });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("orbit_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const refresh = localStorage.getItem("orbit_refresh");
    if (err.response?.status === 401 && refresh) {
      try {
        const { data } = await axios.post("http://localhost:3001/api/auth/refresh", {
          refreshToken: refresh,
        });
        localStorage.setItem("orbit_token", data.accessToken);
        err.config.headers.Authorization = `Bearer ${data.accessToken}`;
        return http.request(err.config);
      } catch {
        // refresh failed — fall through to logout
      }
    }
    if (err.response?.status === 401) {
      localStorage.removeItem("orbit_token");
      localStorage.removeItem("orbit_refresh");
      localStorage.removeItem("orbit_user");
      window.dispatchEvent(new Event("orbit_logout"));
    }
    return Promise.reject(err);
  },
);

export default http;
