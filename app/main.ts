import { App, staticFiles } from "fresh";
import { embed } from "@mrg-keystone/keep";
import { type State } from "./utils.ts";
import { api } from "./backend.ts";

export const app = new App<State>();

app.use(staticFiles());

// Mount the keep backend at /api AND put the in-process client on ctx.state.api.
// MUST come before fsRoutes() or the file-system routes shadow /api.
app.use(embed(api, { at: "/api" }));

app.fsRoutes();
