package io.github.rinukkusu.sleeptracker;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.ref.WeakReference;
import org.json.JSONArray;

/** Bridge between the web app (src/lib/native.ts) and the native notification/widget. */
@CapacitorPlugin(
    name = "Sleep",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
)
public class SleepPlugin extends Plugin {
    private static WeakReference<SleepPlugin> instance = new WeakReference<>(null);

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
        call.resolve(ret);
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
