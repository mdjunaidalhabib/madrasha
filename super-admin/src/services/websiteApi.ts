import adminApi from "./adminApi";

export async function resetMadrasaWebsite(id: number) {
  const res = await adminApi.post(`/website/super/madrasas/${id}/reset`);
  return res.data;
}

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
  const result = res.data.data;
  return { ...result, content: { ...result.content, teachers: result.content.teachers ?? [] } };
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
