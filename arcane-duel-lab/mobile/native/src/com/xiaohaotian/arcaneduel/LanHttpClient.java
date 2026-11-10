package com.xiaohaotian.arcaneduel;

import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** LAN-only native HTTP. Never used for WebView navigation or public internet addresses. */
public final class LanHttpClient implements AutoCloseable {
    public static final int MAX_REQUEST=220000,MAX_RESPONSE=1000000;
    private static final int MAX_HEADERS=32768,MAX_HEADER_LINES=64;
    private final Object lock=new Object();
    private final Set<Socket> sockets=new HashSet<>();
    private final int connectTimeout,ioTimeout,maxConcurrent;
    private long generation;
    private boolean closed;
    private final ScheduledExecutorService deadlines=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"arcane-lan-deadline");t.setDaemon(true);return t;});
    public LanHttpClient(){this(4000,5000,4);}
    // Smaller limits are useful for deterministic JVM checks; production always uses the defaults.
    public LanHttpClient(int connectTimeout,int ioTimeout,int maxConcurrent){
        if(connectTimeout<1||connectTimeout>4000||ioTimeout<1||ioTimeout>5000||maxConcurrent<1||maxConcurrent>4)throw new IllegalArgumentException("Invalid LAN client limits");
        this.connectTimeout=connectTimeout;this.ioTimeout=ioTimeout;this.maxConcurrent=maxConcurrent;
    }
    public long generation(){synchronized(lock){return generation;}}
    public int activeCount(){synchronized(lock){return sockets.size();}}
    public JSONObject request(String target,String path,String method,String body,String token)throws Exception{return request(target,path,method,body,token,generation());}
    public JSONObject request(String target,String path,String method,String body,String token,long expectedGeneration)throws Exception {
        URI address=new URI(LanAddress.normalize(target));
        if(!validPath(path))throw new IllegalArgumentException("无效的联机接口");
        if(!"GET".equals(method)&&!"POST".equals(method))throw new IllegalArgumentException("不支持的请求方法");
        if(token!=null&&!token.isEmpty()&&!token.matches("[A-Za-z0-9._~-]{1,128}"))throw new IllegalArgumentException("无效的房间凭证");
        byte[] bytes="POST".equals(method)?(body==null?"{}":body).getBytes(StandardCharsets.UTF_8):new byte[0];
        if(bytes.length>MAX_REQUEST)throw new IllegalArgumentException("请求过大");
        String[] parts=address.getHost().split("\\.");byte[] numeric=new byte[4];for(int i=0;i<4;i++)numeric[i]=(byte)Integer.parseInt(parts[i]);
        // Construct from the already validated four octets. No DNS lookup or proxy environment.
        InetAddress ip=InetAddress.getByAddress(numeric);Socket socket=new Socket();
        synchronized(lock){if(closed||generation!=expectedGeneration)throw new IOException("连接已取消");if(sockets.size()>=maxConcurrent)throw new IOException("主机繁忙，请稍后再试");sockets.add(socket);}
        AtomicBoolean timeout=new AtomicBoolean();ScheduledFuture<?> deadline=null;
        try{
            deadline=deadlines.schedule(()->{timeout.set(true);closeSocket(socket);},connectTimeout+ioTimeout,TimeUnit.MILLISECONDS);
            socket.setTcpNoDelay(true);socket.connect(new InetSocketAddress(ip,address.getPort()),connectTimeout);socket.setSoTimeout(ioTimeout);
            deadline.cancel(false);deadline=deadlines.schedule(()->{timeout.set(true);closeSocket(socket);},ioTimeout,TimeUnit.MILLISECONDS);
            StringBuilder headers=new StringBuilder(method).append(' ').append(path).append(" HTTP/1.1\r\nHost: ").append(address.getHost()).append(':').append(address.getPort()).append("\r\nAccept: application/json\r\nAccept-Encoding: identity\r\nConnection: close\r\n");
            if(token!=null&&!token.isEmpty())headers.append("X-Duel-Token: ").append(token).append("\r\n");
            if(method.equals("POST"))headers.append("Content-Type: application/json\r\nContent-Length: ").append(bytes.length).append("\r\n");
            headers.append("\r\n");OutputStream out=socket.getOutputStream();out.write(headers.toString().getBytes(StandardCharsets.US_ASCII));if(bytes.length>0)out.write(bytes);out.flush();
            JSONObject response=parse(new BufferedInputStream(socket.getInputStream(),8192));
            synchronized(lock){if(closed||generation!=expectedGeneration)throw new IOException("连接已取消");}
            return response;
        }catch(Exception e){
            synchronized(lock){if(closed||generation!=expectedGeneration)throw new IOException("连接已取消",e);}
            if(timeout.get()||e instanceof SocketTimeoutException)throw new IOException("连接主机超时，请检查网络",e);
            throw e;
        }finally{if(deadline!=null)deadline.cancel(false);closeSocket(socket);synchronized(lock){sockets.remove(socket);}}
    }
    public static boolean validPath(String path){return path!=null&&(path.equals("/lan-info")||path.matches("/api/duel/(rooms|join)(/[A-Za-z0-9]{4,8}(/(action|sync))?)?"));}
    public void cancelAll(){synchronized(lock){generation++;for(Socket socket:sockets)closeSocket(socket);sockets.clear();}}
    @Override public void close(){synchronized(lock){closed=true;cancelAll();}deadlines.shutdownNow();}
    private static void closeSocket(Socket socket){try{socket.close();}catch(IOException ignored){}}

    private static JSONObject parse(InputStream input)throws Exception {
        int status=0;Map<String,String> headers=null;int[] budget={0};
        for(int interim=0;interim<5;interim++){
            String line=line(input,8192,budget);
            if(!line.matches("HTTP/1\\.[01] [1-5][0-9]{2}(?: [\\x20-\\x7E]*)?"))throw new IOException("无效的主机响应状态");
            status=Integer.parseInt(line.substring(9,12));headers=headers(input,budget);
            if(status>=200)break;if(status==101||interim==4)throw new IOException("不支持的主机协议切换");
        }
        if(status>=300&&status<400)throw new IOException("主机返回了意外的跳转");
        String transfer=headers.get("transfer-encoding"),length=headers.get("content-length"),encoding=headers.get("content-encoding");
        if(encoding!=null&&!encoding.equalsIgnoreCase("identity"))throw new IOException("不支持压缩的主机响应");
        if(transfer!=null&&length!=null)throw new IOException("主机响应长度冲突");
        ByteArrayOutputStream data=new ByteArrayOutputStream();
        if(status==204||status==205){if((length!=null&&!length.equals("0"))||transfer!=null)throw new IOException("无效的空响应长度");}
        else if(transfer!=null){
            if(!transfer.equalsIgnoreCase("chunked"))throw new IOException("不支持的主机传输编码");
            int chunks=0;
            while(true){
                if(++chunks>4096)throw new IOException("主机响应分块过多");
                String raw=line(input,128,null),size=raw.split(";",2)[0].trim();if(!size.matches("[0-9a-fA-F]{1,8}"))throw new IOException("无效的主机分块长度");
                long count=Long.parseLong(size,16);if(count>MAX_RESPONSE-data.size())throw new IOException("主机响应过大");
                if(count==0){Map<String,String> trailers=headers(input,budget);if(trailers.containsKey("content-length")||trailers.containsKey("transfer-encoding")||trailers.containsKey("host"))throw new IOException("无效的主机尾部信息");break;}
                readExact(input,data,(int)count);if(input.read()!=13||input.read()!=10)throw new IOException("主机分块不完整");
            }
        }else if(length!=null){
            if(!length.matches("[0-9]{1,10}"))throw new IOException("无效的主机响应长度");long count=Long.parseLong(length);if(count>MAX_RESPONSE)throw new IOException("主机响应过大");readExact(input,data,(int)count);
        }else{
            byte[] buffer=new byte[8192];int count;while((count=input.read(buffer))!=-1){if(data.size()+count>MAX_RESPONSE)throw new IOException("主机响应过大");data.write(buffer,0,count);}
        }
        String json=data.toString(StandardCharsets.UTF_8.name());return LanRoomService.obj("status",status,"data",json.isEmpty()?new JSONObject():new JSONObject(json));
    }
    private static Map<String,String> headers(InputStream input,int[] budget)throws IOException {
        Map<String,String> values=new HashMap<>();
        for(int count=0;count<=MAX_HEADER_LINES;count++){
            String line=line(input,8192,budget);if(line.isEmpty())return values;
            if(count==MAX_HEADER_LINES)throw new IOException("主机响应头过多");
            int colon=line.indexOf(':');if(colon<=0||!line.substring(0,colon).matches("[!#$%&'*+.^_`|~0-9A-Za-z-]+"))throw new IOException("无效的主机响应头");
            String name=line.substring(0,colon).toLowerCase(Locale.ROOT),value=line.substring(colon+1).trim();
            if(value.matches(".*[\\x00-\\x08\\x0a-\\x1f\\x7f].*"))throw new IOException("无效的主机响应头");
            if(values.containsKey(name)){if(name.equals("content-length")||name.equals("transfer-encoding")||name.equals("content-encoding"))throw new IOException("重复的主机响应长度或编码");value=values.get(name)+","+value;}
            values.put(name,value);
        }
        throw new IOException("主机响应头过多");
    }
    private static String line(InputStream input,int max,int[] budget)throws IOException {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        while(true){int value=input.read();if(value<0)throw new EOFException("主机响应不完整");if(budget!=null&&++budget[0]>MAX_HEADERS)throw new IOException("主机响应头过大");
            if(value==13){if(input.read()!=10)throw new IOException("无效的主机换行");if(budget!=null&&++budget[0]>MAX_HEADERS)throw new IOException("主机响应头过大");return bytes.toString(StandardCharsets.ISO_8859_1.name());}
            if(value==10||bytes.size()>=max)throw new IOException("无效或过长的主机响应行");bytes.write(value);
        }
    }
    private static void readExact(InputStream input,OutputStream output,int length)throws IOException{byte[] buffer=new byte[8192];while(length>0){int count=input.read(buffer,0,Math.min(buffer.length,length));if(count<0)throw new EOFException("主机响应不完整");output.write(buffer,0,count);length-=count;}}
}
