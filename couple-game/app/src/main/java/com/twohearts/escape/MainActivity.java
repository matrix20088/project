package com.twohearts.escape;

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
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final UUID GAME_ID=UUID.fromString("a51be410-34e2-4582-91d6-1d2e27a001ba");
    private WebView web;
    private BluetoothAdapter adapter;
    private BluetoothSocket socket;
    private BluetoothServerSocket server;
    private PrintWriter output;
    private volatile boolean closing=false;
    private final Object sendLock=new Object();

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(0xff0b1020);
        getWindow().setNavigationBarColor(0xff0b1020);
        getWindow().addFlags(128);
        BluetoothManager manager=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);
        if(manager!=null) adapter=manager.getAdapter();
        web=new WebView(this);
        web.setBackgroundColor(0xff0b1020);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(),"Native");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }
    private void fire(String type,String value) {
        runOnUiThread(()-> {
            if(web!=null) web.evaluateJavascript("window.onNative("+JSONObject.quote(type)+","+JSONObject.quote(value)+")",null);
        });
    }
    private boolean permitted(){
        if(Build.VERSION.SDK_INT<31) return true;
        return checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;
    }
    private boolean checkReady(){
        if(adapter==null){fire("error","الجهاز ده مش بيدعم بلوتوث"); return false;}
        if(!permitted()){fire("error","اسمح بصلاحية البلوتوث الأول");return false;}
        if(!adapter.isEnabled()){fire("error","شغّل البلوتوث من إعدادات الموبايل");return false;}
        return true;
    }
    private void attach(BluetoothSocket active, String role) throws Exception {
        socket=active;
        synchronized(sendLock){
            output=new PrintWriter(new OutputStreamWriter(active.getOutputStream(),StandardCharsets.UTF_8),true);
        }
        fire("connected",role);
        try (BufferedReader input=new BufferedReader(new InputStreamReader(active.getInputStream(),StandardCharsets.UTF_8))) {
            String line;
            while(!closing && (line=input.readLine())!=null) fire("message",line);
        } finally {
            synchronized(sendLock){output=null;}
            try{active.close();}catch(Exception ignored){}
            socket=null;
            if(!closing) fire("disconnected","الاتصال اتقطع. جرّبوا تتصلوا تاني.");
        }
    }
    private void stopOld(){
        try { if(server!=null)server.close(); } catch(Exception ignored){}
        try { if(socket!=null)socket.close(); } catch(Exception ignored){}
        synchronized(sendLock){output=null;}
        socket=null;server=null;
    }
    public class Bridge {
        @JavascriptInterface public void permission(){
            runOnUiThread(()->{
                if(Build.VERSION.SDK_INT>=31 && !permitted())
                    requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},51);
                else fire("ready","تمام");
            });
        }
        @JavascriptInterface public void settings(){
            runOnUiThread(()->startActivity(new Intent("android.settings.BLUETOOTH_SETTINGS")));
        }
        @JavascriptInterface public void paired(){
            runOnUiThread(()->{
                if(!checkReady())return;
                JSONArray list=new JSONArray();
                try {
                    for(BluetoothDevice d:adapter.getBondedDevices()){
                        JSONObject row=new JSONObject();
                        row.put("name",d.getName()==null?"هاتف":d.getName());
                        row.put("addr",d.getAddress());
                        list.put(row);
                    }
                }catch(Exception e){fire("error","تعذر قراءة الأجهزة المقترنة");return;}
                fire("paired",list.toString());
            });
        }
        @JavascriptInterface public void host(){
            runOnUiThread(()->{
                if(!checkReady())return;
                stopOld();
                fire("waiting","شغّل الاتصال من موبايل شريكك");
                new Thread(()->{
                    try {
                        server=adapter.listenUsingRfcommWithServiceRecord("EscapeTogether",GAME_ID);
                        BluetoothSocket accepted=server.accept();
                        try{server.close();}catch(Exception ignored){}
                        server=null;
                        attach(accepted,"host");
                    } catch(Exception e){
                        if(!closing) fire("error","تعذر إنشاء الغرفة: "+e.getMessage());
                    }
                },"game-host").start();
            });
        }
        @JavascriptInterface public void join(String address){
            runOnUiThread(()->{
                if(!checkReady())return;
                stopOld();
                fire("waiting","جاري الاتصال بالموبايل التاني...");
                new Thread(()->{
                    try{
                        BluetoothDevice device=adapter.getRemoteDevice(address);
                        BluetoothSocket active=device.createRfcommSocketToServiceRecord(GAME_ID);
                        active.connect();
                        attach(active,"guest");
                    }catch(Exception e){
                        if(!closing)fire("error","فشل الاتصال. اتأكدوا إن الجهازين مقترنين: "+e.getMessage());
                    }
                },"game-join").start();
            });
        }
        @JavascriptInterface public void send(String message){
            synchronized(sendLock){
                if(output!=null && message!=null && !message.contains("\n"))output.println(message);
            }
        }
        @JavascriptInterface public void vibrate(){
            runOnUiThread(()->{
                try{
                    android.os.Vibrator v=(android.os.Vibrator)getSystemService(VIBRATOR_SERVICE);
                    if(v!=null && v.hasVibrator())v.vibrate(android.os.VibrationEffect.createOneShot(80,120));
                }catch(Exception ignored){}
            });
        }
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){
        super.onRequestPermissionsResult(code,permissions,results);
        if(code==51)fire(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED?"ready":"error",
            results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED?"تمام":"لازم تسمح بصلاحية البلوتوث");
    }
    @Override protected void onDestroy(){
        closing=true;stopOld();
        if(web!=null){web.destroy();web=null;}
        super.onDestroy();
    }
}
