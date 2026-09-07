import { cachedGet } from "./api";

export type PlanStatus = "trial" | "active" | "expired" | "suspended";

export type MyPlan = {
  plan_name: string | null;
  price: number | null;
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  days_remaining: number | null;
  plan_status: PlanStatus;
  has_active_subscription: boolean;
  student_limit: number;
  user_limit: number;
  usage: {
    students: number;
    users: number;
  };
};

export async function getMyPlan(): Promise<MyPlan> {
  const res = await cachedGet<{ data: MyPlan }>("/settings/plan");
  return res.data.data;
}
