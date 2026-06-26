// backend.ts — the keep app (the "main process" brain). Bootstrapped, NOT listened.
// This is what the scaffolder will let app authors fill with their own endpoints.
import {
  bootstrapServer,
  Endpoint,
  EndpointController,
  endpointModule,
} from "@mrg-keystone/keep";
import { ApiProperty } from "@danet/swagger/decorators";

class InfoDto {
  @ApiProperty()
  runtime!: string;
  @ApiProperty()
  pid!: number;
  @ApiProperty()
  cwd!: string;
  @ApiProperty()
  mem!: string;
}

@EndpointController("app", { description: "desktop app backend" })
class AppController {
  @Endpoint({ method: "get", path: "info", output: InfoDto, order: 1 })
  info(): InfoDto {
    return {
      runtime: `Deno ${Deno.version.deno}`,
      pid: Deno.pid,
      cwd: Deno.cwd(),
      mem: Math.round(Deno.systemMemoryInfo().total / 1e9) + " GB",
    };
  }
}

// bootstrapServer initializes only (no listen). backend.fetch works immediately,
// in-process, with no port and no token — this is "the bridge".
export const api = await bootstrapServer(
  "desktop",
  endpointModule("App", [AppController]),
);
