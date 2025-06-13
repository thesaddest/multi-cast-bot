import { Logger, Module } from "@nestjs/common";
import { DbService } from "./db.service";

@Module({
  providers: [DbService, Logger],
  exports: [DbService],
})
export class DbModule {}
