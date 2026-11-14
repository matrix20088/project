package com.twoteam.buzzer;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.graphics.Color;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final UUID ROOM_UUID = UUID.fromString("b3b94e27-546c-4a6b-960d-b4ea4f061202");
    private final Object lock = new Object();
    private BluetoothAdapter adapter;
    private WebView web;
    private BluetoothServerSocket server;
    private BluetoothSocket guestSocket;
    private PrintWriter guestWriter;
    private final Map<Integer, Peer> clients = new HashMap<>();
    private volatile int epoch = 0;
    private volatile boolean hosting = false;
    private volatile boolean finished = false;
    private volatile int expected = 2;
    private TextToSpeech speech;
    private boolean speechReady = false;
    private volatile OnlineRelay online;
    private void onlineCreate(int players,boolean bot){
        shutdown(true);
        OnlineRelay relay=new OnlineRelay((event,detail)->fire(event,detail));
        online=relay;
        relay.create(Math.min(4,Math.max(2,players)),bot);
    }
    private void onlineJoin(String code){
        shutdown(true);
        OnlineRelay relay=new OnlineRelay((event,detail)->fire(event,detail));
        online=relay;relay.join(code);
    }

    static class Peer {
        final int seat;
        final BluetoothSocket socket;
        final PrintWriter writer;
        Peer(int seat, BluetoothSocket socket) throws Exception {
            this.seat=seat; this.socket=socket;
            this.writer=new PrintWriter(new OutputStreamWriter(socket.getOutputStream(),StandardCharsets.UTF_8),true);
        }
        void send(String msg) { synchronized(writer) { writer.println(msg); } }
        void close(){try{socket.close();}catch(Exception ignored){}}
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(9,14,32));
        getWindow().setNavigationBarColor(Color.rgb(9,14,32));
        BluetoothManager manager=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);
        if(manager!=null)adapter=manager.getAdapter();

        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(9,14,32));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setDefaultTextEncodingName("UTF-8");
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onConsoleMessage(android.webkit.ConsoleMessage m){
                Log.i("BuzzerJS",m.message()+" @ line "+m.lineNumber());return true;
            }
        });
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(),"Native");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");

        speech=new TextToSpeech(getApplicationContext(), status->{
            if(status==TextToSpeech.SUCCESS && speech!=null) {
                int result=speech.setLanguage(new Locale("ar","EG"));
                if(result==TextToSpeech.LANG_MISSING_DATA || result==TextToSpeech.LANG_NOT_SUPPORTED)
                    result=speech.setLanguage(new Locale("ar"));
                speechReady=result!=TextToSpeech.LANG_MISSING_DATA && result!=TextToSpeech.LANG_NOT_SUPPORTED;
                if(speechReady){
                    speech.setSpeechRate(1.00f);
                    speech.setPitch(1.06f);
                    speech.setOnUtteranceProgressListener(new UtteranceProgressListener(){
                        @Override public void onStart(String id){}
                        @Override public void onDone(String id){
                            if(id==null)return;
                            if(id.matches("[0-9]+")){
                                if(speech!=null)speech.setSpeechRate(1.0f);
                                fire("speechDone",id);
                            }else if(id.startsWith("choice-")){
                                fire("choiceDone",id.substring(7));
                            }
                        }
                        @Override public void onError(String id){
                            if(id==null)return;
                            if(id.matches("[0-9]+"))fire("speechUnavailable",id);
                            else if(id.startsWith("choice-"))fire("choiceUnavailable",id.substring(7));
                        }
                    });
                }
                fire("voiceStatus",speechReady?"ready":"unavailable");
            }
        });
    }

    private void fire(String kind,String data) {
        runOnUiThread(()->{
            if(web!=null && !isFinishing()) web.evaluateJavascript(
              "window.onNative("+JSONObject.quote(kind)+","+JSONObject.quote(data==null?"":data)+")",null);
        });
    }
    private String messageJson(String seat,String name) {return seat;}
    private boolean ready() {
        if(adapter==null){fire("error","الموبايل ده ما بيدعمش Bluetooth");return false;}
        if(Build.VERSION.SDK_INT>=31 &&
          checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED){
            fire("error","اسمح للتطبيق يستخدم البلوتوث");return false;
        }
        if(!adapter.isEnabled()){fire("error","شغّل البلوتوث من إعدادات الموبايل");return false;}
        return true;
    }
    private void shutdown(boolean intentional) {
        OnlineRelay relay=online;online=null;
        if(relay!=null)relay.close();
        synchronized(lock) {
            epoch++;hosting=false;
            try{if(server!=null)server.close();}catch(Exception ignored){}
            server=null;
            try{if(guestSocket!=null)guestSocket.close();}catch(Exception ignored){}
            guestSocket=null;guestWriter=null;
            for(Peer p:clients.values())p.close();
            clients.clear();
        }
        if(!intentional)fire("disconnected","الاتصال اتقطع");
    }
    private void sendToAll(String msg) {
        synchronized(lock) {
            for(Peer p:clients.values())p.send(msg);
        }
    }
    private void sendLine(String msg) {
        if(msg==null || msg.indexOf('\n')>=0 || msg.indexOf('\r')>=0 || msg.length()>80000)return;
        OnlineRelay relay=online;
        if(relay!=null&&relay.isActive()){relay.send(msg);return;}
        synchronized(lock){
            if(hosting) {
                for(Peer p:clients.values())p.send(msg);
            }else if(guestWriter!=null){
                synchronized(guestWriter){guestWriter.println(msg);}
            }
        }
    }
    private void startHost(final int n){
        if(!ready())return;
        shutdown(true);
        expected=Math.min(4,Math.max(2,n));
        hosting=true;
        final int run=epoch;
        fire("hosting",String.valueOf(expected));
        new Thread(()->{
            try {
                BluetoothServerSocket s=adapter.listenUsingRfcommWithServiceRecord("BuzzerArena",ROOM_UUID);
                synchronized(lock){if(run!=epoch){s.close();return;}server=s;}
                while(run==epoch){
                    BluetoothSocket incoming=s.accept();
                    if(run!=epoch){incoming.close();break;}
                    int seat=-1;
                    synchronized(lock){
                        for(int i=1;i<expected;i++)if(!clients.containsKey(i)){seat=i;break;}
                    }
                    if(seat<0) {
                        try {new PrintWriter(incoming.getOutputStream(),true).println("{\"t\":\"full\"}");}catch(Exception ignored){}
                        incoming.close();continue;
                    }
                    final Peer p=new Peer(seat,incoming);
                    synchronized(lock){clients.put(seat,p);}
                    JSONObject j=new JSONObject();
                    j.put("seat",seat);
                    j.put("device",incoming.getRemoteDevice().getName()==null?"لاعب":incoming.getRemoteDevice().getName());
                    fire("join",j.toString());
                    p.send("{\"t\":\"welcome\",\"seat\":"+seat+"}");
                    final int assigned=seat;
                    new Thread(()->readHostPeer(p,run,assigned),"buzzer-peer-"+assigned).start();
                }
            }catch(Exception e){
                if(run==epoch)fire("error","فشل فتح الغرفة: "+e.getMessage());
            }
        },"buzzer-server").start();
    }
    private void readHostPeer(Peer p,int run,int seat) {
        try(BufferedReader br=new BufferedReader(new InputStreamReader(p.socket.getInputStream(),StandardCharsets.UTF_8))){
            String line;
            while(run==epoch && (line=br.readLine())!=null){
                if(line.length()>80000)continue;
                JSONObject wrapped=new JSONObject();
                wrapped.put("seat",seat);
                wrapped.put("msg",line);
                fire("remote",wrapped.toString());
            }
        }catch(Exception ignored){}
        finally {
            synchronized(lock){
                if(clients.get(seat)==p){clients.remove(seat);p.close();}
            }
            if(run==epoch)fire("leave",String.valueOf(seat));
        }
    }
    private void join(String address) {
        if(!ready())return;
        shutdown(true);
        hosting=false;
        final int run=epoch;
        fire("waiting","بنتصل بموبايل صاحب الغرفة...");
        new Thread(()->{
            BluetoothSocket s=null;
            try{
                BluetoothDevice d=adapter.getRemoteDevice(address);
                s=d.createRfcommSocketToServiceRecord(ROOM_UUID);
                s.connect();
                if(run!=epoch){s.close();return;}
                PrintWriter writer=new PrintWriter(new OutputStreamWriter(s.getOutputStream(),StandardCharsets.UTF_8),true);
                synchronized(lock){guestSocket=s;guestWriter=writer;}
                fire("connected","تم الاتصال بالغرفة");
                try(BufferedReader br=new BufferedReader(new InputStreamReader(s.getInputStream(),StandardCharsets.UTF_8))){
                    String line;
                    while(run==epoch && (line=br.readLine())!=null){
                        if(line.length()<=80000)fire("message",line);
                    }
                }
            }catch(Exception e){
                if(run==epoch)fire("error","مش قادر أوصل بالموبايل التاني. اتأكد من الاقتران. "+e.getMessage());
            }finally{
                try{if(s!=null)s.close();}catch(Exception ignored){}
                synchronized(lock){guestWriter=null;guestSocket=null;}
                if(run==epoch)fire("disconnected","الاتصال بصاحب الغرفة انتهى");
            }
        },"buzzer-guest").start();
    }

    public class Bridge {
        @android.webkit.JavascriptInterface public void permission(){
            runOnUiThread(()->{
                if(Build.VERSION.SDK_INT>=31 &&
                  checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED){
                    requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},31);
                }else fire("ready","");
            });
        }
        @android.webkit.JavascriptInterface public void host(int n){runOnUiThread(()->startHost(n));}
        @android.webkit.JavascriptInterface public void onlineCreate(int n,boolean bot){
            runOnUiThread(()->MainActivity.this.onlineCreate(n,bot));
        }
        @android.webkit.JavascriptInterface public void onlineJoin(String code){
            runOnUiThread(()->MainActivity.this.onlineJoin(code));
        }
        @android.webkit.JavascriptInterface public void join(String address){runOnUiThread(()->MainActivity.this.join(address));}
        @android.webkit.JavascriptInterface public void send(String msg){sendLine(msg);}
        @android.webkit.JavascriptInterface public void paired(){
            runOnUiThread(()->{
                if(!ready())return;
                JSONArray arr=new JSONArray();
                try{
                    for(BluetoothDevice d:adapter.getBondedDevices()){
                        JSONObject j=new JSONObject();
                        j.put("name",d.getName()==null?"موبايل":d.getName());
                        j.put("addr",d.getAddress());
                        arr.put(j);
                    }
                }catch(Exception e){fire("error","تعذر قراءة الأجهزة المقترنة");return;}
                fire("paired",arr.toString());
            });
        }
        @android.webkit.JavascriptInterface public void settings(){
            runOnUiThread(()->startActivity(new Intent("android.settings.BLUETOOTH_SETTINGS")));
        }
        @android.webkit.JavascriptInterface public void disconnect(){shutdown(true);}
        // Short, layered metallic double-bell. Generated locally; no copyrighted audio or network.
        // Original game-show bell: two brass-like strikes, harmonic overtones and a short resonant tail.
        @android.webkit.JavascriptInterface public void playBell(){
            new Thread(()->{
                final int sampleRate=32000;
                final int frames=(int)(sampleRate*1.08);
                final byte[] pcm=new byte[frames*2];
                for(int i=0;i<frames;i++){
                    final double t=(double)i/sampleRate;
                    final double sound=bellWave(t,0.0,760.0,1.0)
                        +bellWave(t,0.17,1010.0,0.76)
                        +bellWave(t,0.36,760.0,0.25);
                    // Soft limiter avoids harsh digital clipping.
                    final double limited=Math.tanh(sound*0.57)*0.85;
                    short value=(short)(limited*32767);
                    pcm[i*2]=(byte)(value&255);
                    pcm[i*2+1]=(byte)((value>>>8)&255);
                }
                AudioTrack track=null;
                try{
                    AudioAttributes attrs=new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
                    AudioFormat format=new AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build();
                    track=new AudioTrack.Builder()
                        .setAudioAttributes(attrs)
                        .setAudioFormat(format)
                        .setTransferMode(AudioTrack.MODE_STATIC)
                        .setBufferSizeInBytes(pcm.length).build();
                    track.write(pcm,0,pcm.length);
                    track.play();
                    Thread.sleep(1110);
                }catch(Exception e){Log.w("BuzzerBell","Game-show bell playback failed",e);}
                finally{if(track!=null){try{track.stop();}catch(Exception ignored){}track.release();}}
            },"quiz-bell").start();
        }
        private double bellWave(double time,double start,double freq,double volume){
            double t=time-start;
            if(t<0)return 0;
            double attack=1.0-Math.exp(-t*210);
            double tail=attack*Math.exp(-t*5.0);
            double partials=Math.sin(2*Math.PI*freq*t)*.60
                +Math.sin(2*Math.PI*(freq*1.50)*t)*.24
                +Math.sin(2*Math.PI*(freq*2.38)*t)*.10
                +Math.sin(2*Math.PI*(freq*3.31)*t)*.06;
            return volume*tail*partials;
        }
        @android.webkit.JavascriptInterface public void vibrate(){
            runOnUiThread(()->{
                try{
                    Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);
                    if(v!=null&&v.hasVibrator())v.vibrate(VibrationEffect.createOneShot(90,120));
                }catch(Exception ignored){}
            });
        }
        @android.webkit.JavascriptInterface public void speak(String text){
            announce(text,"comment");
        }
        // The referee changes pace slightly by situation, without imitating a real host's voice.
        @android.webkit.JavascriptInterface public void speakMood(String text,String mood){
            runOnUiThread(()->{
                if(!speechReady||speech==null||text==null||text.isEmpty())return;
                final String type=mood==null?"normal":mood;
                float speed=1.0f,pitch=1.06f;
                switch(type){
                    case "excited": speed=1.13f;pitch=1.15f;break;
                    case "suspense":speed=0.99f;pitch=1.02f;break;
                    case "praise":speed=1.09f;pitch=1.11f;break;
                    case "tease":speed=0.99f;pitch=1.08f;break;
                    case "winner":speed=1.00f;pitch=1.15f;break;
                    default:break;
                }
                final float micro=(float)(System.nanoTime()%5)/100f;
                speech.setSpeechRate(speed+micro);
                speech.setPitch(pitch+micro/2);
                int result=speech.speak(text.substring(0,Math.min(text.length(),500)),
                    TextToSpeech.QUEUE_FLUSH,null,"mood-"+type+"-"+System.nanoTime());
                if(result==TextToSpeech.ERROR)fire("voiceStatus","unavailable");
            });
        }
        @android.webkit.JavascriptInterface public void announce(String text,String utteranceId){
            runOnUiThread(()->{
                if(speechReady&&text!=null&&!text.isEmpty()&&speech!=null){
                    speech.setSpeechRate(0.97f+(float)(System.nanoTime()%11)/100.0f);
                    speech.setPitch(1.01f+(float)(System.nanoTime()%12)/100.0f);
                    String id=(utteranceId==null||utteranceId.isEmpty())?"comment":utteranceId;
                    int result=speech.speak(text.substring(0,Math.min(500,text.length())),
                        TextToSpeech.QUEUE_FLUSH,null,id);
                    if(result==TextToSpeech.ERROR)fire("voiceStatus","unavailable");
                }else fire("voiceStatus","unavailable");
            });
        }
        @android.webkit.JavascriptInterface public void stopSpeech(){
            runOnUiThread(()->{if(speech!=null)speech.stop();});
        }
        @android.webkit.JavascriptInterface public void speakChoice(String text,String token){
            runOnUiThread(()->{
                if(!speechReady||speech==null||text==null||text.isEmpty()){
                    fire("choiceUnavailable",token);return;
                }
                speech.setSpeechRate(0.92f);
                speech.setPitch(1.05f);
                int rc=speech.speak(text.substring(0,Math.min(text.length(),300)),
                    TextToSpeech.QUEUE_FLUSH,null,"choice-"+token);
                if(rc==TextToSpeech.ERROR)fire("choiceUnavailable",token);
            });
        }
        @android.webkit.JavascriptInterface public void speakQuestion(String text,String round){
            runOnUiThread(()->{
                if(speechReady&&speech!=null&&text!=null&&!text.isEmpty()){
                    speech.setSpeechRate(1.0f);
                    speech.setPitch(1.05f);
                    int rc=speech.speak(text.substring(0,Math.min(500,text.length())),
                        TextToSpeech.QUEUE_FLUSH,null,round==null?"q":round);
                    if(rc==TextToSpeech.ERROR)fire("speechUnavailable",round);
                }else fire("speechUnavailable",round);
            });
        }
        @android.webkit.JavascriptInterface public void spellQuestion(String intro,String lettersJson,String round){
            runOnUiThread(()->{
                if(!speechReady||speech==null){fire("speechUnavailable",round);return;}
                try{
                    JSONArray letters=new JSONArray(lettersJson);
                    if(letters.length()<2||letters.length()>48){fire("speechUnavailable",round);return;}
                    int started=speech.speak(intro,TextToSpeech.QUEUE_FLUSH,null,"spell-intro-"+round);
                    if(started==TextToSpeech.ERROR){fire("speechUnavailable",round);return;}
                    speech.setSpeechRate(0.77f);
                    for(int i=0;i<letters.length();i++){
                        final String label=letters.getString(i);
                        if(label.length()>35)throw new Exception("Invalid letter label");
                        speech.speak(label,TextToSpeech.QUEUE_ADD,null,"spell-"+round+"-"+i);
                        // A real pause after every letter, rather than reading one fast sentence.
                        speech.playSilentUtterance(470,TextToSpeech.QUEUE_ADD,"spell-pause-"+round+"-"+i);
                    }
                    // The LAST utterance owns the completion event, so the buzzer stays hidden until every letter is heard.
                    speech.speak("استعدوا.",TextToSpeech.QUEUE_ADD,null,round);
                }catch(Exception e){fire("speechUnavailable",round);}
            });
        }
        @android.webkit.JavascriptInterface public void voiceSettings(){
            runOnUiThread(()->{
                try{startActivity(new Intent("com.android.settings.TTS_SETTINGS"));}
                catch(Exception e){fire("voiceStatus","unavailable");}
            });
        }
    }

    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grantResults){
        super.onRequestPermissionsResult(request,permissions,grantResults);
        if(request==31){
            if(grantResults.length>0&&grantResults[0]==PackageManager.PERMISSION_GRANTED)fire("ready","");
            else fire("error","لازم تسمح للتطبيق يستخدم البلوتوث من إعدادات الصلاحيات");
        }
    }
    @Override public void onBackPressed(){
        if(web!=null)web.evaluateJavascript("window.backToMenu&&window.backToMenu()",null);
        else super.onBackPressed();
    }
    @Override protected void onDestroy(){
        finished=true;shutdown(true);
        if(speech!=null){speech.stop();speech.shutdown();speech=null;}
        if(web!=null){web.destroy();web=null;}
        super.onDestroy();
    }
}