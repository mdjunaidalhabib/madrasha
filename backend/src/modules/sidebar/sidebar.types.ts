export interface SidebarChildItem {
  id: number;
  key: string | null;
  label: string | null;
  sort_order: number | null;
  disabled: boolean;
}

export interface SidebarModuleItem {
  id: number;
  key: string | null;
  label: string | null;
  group: string | null;
  sort_order: number | null;
  disabled: boolean;
  children: SidebarChildItem[];
}
