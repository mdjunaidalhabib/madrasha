export interface CreateRoleRequestDto {
  name_bn: string;
  key_name?: string; // auto-derived from name_bn when omitted
  permission_keys?: string[];
}

export interface UpdateRoleRequestDto {
  name_bn?: string;
  permission_keys?: string[]; // when provided, fully replaces the role's permission set
}
