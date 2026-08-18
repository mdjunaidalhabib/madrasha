import { useCallback, useEffect, useState } from "react";
import { notificationApi, type NotificationLogItem, type NotificationStatus } from "../../services/phase4Api";
import { logger } from "../../utils/logger";
import NotificationHistoryList from "./NotificationHistoryList";

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const NotificationHistoryPage = () => {
  const [logs, setLogs] = useState<NotificationLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notificationApi.list({ status: (statusFilter as NotificationStatus) || undefined });
      setLogs(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD NOTIFICATIONS ERROR:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">পাঠানোর ইতিহাস</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">SMS/ইমেইল পাঠানোর সম্পূর্ণ ইতিহাস</p>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">সব রেকর্ড</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">সব স্ট্যাটাস</option>
              <option value="SENT">পাঠানো হয়েছে</option>
              <option value="FAILED">ব্যর্থ</option>
            </select>
          </div>

          <NotificationHistoryList logs={logs} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default NotificationHistoryPage;
