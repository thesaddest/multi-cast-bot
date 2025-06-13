import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { Logger, ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: [process.env.LOG_LEVEL as any],
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const environment = config.get<string>("app.node_env");
  const port = config.get<number>("app.port");

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe());

  Logger.debug(environment);

  await app.listen(port, () =>
    Logger.debug(
      `Server started on port: ${port} with environment: ${environment}`,
    ),
  );
}
bootstrap();
