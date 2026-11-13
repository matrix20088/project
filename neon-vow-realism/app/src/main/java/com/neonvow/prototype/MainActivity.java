package com.neonvow.prototype;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final UUID GAME_UUID=UUID.fromString("f1a3ca74-1fb2-48a6-ad1e-bb9168c4f389");
    private WebView web;
    private BluetoothAdapter adapter;
    private volatile BluetoothSocket socket;
    private volatile BluetoothServerSocket server;
    private final Object sendLock=new Object();
    private PrintWriter writer;
    private volatile boolean closing=false;
    private volatile int epoch=0;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().addFlags(128);
        BluetoothManager manager=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);
        adapter=manager==null?null:manager.getAdapter();
        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(8,17,38));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setDefaultTextEncodingName("UTF-8");
        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onConsoleMessage(ConsoleMessage m){
                android.util.Log.i("NeonVow",m.message()+" @ "+m.lineNumber());return true;
            }
        });
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){
                Uri u=req.getUrl();
                if(!"https".equals(u.getScheme())||!"appassets.androidplatform.net".equals(u.getHost())){
                    return blocked();
                }
                String path=u.getPath();
                if(path==null||!path.startsWith("/assets/"))return blocked();
                String relative=path.substring(8);
                if(relative.contains("..")||relative.isEmpty())return blocked();
                try{
                    InputStream in=getAssets().open(relative);
                    String mime=relative.endsWith(".html")?"text/html":relative.endsWith(".js")?"text/javascript":
                        relative.endsWith(".glb")?"model/gltf-binary":
                        relative.endsWith(".css")?"text/css":"application/octet-stream";
                    return new WebResourceResponse(mime,null,in);
                }catch(IOException e){return blocked();}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){
                Uri u=req.getUrl();
                return !("https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost()));
            }
        });
        web.addJavascriptInterface(new Bridge(),"Native");
        setContentView(web);
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }
    private WebResourceResponse blocked(){
        return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",
            Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
    }
    private void fire(String kind,String val){
        runOnUiThread(()->{
            if(web!=null){
                web.evaluateJavascript("window.onNative && window.onNative("+JSONObject.quote(kind)+","+JSONObject.quote(val)+")",null);
            }
        });
    }
    private boolean permitted(){
        return Build.VERSION.SDK_INT<31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;
    }
    private boolean ready(){
        if(adapter==null){fire("error","الموبايل ده مفيهوش بلوتوث");return false;}
        if(!permitted()){fire("error","اسمح للعبة تستخدم البلوتوث");return false;}
        if(!adapter.isEnabled()){fire("error","شغّل البلوتوث من إعدادات الموبايل");return false;}
        return true;
    }
    private void disconnectNow(){
        epoch++;
        try{if(server!=null)server.close();}catch(Exception ignored){}
        try{if(socket!=null)socket.close();}catch(Exception ignored){}
        server=null;socket=null;
        synchronized(sendLock){writer=null;}
    }
    private void attach(BluetoothSocket active,String role,int session)throws IOException{
        if(session!=epoch){try{active.close();}catch(Exception ignored){}return;}
        socket=active;
        synchronized(sendLock){
            writer=new PrintWriter(new OutputStreamWriter(active.getOutputStream(),StandardCharsets.UTF_8),true);
        }
        fire("connected",role);
        try(BufferedReader input=new BufferedReader(new InputStreamReader(active.getInputStream(),StandardCharsets.UTF_8))){
            String line;
            while(!closing&&session==epoch&&(line=input.readLine())!=null){
                if(line.length()<=1000000)fire("message",line);
            }
        }finally{
            synchronized(sendLock){writer=null;}
            try{active.close();}catch(Exception ignored){}
            if(session==epoch){
                socket=null;
                if(!closing)fire("disconnected","اتقطع الاتصال. شغّلوا البلوتوث واتصلوا تاني.");
            }
        }
    }
    public class Bridge{
        @JavascriptInterface public void permission(){
            runOnUiThread(()->{
                if(adapter==null){fire("error","الجهاز ده مش بيدعم البلوتوث");return;}
                if(Build.VERSION.SDK_INT>=31&&!permitted()){
                    requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},73);
                }else fire("ready","تمام");
            });
        }
        @JavascriptInterface public void settings(){
            runOnUiThread(()->startActivity(new android.content.Intent("android.settings.BLUETOOTH_SETTINGS")));
        }
        @JavascriptInterface public void paired(){
            runOnUiThread(()->{
                if(!ready())return;
                try{
                    JSONArray arr=new JSONArray();
                    Set<BluetoothDevice> devices=adapter.getBondedDevices();
                    for(BluetoothDevice d:devices){
                        JSONObject row=new JSONObject();
                        row.put("name",d.getName()==null?"موبايل":d.getName());
                        row.put("addr",d.getAddress());arr.put(row);
                    }
                    fire("paired",arr.toString());
                }catch(Exception e){fire("error","مش قادر أقرأ الأجهزة المقترنة");}
            });
        }
        @JavascriptInterface public void host(){
            runOnUiThread(()->{
                if(!ready())return;
                disconnectNow();
                final int session=epoch;
                fire("waiting","افتح انضمام من موبايل شريكك...");
                new Thread(()->{
                    try{
                        server=adapter.listenUsingRfcommWithServiceRecord("NeonVowCoop",GAME_UUID);
                        BluetoothSocket active=server.accept();
                        try{server.close();}catch(Exception ignored){}
                        server=null;
                        attach(active,"host",session);
                    }catch(Exception e){
                        if(!closing&&session==epoch)fire("error","تعذر فتح الغرفة: "+e.getMessage());
                    }
                },"NeonVowHost").start();
            });
        }
        @JavascriptInterface public void join(String address){
            runOnUiThread(()->{
                if(!ready())return;
                disconnectNow();
                final int session=epoch;
                fire("waiting","بنحاول نتصل بالموبايل التاني...");
                new Thread(()->{
                    try{
                        BluetoothDevice device=adapter.getRemoteDevice(address);
                        BluetoothSocket active=device.createRfcommSocketToServiceRecord(GAME_UUID);
                        active.connect();
                        attach(active,"guest",session);
                    }catch(Exception e){
                        if(!closing&&session==epoch)fire("error","فشل اتصال البلوتوث. اتأكدوا من الاقتران: "+e.getMessage());
                    }
                },"NeonVowJoin").start();
            });
        }
        @JavascriptInterface public void send(String message){
            if(message==null||message.length()>200000||message.contains("\n"))return;
            synchronized(sendLock){if(writer!=null)writer.println(message);}
        }
        @JavascriptInterface public void disconnect(){
            runOnUiThread(()->disconnectNow());
        }
        @JavascriptInterface public void vibrate(){
            runOnUiThread(()->{
                try{
                    Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);
                    if(v!=null&&v.hasVibrator()){
                        v.vibrate(VibrationEffect.createOneShot(45,110));
                    }
                }catch(Exception ignored){}
            });
        }
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] grants){
        super.onRequestPermissionsResult(code,permissions,grants);
        if(code==73)fire(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED?"ready":"error",
            grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED?"تمام":"صلاحيّة البلوتوث مطلوبة علشان تلعبوا سوا");
    }
    @Override public void onBackPressed(){
        if(web!=null)web.evaluateJavascript("window.__NV_TEST?.back?.()",null);
        else super.onBackPressed();
    }
    @Override protected void onDestroy(){
        closing=true;disconnectNow();
        if(web!=null){web.destroy();web=null;}
        super.onDestroy();
    }
}