package com.neonvow.prototype;

import android.app.Activity;
import android.os.Bundle;
import android.net.Uri;
import android.graphics.Color;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import java.io.InputStream;
import java.io.IOException;

public class MainActivity extends Activity {
  private WebView web;
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);
    getWindow().setStatusBarColor(Color.BLACK);
    web=new WebView(this);
    web.setBackgroundColor(Color.rgb(7,16,35));
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setAllowFileAccess(false);
    web.getSettings().setAllowContentAccess(false);
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onConsoleMessage(ConsoleMessage m){
        android.util.Log.i("NeonVowJS",m.message()+" @ "+m.lineNumber());return true;
      }
    });
    web.setWebViewClient(new WebViewClient(){
      @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request){
        Uri u=request.getUrl();
        if(!"https".equals(u.getScheme()) || !"appassets.androidplatform.net".equals(u.getHost()))return null;
        String path=u.getPath();
        if(!path.startsWith("/assets/"))return null;
        String relative=path.substring("/assets/".length());
        if(relative.contains(".."))return null;
        try{
          InputStream stream=getAssets().open(relative);
          String mime=relative.endsWith(".html")?"text/html":
            relative.endsWith(".js")?"text/javascript":
            relative.endsWith(".glb")?"model/gltf-binary":"application/octet-stream";
          return new WebResourceResponse(mime,null,stream);
        }catch(IOException e){
          return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",
            java.util.Collections.singletonMap("Access-Control-Allow-Origin","*"),
            new java.io.ByteArrayInputStream(new byte[0]));
        }
      }
    });
    setContentView(web);
    web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
  }
  @Override public void onBackPressed(){web.evaluateJavascript("window.history.back()",null);}
  @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
