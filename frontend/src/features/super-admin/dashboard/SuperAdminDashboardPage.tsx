import { useEffect, useState } from "react";
import adminApi from "../../../services/adminApi";

type ActivityItem = {
  id: number;
  madrasa_name: string | null;
  user_name: string | null;
  action: string | null;
  entity: string | null;
  entity_id: number | null;
  details: string | null;
  created_at: string;
};

type PlanItem = {
  madrasa_name: string;
  slug: string;
  plan_name: string;
  end_date: string;
  days_left?: number;
  days_overdue?: number;
};

type Stats = {
  totalMadrasas: number;
  activeMadrasas: number;
  inactiveMadrasas: number;
  trashedMadrasas: number;
  totalStudents: number;

  recentActivities: ActivityItem[];
  expiringPlans: PlanItem[];
  expiredPlans: PlanItem[];
};

function Badge({
  children,
  color,
}: {
  children: any;
  color: "green" | "yellow" | "red" | "blue" | "purple";
}) {
  const map: any = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${map[color]}`}>{children}</span>
  );
}

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminApi.get("/super/dashboard-stats");
      setStats(res.data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
        <p className="text-sm text-gray-600">Platform overview and statistics</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded shadow p-6 border-l-4 border-purple-500">
          <p className="text-sm text-gray-500">Total Madrasas</p>
          <h2 className="text-3xl font-bold text-purple-600">{stats?.totalMadrasas ?? 0}</h2>
        </div>

        <div className="bg-white rounded shadow p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Active</p>
          <h2 className="text-3xl font-bold text-green-600">{stats?.activeMadrasas ?? 0}</h2>
        </div>

        <div className="bg-white rounded shadow p-6 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500">Inactive</p>
          <h2 className="text-3xl font-bold text-yellow-700">{stats?.inactiveMadrasas ?? 0}</h2>
        </div>

        <div className="bg-white rounded shadow p-6 border-l-4 border-red-500">
          <p className="text-sm text-gray-500">Trashed</p>
          <h2 className="text-3xl font-bold text-red-600">{stats?.trashedMadrasas ?? 0}</h2>
        </div>

        <div className="bg-white rounded shadow p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Total Students</p>
          <h2 className="text-3xl font-bold text-blue-600">{stats?.totalStudents ?? 0}</h2>
        </div>
      </div>

      {/* Expiring Plans */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="font-semibold mb-3">Expiring Plans (Next 7 Days)</h3>

        {!stats?.expiringPlans?.length ? (
          <p className="text-sm text-gray-500">No expiring plans in next 7 days ✅</p>
        ) : (
          <div className="space-y-3">
            {stats.expiringPlans.map((x, i) => (
              <div key={i} className="flex items-center justify-between border rounded p-3">
                <div>
                  <div className="font-medium">{x.madrasa_name}</div>
                  <div className="text-xs text-gray-500">
                    {x.slug} • Plan: {x.plan_name} • Ends:{" "}
                    {new Date(x.end_date).toLocaleDateString()}
                  </div>
                </div>

                <Badge
                  color={
                    (x.days_left ?? 0) <= 1 ? "red" : (x.days_left ?? 0) <= 3 ? "yellow" : "green"
                  }
                >
                  {x.days_left} days left
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expired Plans */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="font-semibold mb-3 text-red-600">Already Expired Plans</h3>

        {!stats?.expiredPlans?.length ? (
          <p className="text-sm text-gray-500">No expired plans 🎉</p>
        ) : (
          <div className="space-y-3">
            {stats.expiredPlans.map((x, i) => (
              <div
                key={i}
                className="flex items-center justify-between border rounded p-3 bg-red-50"
              >
                <div>
                  <div className="font-medium">{x.madrasa_name}</div>
                  <div className="text-xs text-gray-600">
                    {x.slug} • Plan: {x.plan_name} • Expired:{" "}
                    {new Date(x.end_date).toLocaleDateString()}
                  </div>
                </div>

                <Badge color="red">{x.days_overdue} days overdue</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="font-semibold mb-4">Recent Activity</h3>

        {!stats?.recentActivities?.length ? (
          <p className="text-sm text-gray-500">No activity found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Madrasa</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Action</th>
                  <th className="text-left p-2">Entity</th>
                  <th className="text-left p-2">Details</th>
                </tr>
              </thead>

              <tbody>
                {stats.recentActivities.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2 text-gray-600">{new Date(a.created_at).toLocaleString()}</td>
                    <td className="p-2">{a.madrasa_name || "-"}</td>
                    <td className="p-2">{a.user_name || "-"}</td>
                    <td className="p-2">
                      <Badge color="blue">{a.action}</Badge>
                    </td>
                    <td className="p-2">
                      {a.entity}
                      {a.entity_id ? `#${a.entity_id}` : ""}
                    </td>
                    <td className="p-2 text-gray-700">{a.details || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
