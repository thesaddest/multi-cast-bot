import { Module } from "@nestjs/common";
import { ConfigModule as AppConfigModule } from "@nestjs/config";
import { ConfigService } from "./config.service";
import { Configuration, ConfigurationValidationSchema } from "./configuration";

@Module({
  imports: [
    AppConfigModule.forRoot({
      isGlobal: true,
      load: [Configuration],
      validationSchema: ConfigurationValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
