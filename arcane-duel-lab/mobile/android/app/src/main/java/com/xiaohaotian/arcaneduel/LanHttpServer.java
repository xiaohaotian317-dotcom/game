package com.xiaohaotian.arcaneduel;

import fi.iki.elonen.NanoHTTPD;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Small bounded LAN-only HTTP transport. Started only by an explicit host() call. */
public final class LanHttpServer extends NanoHTTPD {
    public static final int MAX_BODY = 220000;
    private final LanRoomService service = new LanRoomService();
    public LanHttpServer(int port) {
        super("0.0.0.0", port);
        setAsyncRunner(new BoundedRunner());
    }
    @Override public Response serve(IHTTPSession session) {
        try {
            if (!LanAddress.privateIPv4(session.getRemoteIpAddress())) return error(403,"只接受局域网连接");
            String origin=session.getHeaders().get("origin"),host=session.getHeaders().get("host");
            String method=session.getMethod().name(),path=session.getUri();
            if(!method.equals("GET")&&!method.equals("POST"))return error(405,"不支持的请求方法");
            JSONObject body=new JSONObject();
            if(method.equals("POST")) {
                if(session.getHeaders().containsKey("transfer-encoding"))return error(411,"需要明确的请求长度");
                String lengthText=session.getHeaders().get("content-length");
                if(lengthText==null||!lengthText.matches("[0-9]{1,8}"))return error(411,"需要明确的请求长度");
                int length=Integer.parseInt(lengthText);
                if(length>MAX_BODY){
                    // Drain modest excess before closing. Closing with unread bytes can turn a valid
                    // HTTP 413 response into TCP ECONNRESET on Windows. Still bound malicious bodies.
                    if(length<=MAX_BODY+65536)drain(session.getInputStream(),length);
                    return error(413,"请求过大");
                }
                ByteArrayOutputStream bytes=new ByteArrayOutputStream(Math.min(length,8192));
                InputStream input=session.getInputStream();byte[] buffer=new byte[8192];int remaining=length;
                while(remaining>0){int n=input.read(buffer,0,Math.min(remaining,buffer.length));if(n<0)return error(400,"请求不完整");bytes.write(buffer,0,n);remaining-=n;}
                if(origin!=null&&!origin.equals("http://"+host))return error(403,"不接受跨站请求");
                if(!session.getHeaders().getOrDefault("content-type","").contains("application/json"))return error(415,"需要 JSON 请求");
                try {body=new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));}catch(Exception e){return error(400,"无效的请求内容");}
            }
            if(origin!=null&&!origin.equals("http://"+host))return error(403,"不接受跨站请求");
            LanRoomService.Result result=service.handle(method,path,session.getHeaders().get("x-duel-token"),body);
            return response(result.status,result.data.toString());
        }catch(Exception e){return error(400,"请求处理失败，请重新连接主机");}
    }
    @Override public void stop(){super.stop();service.clear();}
    private static void drain(InputStream input,int length)throws java.io.IOException{byte[] buffer=new byte[8192];while(length>0){int n=input.read(buffer,0,Math.min(buffer.length,length));if(n<0)return;length-=n;}}
    private static Response error(int status,String message){return response(status,LanRoomService.obj("error",message).toString());}
    private static Response response(int status,String data){
        Response.IStatus code=new Response.IStatus(){public int getRequestStatus(){return status;}public String getDescription(){return status+" "+(status<400?"OK":"Error");}};
        Response r=newFixedLengthResponse(code,"application/json; charset=utf-8",data);
        // Early validation can reject a request before consuming its body. Never reuse that socket.
        if(status>=400)r.closeConnection(true);
        r.addHeader("Cache-Control","private, no-store");r.addHeader("X-Content-Type-Options","nosniff");return r;
    }
    private static final class BoundedRunner implements AsyncRunner {
        private final Set<ClientHandler> clients=ConcurrentHashMap.newKeySet();
        private final ThreadPoolExecutor pool=new ThreadPoolExecutor(2,8,30,TimeUnit.SECONDS,new ArrayBlockingQueue<>(16),r->{Thread t=new Thread(r,"arcane-lan-client");t.setDaemon(true);return t;});
        public void exec(ClientHandler client){clients.add(client);try{pool.execute(client);}catch(java.util.concurrent.RejectedExecutionException e){clients.remove(client);client.close();}}
        public void closed(ClientHandler client){clients.remove(client);}
        public void closeAll(){for(ClientHandler c:clients)c.close();clients.clear();pool.shutdownNow();}
    }
}
