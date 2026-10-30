import {env} from 'cloudflare:workers';
import {handleDuelRequest} from '../../../../../server/rooms.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handleDuelRequest(request,env.DB);}
export async function POST(request:Request){return handleDuelRequest(request,env.DB);}
