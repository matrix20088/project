package com.twoteam.buzzer;

import org.json.JSONArray;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Internet room beta: host phone remains the authoritative game referee.
 * Private relay stores short-lived events and a sanitized latest game state.
 */
final class OnlineRelay {
    interface Listener { void fire(String kind, String detail); }
    static final String URL_API="https://jars-al-tahaddi-online.vercel.app/api/room";
    private final Listener listener;
    private final ExecutorService sending=Executors.newSingleThreadExecutor();
    private volatile boolean active=false,owner=false;
    private volatile int epoch=0;
    private volatile String code="",token="",playerId="";
    private volatile long lastEventTime=0,lastStateTime=0;
    private volatile int seats=2,botSeat=-1,assignedSeat=-2;
    private final Map<String,Integer> assigned=new HashMap<>();
    private final Set<String> processed=new HashSet<>();
    OnlineRelay(Listener listener){this.listener=listener;}
    boolean isActive(){return active;}
    void close(){
        active=false;epoch++;
        sending.shutdownNow();
    }
    private void fire(String event,String detail){listener.fire(event,detail);}
    private static JSONObject obj(Object...values)throws Exception{
        JSONObject j=new JSONObject();
        for(int i=0;i+1<values.length;i+=2)j.put((String)values[i],values[i+1]);
        return j;
    }
    private JSONObject request(JSONObject body)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(URL_API).openConnection();
        try {
            c.setRequestMethod("POST");
            c.setConnectTimeout(8500);c.setReadTimeout(14000);
            c.setDoOutput(true);c.setUseCaches(false);
            c.setRequestProperty("Content-Type","application/json; charset=utf-8");
            c.setRequestProperty("Accept","application/json");
            byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
            try(OutputStream out=c.getOutputStream()){out.write(bytes);}
            int status=c.getResponseCode();
            java.io.InputStream input=status>=400?c.getErrorStream():c.getInputStream();
            StringBuilder txt=new StringBuilder();
            if(input!=null)try(BufferedReader in=new BufferedReader(new InputStreamReader(input,StandardCharsets.UTF_8))){
                String line;while((line=in.readLine())!=null && txt.length()<120000)txt.append(line);
            }
            JSONObject data=new JSONObject(txt.length()>0?txt.toString():"{}");
            if(status>=400)throw new Exception(data.optString("error","server error")+" ("+status+")");
            return data;
        } finally { c.disconnect(); }
    }
    private void onThread(Runnable task,String label){new Thread(task,"online-"+label).start();}
    void create(int n,boolean computer){
        final int operation=++epoch;
        active=false;owner=true;seats=n;botSeat=computer?n-1:-1;
        processed.clear();assigned.clear();
        fire("waiting","بننشئ غرفة أونلاين برقم من 6 أرقام...");
        onThread(()->{
            try{
                JSONObject result=request(obj("action","create","target",n));
                if(operation!=epoch)return;
                code=result.getString("code");token=result.getString("token");
                playerId="";owner=true;active=true;lastEventTime=System.currentTimeMillis()-1500;
                fire("hosting",String.valueOf(n));
                fire("roomCode",code);
                poll(operation);
            }catch(Exception e){if(operation==epoch)fire("error","تعذر إنشاء الغرفة: "+e.getMessage());}
        },"create");
    }
    void join(String room){
        if(room==null||!room.matches("[1-9][0-9]{5}")){fire("error","رقم الغرفة لازم يكون 6 أرقام");return;}
        final int operation=++epoch;
        active=false;owner=false;code=room;
        fire("waiting","بنتصل بالغرفة "+room+"...");
        onThread(()->{
            try{
                JSONObject result=request(obj("action","join","code",room));
                if(operation!=epoch)return;
                playerId=result.getString("id");token=result.getString("token");
                owner=false;active=true;assignedSeat=-2;lastStateTime=0;
                fire("connected","دخلت السيرفر");
                fire("roomCode",code);
                poll(operation);
            }catch(Exception e){if(operation==epoch)fire("error","تعذر الدخول: "+e.getMessage());}
        },"join");
    }
    void send(String message){
        if(!active||message==null||message.length()>80000)return;
        final String currentCode=code,currentToken=token,id=playerId;
        final boolean isOwner=owner;
        sending.submit(()->{
            try{
                JSONObject packet=new JSONObject(message);
                if(isOwner&&"state".equals(packet.optString("t"))){
                    request(obj("action","state","role","host","code",currentCode,"token",currentToken,"message",packet));
                }else if(!isOwner){
                    request(obj("action","event","role","guest","code",currentCode,"id",id,"token",currentToken,"message",packet));
                }
            }catch(Exception e){android.util.Log.w("OnlineQuiz","Send failed",e);}
        });
    }
    private void welcome(String id,int seat){
        final String currentCode=code,currentToken=token;
        sending.submit(()->{
            try{
                request(obj("action","welcome","role","host","code",currentCode,
                        "token",currentToken,"id",id,"seat",seat));
            }catch(Exception e){android.util.Log.w("OnlineQuiz","Welcome failed",e);}
        });
    }
    private void poll(int operation){
        onThread(()->{
            int errors=0;
            while(active&&operation==epoch){
                try{
                    if(owner)readHostEvents();else readGuestRoom();
                    errors=0;
                }catch(Exception e){
                    errors++;
                    if(errors==5)fire("onlineWarning","في تأخير بالشبكة، بنحاول نرجع الاتصال...");
                    if(errors>=15){active=false;fire("disconnected","اتقطع الاتصال بسيرفر اللعبة");break;}
                }
                try{Thread.sleep(owner?650:900);}catch(InterruptedException e){break;}
            }
        },"poll");
    }
    private void readHostEvents()throws Exception{
        long since=lastEventTime>0?lastEventTime-1000:System.currentTimeMillis()-15000;
        JSONObject data=request(obj("action","poll","role","host","code",code,"token",token,"since",since));
        JSONArray events=data.optJSONArray("events");if(events==null)return;
        for(int i=0;i<events.length();i++){
            JSONObject event=events.optJSONObject(i);if(event==null)continue;
            String eventId=event.optString("eventId");
            if(eventId.isEmpty()||!processed.add(eventId))continue;
            if(processed.size()>2000)processed.clear();
            lastEventTime=Math.max(lastEventTime,event.optLong("time",0));
            String who=event.optString("id");
            if("join".equals(event.optString("kind"))){
                if(assigned.containsKey(who)){welcome(who,assigned.get(who));continue;}
                int selected=-1;
                for(int j=1;j<seats;j++){
                    if(j!=botSeat&&!assigned.containsValue(j)){selected=j;break;}
                }
                assigned.put(who,selected);
                welcome(who,selected);
                if(selected>=0)fire("join",obj("seat",selected,"device","لاعب أونلاين").toString());
            }else if("event".equals(event.optString("kind"))){
                Integer seat=assigned.get(who);
                if(seat==null||seat<0)continue;
                JSONObject packet=event.optJSONObject("message");if(packet==null)continue;
                if("leave".equals(packet.optString("t"))){
                    assigned.remove(who);fire("leave",String.valueOf(seat));
                }else fire("remote",obj("seat",seat,"msg",packet.toString()).toString());
            }
        }
    }
    private void readGuestRoom()throws Exception{
        JSONObject data=request(obj("action","poll","role","guest","code",code,"id",playerId,"token",token));
        JSONObject welcome=data.optJSONObject("welcome");
        if(welcome!=null&&assignedSeat==-2){
            assignedSeat=welcome.optInt("seat",-1);
            if(assignedSeat<0){fire("message",obj("t","full").toString());active=false;return;}
            fire("message",obj("t","welcome","seat",assignedSeat).toString());
        }
        if(assignedSeat<0)return;
        long updated=data.optLong("updated",0);
        JSONObject message=data.optJSONObject("message");
        if(message!=null&&updated>lastStateTime){
            lastStateTime=updated;
            fire("message",message.toString());
        }
    }
}
