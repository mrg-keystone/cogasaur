import { createDefine } from "fresh";
import type { KeepState } from "@mrg-keystone/keep";

// ctx.state carries keep's in-process client (ctx.state.api) thanks to embed().
export interface State extends KeepState {
  shared: string;
}

export const define = createDefine<State>();
