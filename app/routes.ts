import { type RouteConfig, index, route, layout, prefix } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("daftar/sukses", "routes/daftar.sukses.tsx"),
  route("daftar", "routes/daftar.tsx"),
  route("uploads/*", "routes/uploads.$.tsx"),
  layout("routes/dashboard.tsx", [
    route("dashboard", "routes/dashboard._index.tsx"),
    route("dashboard/pending", "routes/dashboard.pending.tsx"),
    route("dashboard/tenants", "routes/dashboard.tenants.tsx"),
    route("dashboard/rooms", "routes/dashboard.rooms.tsx"),
    route("dashboard/payments", "routes/dashboard.payments.tsx"),
    route("dashboard/laundry", "routes/dashboard.laundry.tsx"),
    route("dashboard/complaints", "routes/dashboard.complaints.tsx"),
    route("dashboard/expenses", "routes/dashboard.expenses.tsx"),
    route("dashboard/kpi", "routes/dashboard.kpi.tsx"),
    route("dashboard/guards", "routes/dashboard.guards.tsx"),
    route("dashboard/report", "routes/dashboard.report.tsx"),
    route("dashboard/settings", "routes/dashboard.settings.tsx"),
  ]),
  layout("routes/tenant.tsx", [
    route("tenant", "routes/tenant._index.tsx"),
    route("tenant/complaints", "routes/tenant.complaints.tsx"),
    route("tenant/info", "routes/tenant.info.tsx"),
    route("tenant/rooms", "routes/tenant.rooms.tsx"),
  ]),
  route("guard", "routes/guard.tsx"),
  route("api/health", "routes/api.health.tsx"),
] satisfies RouteConfig;
