export interface SuperAdminLoginResult {
  token: string;
  admin: { id: number; name: string; email: string };
}
