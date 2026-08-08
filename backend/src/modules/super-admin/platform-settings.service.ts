import { BadRequestError } from "../../shared/errors";
import { encryptSecret, decryptSecret } from "../../shared/utils/crypto.util";
import { platformSettingsRepository, PlatformSettingsRepository } from "./platform-settings.repository";
import type { CloudinaryCredentials } from "../../shared/storage/cloudinary.service";

export interface SaveCloudinaryConfigRequestDto {
  cloud_name?: string;
  api_key?: string;
  api_secret?: string;
}

export class PlatformSettingsService {
  constructor(private readonly repository: PlatformSettingsRepository = platformSettingsRepository) {}

  async getCloudinaryConfig() {
    const config = await this.repository.findCloudinaryConfig();
    if (!config) return { configured: false, cloud_name: null, api_key: null };
    return { configured: true, cloud_name: config.cloudName, api_key: config.apiKey };
  }

  async saveCloudinaryConfig(dto: SaveCloudinaryConfigRequestDto) {
    if (!dto.cloud_name?.trim() || !dto.api_key?.trim() || !dto.api_secret?.trim()) {
      throw new BadRequestError("cloud_name, api_key and api_secret are all required");
    }

    await this.repository.upsertCloudinaryConfig({
      cloudName: dto.cloud_name.trim(),
      apiKey: dto.api_key.trim(),
      apiSecretEnc: encryptSecret(dto.api_secret.trim()),
    });
  }

  async deleteCloudinaryConfig() {
    await this.repository.deleteCloudinaryConfig();
  }

  /** Resolves the platform's own Cloudinary credentials for Super Admin
   * uploads (System Template backgrounds). Used by
   * super-admin/platform-cloudinary.util.ts - kept here since it needs the
   * same encrypted-at-rest row this service already owns. */
  async resolveCredentials(): Promise<CloudinaryCredentials | null> {
    const config = await this.repository.findCloudinaryConfig();
    if (!config) return null;
    return {
      cloudName: config.cloudName,
      apiKey: config.apiKey,
      apiSecret: decryptSecret(config.apiSecretEnc),
    };
  }
}

export const platformSettingsService = new PlatformSettingsService();
