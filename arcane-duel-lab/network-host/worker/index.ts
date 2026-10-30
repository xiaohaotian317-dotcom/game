import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import startPage from '../../dist/index.html?raw';
import lobbyPage from '../../dist/lobby.html?raw';
import duelPage from '../../dist/duel.html?raw';
import skillsPage from '../../dist/skills.html?raw';
import charactersPage from '../../dist/characters.html?raw';
const nativePages:Record<string,string>={'/':startPage,'/index':startPage,'/lobby':lobbyPage,'/duel':duelPage,'/skills':skillsPage,'/characters':charactersPage};

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const pathname=new URL(request.url).pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/';
    if(nativePages[pathname]&&request.method==='GET')return new Response(nativePages[pathname],{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
