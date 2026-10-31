import adminApi from "./adminApi";

export async function uploadWebsiteDemoImage(image: string): Promise<string> {
  const res = await adminApi.post("/website/super/default-template/image", {
    image,
  });
  return res.data.data.url;
}
import type {
  WebsiteTemplate,
  TemplateResponse,
} from "../features/super-admin/website-control/websiteTemplate.types";

export async function getDefaultWebsiteTemplate(): Promise<TemplateResponse> {
  const res = await adminApi.get("/website/super/default-template");
  return res.data.data;
}

export async function saveDefaultWebsiteTemplate(
  content: WebsiteTemplate,
): Promise<TemplateResponse> {
  const res = await adminApi.put("/website/super/default-template", content);
  return res.data.data;
}

export async function updateMadrasaWebsiteStatus(
  id: number,
  status: "active" | "limited" | "disabled",
) {
  const res = await adminApi.patch(`/website/super/madrasas/${id}/status`, {
    status,
  });
  return res.data;
}
