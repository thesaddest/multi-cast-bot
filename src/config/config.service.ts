import { Injectable } from "@nestjs/common";
import { ConfigService as AppConfigService } from "@nestjs/config";

@Injectable()
export class ConfigService {
  constructor(private readonly configService: AppConfigService) {}

  get<T>(path: string): T {
    return this.configService.get<T>(path);
  }
}
