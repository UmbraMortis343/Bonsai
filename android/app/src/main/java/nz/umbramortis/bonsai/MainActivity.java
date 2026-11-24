package nz.umbramortis.bonsai;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.view.ViewGroup;
import android.view.WindowInsets;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

// Bonsai for Android: a window on the live Bonsai (Bonsai Beta opens /beta/), so the app updates itself as the
// website does and keeps its data in this WebView, like Bonsai Desktop (desktop/main.js). The page reaches the
// phone through window.bonsaiAndroid (Bridge below; src/live.js on the page side): reminders, the widget's
// numbers, what was shared in, the clipboard and saving files. Links out of Bonsai open in the browser.
public class MainActivity extends Activity {
    static final String ROOT = "https://umbramortis343.github.io/Bonsai/";   // only pages under here are Bonsai's
    static final int REQ_FILE = 1, REQ_NOTIFY = 2;
    static final int MAX_IMAGES = 10;

    private WebView web;
    private FrameLayout root;
    private ValueCallback<Uri[]> fileCb;
    private volatile String pageUrl = "";
    private final Handler ui = new Handler(Looper.getMainLooper());
    // waiting for the page to take: { open: "today" } and/or { share: { text, subject, images } }
    private static String pendingOpen = null;
    private static JSONObject pendingShare = null;

    static boolean ours(String url) { return url != null && url.startsWith(ROOT); }
    static String version() { return BuildConfig.VERSION_NAME.replace("-beta", ""); }

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.bg));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        edgeToEdge();
        setUpWeb();
        Reminders.channel(this);
        Reminders.schedule(this);
        handle(getIntent());
        web.loadUrl(BuildConfig.START_URL);
    }

    // The page runs under the status bar and above the keyboard: pad by both, so nothing is covered.
    private void edgeToEdge() {
        if (Build.VERSION.SDK_INT < 30) return;   // older Android: adjustResize does it
        getWindow().setDecorFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((v, ins) -> {
            Insets i = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsets.CONSUMED;
        });
    }

    private void setUpWeb() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setTextZoom(100);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setUserAgentString(s.getUserAgentString() + " BonsaiAndroid/" + version());
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "bonsaiAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String u = r.getUrl().toString();
                if (ours(u) || !r.isForMainFrame()) return false;
                out(u);
                return true;
            }
            @Override
            public void onPageStarted(WebView v, String url, Bitmap icon) { pageUrl = url; }
            @Override
            public void doUpdateVisitedHistory(WebView v, String url, boolean reload) { pageUrl = url; }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame() && ours(r.getUrl().toString())) offline();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                List<String> types = new ArrayList<>();
                for (String t : p.getAcceptTypes()) for (String x : t.split(",")) { x = x.trim(); if (x.contains("/")) types.add(x); }
                if (types.size() == 1) i.setType(types.get(0));
                else if (types.size() > 1) i.putExtra(Intent.EXTRA_MIME_TYPES, types.toArray(new String[0]));
                if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try { startActivityForResult(Intent.createChooser(i, null), REQ_FILE); }
                catch (ActivityNotFoundException e) { fileCb = null; return false; }
                return true;
            }
            // window.open: Bonsai's own pages load here, everything else goes to the browser
            @Override
            public boolean onCreateWindow(WebView v, boolean dialog, boolean user, Message msg) {
                WebView tmp = new WebView(MainActivity.this);
                tmp.setWebViewClient(new WebViewClient() {
                    boolean done;
                    void take(WebView w, String u) {
                        if (done || u == null || u.isEmpty() || u.startsWith("about:")) return;
                        done = true;
                        if (ours(u)) web.loadUrl(u); else out(u);
                        ui.post(w::destroy);
                    }
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest r) { take(w, r.getUrl().toString()); return true; }
                    @Override
                    public void onPageStarted(WebView w, String url, Bitmap icon) { take(w, url); w.stopLoading(); }
                });
                ((WebView.WebViewTransport) msg.obj).setWebView(tmp);
                msg.sendToTarget();
                return true;
            }
            @Override
            public void onPermissionRequest(PermissionRequest r) { r.deny(); }
        });
    }

    private void offline() {
        String html = "<!DOCTYPE html><meta charset=utf-8><meta name=viewport content=\"width=device-width\"><title>Bonsai</title>"
                + "<style>body{font:15px system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#fff;color:#1d1d1b}"
                + "@media(prefers-color-scheme:dark){body{background:#151514;color:#ebeae6}}a{color:#3e7a4b}</style>"
                + "<p>Bonsai can't be reached. <a href=\"" + BuildConfig.START_URL + "\">Try again</a></p>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    private void out(String url) {
        if (!url.matches("^(https?|mailto|tel):.*")) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
        catch (ActivityNotFoundException ignored) {}
    }

    // Back: the page first (a dialog, Today, a picker), then the page's history, then Bonsai goes to the background.
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(function(){try{return !!(window.bonsaiBack&&window.bonsaiBack())}catch(e){return false}})()", (v) -> {
            if ("true".equals(v)) return;
            if (web.canGoBack()) web.goBack(); else moveTaskToBack(true);
        });
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        handle(i);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        poke();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    private void poke() {
        ui.post(() -> web.evaluateJavascript("window.bonsaiAndroidPoke&&window.bonsaiAndroidPoke()", null));
    }

    private void handle(Intent i) {
        if (i == null) return;
        String a = i.getAction();
        if (Reminders.ACTION_TODAY.equals(a)) { synchronized (MainActivity.class) { pendingOpen = "today"; } poke(); }
        else if (Intent.ACTION_SEND.equals(a) || Intent.ACTION_SEND_MULTIPLE.equals(a)) {
            final Intent in = i;
            new Thread(() -> {
                JSONObject s = readShare(in);
                synchronized (MainActivity.class) { pendingShare = s; }
                poke();
            }).start();
            setIntent(new Intent(Intent.ACTION_MAIN));   // taken once, not again on a rotation
        }
    }

    @SuppressWarnings("deprecation")
    private JSONObject readShare(Intent i) {
        JSONObject o = new JSONObject();
        try {
            CharSequence text = i.getCharSequenceExtra(Intent.EXTRA_TEXT);
            String subject = i.getStringExtra(Intent.EXTRA_SUBJECT);
            if (subject == null) subject = i.getStringExtra(Intent.EXTRA_TITLE);
            o.put("text", text == null ? "" : text.toString());
            o.put("subject", subject == null ? "" : subject);
            List<Uri> uris = new ArrayList<>();
            if (Intent.ACTION_SEND_MULTIPLE.equals(i.getAction())) {
                ArrayList<Uri> l = i.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (l != null) uris.addAll(l);
            } else {
                Uri u = i.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) uris.add(u);
            }
            ClipData cd = i.getClipData();
            if (uris.isEmpty() && cd != null) for (int k = 0; k < cd.getItemCount(); k++) if (cd.getItemAt(k).getUri() != null) uris.add(cd.getItemAt(k).getUri());
            JSONArray images = new JSONArray();
            for (Uri u : uris) {
                if (images.length() >= MAX_IMAGES) break;
                JSONObject img = readImage(u);
                if (img != null) images.put(img);
            }
            o.put("images", images);
        } catch (Exception ignored) {}
        return o;
    }

    // A shared picture as { type, data (base64) }. Big ones are brought down to 2600 px here; the page shrinks
    // them the rest of the way as it does any picture (src/images.js).
    private JSONObject readImage(Uri u) {
        try {
            String type = getContentResolver().getType(u);
            if (type == null || !type.startsWith("image/")) return null;
            byte[] bytes;
            try (InputStream in = getContentResolver().openInputStream(u)) {
                if (in == null) return null;
                ByteArrayOutputStream b = new ByteArrayOutputStream();
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) { b.write(buf, 0, n); if (b.size() > 40_000_000) return null; }
                bytes = b.toByteArray();
            }
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o);
            int side = Math.max(o.outWidth, o.outHeight);
            boolean plain = type.matches("image/(png|jpeg|webp|gif)");
            if (!plain || side > 2600 || bytes.length > 6_000_000) {
                int sample = 1;
                while (side / (sample * 2) >= 2600) sample *= 2;
                BitmapFactory.Options d = new BitmapFactory.Options();
                d.inSampleSize = sample;
                Bitmap bm = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, d);
                if (bm == null) return null;
                float k = Math.min(1f, 2600f / Math.max(bm.getWidth(), bm.getHeight()));
                if (k < 1f) { Bitmap s = Bitmap.createScaledBitmap(bm, Math.round(bm.getWidth() * k), Math.round(bm.getHeight() * k), true); bm.recycle(); bm = s; }
                ByteArrayOutputStream b = new ByteArrayOutputStream();
                bm.compress(Bitmap.CompressFormat.JPEG, 90, b);
                bm.recycle();
                bytes = b.toByteArray();
                type = "image/jpeg";
            }
            JSONObject img = new JSONObject();
            img.put("type", type);
            img.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
            return img;
        } catch (Exception | OutOfMemoryError e) {
            return null;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_FILE || fileCb == null) return;
        Uri[] got = null;
        if (res == RESULT_OK && data != null) {
            List<Uri> l = new ArrayList<>();
            ClipData cd = data.getClipData();
            if (cd != null) for (int k = 0; k < cd.getItemCount(); k++) l.add(cd.getItemAt(k).getUri());
            else if (data.getData() != null) l.add(data.getData());
            got = l.toArray(new Uri[0]);
        }
        fileCb.onReceiveValue(got);
        fileCb = null;
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        if (req != REQ_NOTIFY) return;
        boolean ok = notifyAllowed();
        ui.post(() -> web.evaluateJavascript("window.bonsaiAndroidEvent&&window.bonsaiAndroidEvent({type:'notify',allowed:" + ok + "})", null));
    }

    private boolean notifyAllowed() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        return nm != null && nm.areNotificationsEnabled();
    }

    // ---------- the bridge (window.bonsaiAndroid). Every call is checked to come from Bonsai's own pages. ----------
    final class Bridge {
        private boolean ok() { return ours(pageUrl); }

        @JavascriptInterface
        public String info() {
            try {
                JSONObject o = new JSONObject();
                o.put("version", version());
                o.put("code", BuildConfig.VERSION_CODE);
                o.put("channel", BuildConfig.CHANNEL);
                o.put("features", new JSONArray().put("reminders").put("widget").put("share").put("save"));
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        // What's waiting for the page: { open, share }, taken once.
        @JavascriptInterface
        public String take() {
            if (!ok()) return "{}";
            JSONObject o = new JSONObject();
            synchronized (MainActivity.class) {
                try {
                    if (pendingOpen != null) o.put("open", pendingOpen);
                    if (pendingShare != null) o.put("share", pendingShare);
                } catch (Exception ignored) {}
                pendingOpen = null;
                pendingShare = null;
            }
            return o.toString();
        }

        @JavascriptInterface
        public String reminders() {
            JSONObject r = Store.reminders(MainActivity.this);
            try { r.put("allowed", notifyAllowed()); } catch (Exception ignored) {}
            return r.toString();
        }

        // { morningOn, morning: "HH:MM", eveningOn, evening }. Asks for Android 13's notification permission the
        // first time one is turned on.
        @JavascriptInterface
        public String setReminders(String json) {
            if (!ok()) return reminders();
            try {
                JSONObject in = new JSONObject(json), r = Store.reminders(MainActivity.this);
                for (String k : new String[]{"morningOn", "eveningOn"}) if (in.has(k)) r.put(k, in.optBoolean(k));
                for (String k : new String[]{"morning", "evening"}) if (in.optString(k).matches("^([01]\\d|2[0-3]):[0-5]\\d$")) r.put(k, in.optString(k));
                Store.write(MainActivity.this, "reminders", r);
                Reminders.schedule(MainActivity.this);
                boolean any = r.optBoolean("morningOn") || r.optBoolean("eveningOn");
                if (any && Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    ui.post(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY));
            } catch (Exception ignored) {}
            return reminders();
        }

        // Today as the page sees it: { day, streak, left, done, n, next: { day, left, streak } }.
        @JavascriptInterface
        public void today(String json) {
            if (!ok()) return;
            try {
                JSONObject t = new JSONObject(json);
                Store.write(MainActivity.this, "today", t);
                if (t.optBoolean("done") || (t.optString("day").equals(Store.todayKey()) && t.optInt("left", -1) == 0)) Reminders.clear(MainActivity.this);
                TodayWidget.updateAll(MainActivity.this);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public boolean copy(String text) {
            if (!ok()) return false;
            ClipboardManager cm = getSystemService(ClipboardManager.class);
            if (cm == null) return false;
            cm.setPrimaryClip(ClipData.newPlainText("Bonsai", text));
            return true;
        }

        // A file the page made (a backup, a snip, a video) into Downloads/Bonsai.
        @JavascriptInterface
        public boolean save(String name, String mime, String b64) {
            if (!ok()) return false;
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                String safe = name.replaceAll("[\\\\/:*?\"<>|]+", " ").trim();
                if (safe.isEmpty()) safe = "Bonsai";
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    v.put(MediaStore.Downloads.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Bonsai");
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (u == null) return false;
                    try (OutputStream o = getContentResolver().openOutputStream(u)) { if (o == null) return false; o.write(data); }
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) return false;
                    try (FileOutputStream o = new FileOutputStream(new File(dir, safe))) { o.write(data); }
                }
                return true;
            } catch (Exception | OutOfMemoryError e) { return false; }
        }

        @JavascriptInterface
        public void open(String url) { if (ok()) ui.post(() -> out(url)); }
    }
}
