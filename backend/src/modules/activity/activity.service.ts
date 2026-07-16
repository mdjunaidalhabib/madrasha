import { activityRepository, ActivityRepository } from "./activity.repository";

export class ActivityService {
  constructor(private readonly repository: ActivityRepository = activityRepository) {}

  getRecentLogs(madrasaId: number) {
    return this.repository.findRecentByMadrasa(madrasaId);
  }
}

export const activityService = new ActivityService();
