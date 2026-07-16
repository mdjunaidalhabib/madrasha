export interface ActivityLogRow {
  id: number;
  madrasa_id: number;
  user_id: number;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string | null;
  created_at: Date;
  name: string;
}
