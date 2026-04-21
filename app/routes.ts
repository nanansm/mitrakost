import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("guard", "routes/guard.tsx"),
  route("tenant", "routes/tenant.tsx"),
  route("api/health", "routes/api.health.tsx"),
] satisfies RouteConfig;
