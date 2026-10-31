package io.github.rinukkusu.sleeptracker;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.json.JSONArray;

/** Bridge between the web app (src/lib/native.ts) and the native notification/widget. */
@CapacitorPlugin(
    name = "Sleep",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
)
public class SleepPlugin extends Plugin {
    private static WeakReference<SleepPlugin> instance = new WeakReference<>(null);
    private final ExecutorService downloads = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        instance = new WeakReference<>(this);
    }

    /** Tells a running web app that the widget/notification changed something. */
    static void notifyPendingActions() {
        SleepPlugin p = instance.get();
        if (p != null) p.notifyListeners("pendingActions", new JSObject());
    }

    /** Which native build this is, for over-the-air updates of the web part. */
    @PluginMethod
    public void info(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("nativeId", BuildConfig.NATIVE_ID);
        ret.put("build", BuildConfig.VERSION_CODE);
        ret.put("version", BuildConfig.VERSION_NAME);
        call.resolve(ret);
    }

    /**
     * Downloads a new APK and hands it to the system installer. The first time,
     * Android asks to allow installing apps from this app instead.
     */
    @PluginMethod
    public void installApk(PluginCall call) {
        Context ctx = getContext();
        String url = call.getString("url");
        if (url == null) {
            call.reject("url missing");
            return;
        }
        if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            getActivity().startActivity(settings);
            JSObject ret = new JSObject();
            ret.put("status", "permission");
            call.resolve(ret);
            return;
        }
        downloads.execute(() -> {
            File apk = new File(ctx.getCacheDir(), "update.apk");
            try (Response res = new OkHttpClient().newCall(new Request.Builder().url(url).build()).execute()) {
                if (!res.isSuccessful() || res.body() == null) throw new IllegalStateException("download " + res.code());
                long total = res.body().contentLength();
                try (InputStream in = res.body().byteStream(); OutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[64 * 1024];
                    long done = 0;
                    int lastPercent = -1;
                    for (int n; (n = in.read(buf)) != -1; ) {
                        out.write(buf, 0, n);
                        done += n;
                        int percent = total > 0 ? (int) (done * 100 / total) : -1;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            notifyListeners("apkProgress", progress);
                        }
                    }
                }
            } catch (Exception e) {
                call.reject("Download fehlgeschlagen", e);
                return;
            }
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
            Intent install = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(install);
            JSObject ret = new JSObject();
            ret.put("status", "installing");
            call.resolve(ret);
        });
    }

    /** FCM token of this device, registered by the web app as a push subscription. */
    @PluginMethod
    public void fcmToken(PluginCall call) {
        com.google.firebase.messaging.FirebaseMessaging messaging;
        try {
            messaging = com.google.firebase.messaging.FirebaseMessaging.getInstance();
        } catch (IllegalStateException e) {
            call.reject("Firebase not configured (built without google-services.json)", e);
            return;
        }
        messaging
            .getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    call.reject("no FCM token", task.getException());
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("token", task.getResult());
                call.resolve(ret);
            });
    }

    @PluginMethod
    public void setAuth(PluginCall call) {
        SleepState.setAuth(getContext(), call.getString("baseUrl"), call.getString("token"));
        call.resolve();
    }

    /** The web app is the source of truth while it runs. */
    @PluginMethod
    public void setState(PluginCall call) {
        SleepState s = SleepState.load(getContext());
        JSObject running = call.getObject("running", null);
        if (running != null) {
            s.runningId = running.getString("id");
            s.runningStart = running.optLong("start");
            s.runningKind = running.getString("kind", "nap");
            JSONArray pauses = running.optJSONArray("pauses");
            s.runningPauses = pauses != null ? pauses : new JSONArray();
        } else {
            s.runningId = null;
            s.runningPauses = new JSONArray();
        }
        Long lastWake = call.getLong("lastWake");
        s.lastWake = lastWake != null ? lastWake : 0;
        s.save(getContext());
        SleepState.refreshUi(getContext());
        call.resolve();
    }

    @PluginMethod
    public void takePendingActions(PluginCall call) {
        JSONArray actions = SleepState.takePending(getContext());
        JSObject ret = new JSObject();
        ret.put("actions", actions);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            resolvePermission(call);
        } else {
            requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
        }
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        resolvePermission(call);
    }

    private void resolvePermission(PluginCall call) {
        SleepNotifier.update(getContext());
        JSObject ret = new JSObject();
        ret.put("granted", Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    /** Pulls the app back over the login Custom Tab once OAuth is done. */
    @PluginMethod
    public void bringToFront(PluginCall call) {
        Intent i = new Intent(getContext(), MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
