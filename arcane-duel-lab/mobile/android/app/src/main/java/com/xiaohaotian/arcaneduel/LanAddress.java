package com.xiaohaotian.arcaneduel;

import java.net.URI;
import java.net.Inet4Address;
import java.net.NetworkInterface;
import java.util.Collections;
import org.json.JSONArray;

public final class LanAddress {
    private LanAddress(){}
    public static boolean privateIPv4(String address){
        if(address==null||!address.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}"))return false;
        String[] parts=address.split("\\.");int[] p=new int[4];for(int i=0;i<4;i++){p[i]=Integer.parseInt(parts[i]);if(p[i]>255)return false;}
        return p[0]==10||p[0]==127||(p[0]==172&&p[1]>=16&&p[1]<=31)||(p[0]==192&&p[1]==168)||(p[0]==169&&p[1]==254);
    }
    public static String normalize(String address)throws Exception {
        String text=address==null?"":address.trim();if(!text.contains("://"))text="http://"+text;
        URI u=new URI(text);String host=u.getHost();if("localhost".equals(host))host="127.0.0.1";
        if(!"http".equals(u.getScheme())||!privateIPv4(host)||u.getUserInfo()!=null||u.getRawQuery()!=null||u.getRawFragment()!=null||!(u.getPath().isEmpty()||u.getPath().equals("/")))throw new IllegalArgumentException("请输入局域网主机 IPv4 地址，例如 192.168.1.8:44174");
        int port=u.getPort()==-1?44174:u.getPort();if(port<1||port>65535)throw new IllegalArgumentException("端口无效");return "http://"+host+":"+port;
    }
    public static JSONArray interfaces(int port){
        JSONArray out=new JSONArray();try{for(NetworkInterface n:Collections.list(NetworkInterface.getNetworkInterfaces())){
            if(!n.isUp()||n.isLoopback())continue;for(java.net.InetAddress a:Collections.list(n.getInetAddresses()))if(a instanceof Inet4Address&&privateIPv4(a.getHostAddress())&&!a.isLoopbackAddress())out.put(LanRoomService.obj("name",n.getDisplayName(),"ip",a.getHostAddress(),"address",a.getHostAddress()+":"+port));
        }}catch(Exception ignored){}return out;
    }
}
