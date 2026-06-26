// backend.ts — the keep app (the privileged "main process" brain).
// Bootstrapped, NOT listened. Fill this with your own @Endpoint controllers.
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

export const api = await bootstrapServer(
  "desktop",
  endpointModule("App", [AppController]),
);
