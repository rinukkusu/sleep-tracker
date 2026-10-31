package io.github.rinukkusu.sleeptracker;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Native copy of the current sleep state, shared by notification, widget and
 * the action receiver. The web app pushes its state here; widget/notification
 * actions change it locally, sync to PocketBase directly and also queue the
 * change so the web app can apply it the next time it runs (upserts by id, so
 * applying twice is harmless).
 */
final class SleepState {
    private static final String TAG = "SleepState";
    private static final String PREFS = "sleep_state";
    private static final MediaType JSON = MediaType.get("application/json");
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final OkHttpClient http = new OkHttpClient();

    String runningId;
    long runningStart;
    String runningKind;
    long lastWake;
    /** Short wake-ups of the running sleep: [{start, end}] as ISO strings, end null while awake. */
    JSONArray runningPauses = new JSONArray();

    boolean isRunning() {
        return runningId != null;
    }

    /** Start of the pause still going on, 0 if she is asleep. */
    long pausedSince() {
        if (!isRunning()) return 0;
        for (int i = 0; i < runningPauses.length(); i++) {
            JSONObject p = runningPauses.optJSONObject(i);
            if (p != null && p.isNull("end")) return parseIso(p.optString("start"));
        }
        return 0;
    }

    boolean isPaused() {
        return pausedSince() > 0;
    }

    /** Time asleep so far, without pauses. */
    long sleptMs(long now) {
        long ms = now - runningStart;
        for (int i = 0; i < runningPauses.length(); i++) {
            JSONObject p = runningPauses.optJSONObject(i);
            if (p == null) continue;
            long end = p.isNull("end") ? now : parseIso(p.optString("end"));
            ms -= end - parseIso(p.optString("start"));
        }
        return Math.max(0, ms);
    }

    static SleepState load(Context ctx) {
        SharedPreferences p = prefs(ctx);
        SleepState s = new SleepState();
        s.runningId = p.getString("running_id", null);
        s.runningStart = p.getLong("running_start", 0);
        s.runningKind = p.getString("running_kind", "nap");
        s.lastWake = p.getLong("last_wake", 0);
        try {
            s.runningPauses = new JSONArray(p.getString("running_pauses", "[]"));
        } catch (JSONException ignored) {
            // keep empty
        }
        return s;
    }

    void save(Context ctx) {
        prefs(ctx)
            .edit()
            .putString("running_id", runningId)
            .putLong("running_start", runningStart)
            .putString("running_kind", runningKind)
            .putLong("last_wake", lastWake)
            .putString("running_pauses", runningPauses.toString())
            .apply();
    }

    static void setAuth(Context ctx, String baseUrl, String token) {
        prefs(ctx).edit().putString("base_url", baseUrl).putString("token", token).apply();
    }

    /** Start from widget: kind defaults by time of day like in the web app. */
    static synchronized void start(Context ctx, Runnable done) {
        SleepState s = load(ctx);
        if (s.isRunning()) {
            done.run();
            return;
        }
        s.runningId = newId();
        s.runningStart = System.currentTimeMillis();
        s.runningKind = defaultKind();
        s.runningPauses = new JSONArray();
        s.save(ctx);
        enqueue(ctx, s.runningRecord(0));
        afterChange(ctx, done);
    }

    /** Stopping during a pause means she stayed awake: the sleep ends where the pause began. */
    static synchronized void stop(Context ctx, Runnable done) {
        SleepState s = load(ctx);
        if (!s.isRunning()) {
            done.run();
            return;
        }
        long pausedSince = s.pausedSince();
        long end = pausedSince > 0 ? pausedSince : Math.max(System.currentTimeMillis(), s.runningStart);
        JSONArray pauses = new JSONArray();
        for (int i = 0; i < s.runningPauses.length(); i++) {
            JSONObject p = s.runningPauses.optJSONObject(i);
            if (p != null && !p.isNull("end")) pauses.put(p);
        }
        s.runningPauses = pauses;
        enqueue(ctx, s.runningRecord(end));
        s.runningId = null;
        s.runningPauses = new JSONArray();
        s.lastWake = end;
        s.save(ctx);
        afterChange(ctx, done);
    }

    /** Briefly awake: stays part of the same sleep. */
    static synchronized void pause(Context ctx, Runnable done) {
        SleepState s = load(ctx);
        if (!s.isRunning() || s.isPaused()) {
            done.run();
            return;
        }
        try {
            s.runningPauses.put(new JSONObject().put("start", iso(System.currentTimeMillis())).put("end", JSONObject.NULL));
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
        s.save(ctx);
        enqueue(ctx, s.runningRecord(0));
        afterChange(ctx, done);
    }

    static synchronized void resume(Context ctx, Runnable done) {
        SleepState s = load(ctx);
        long pausedSince = s.pausedSince();
        if (pausedSince == 0) {
            done.run();
            return;
        }
        for (int i = 0; i < s.runningPauses.length(); i++) {
            JSONObject p = s.runningPauses.optJSONObject(i);
            if (p == null || !p.isNull("end")) continue;
            try {
                p.put("end", iso(Math.max(System.currentTimeMillis(), pausedSince)));
            } catch (JSONException e) {
                throw new IllegalStateException(e);
            }
        }
        s.save(ctx);
        enqueue(ctx, s.runningRecord(0));
        afterChange(ctx, done);
    }

    /** Widget 1x1: asleep -> stop, paused -> resume, awake -> start. */
    static void toggle(Context ctx, Runnable done) {
        SleepState s = load(ctx);
        if (s.isPaused()) resume(ctx, done);
        else if (s.isRunning()) stop(ctx, done);
        else start(ctx, done);
    }

    /** Returns and clears queued changes for the web app. */
    static synchronized JSONArray takePending(Context ctx) {
        JSONArray pending = loadPending(ctx);
        prefs(ctx).edit().remove("pending").apply();
        return pending;
    }

    static void refreshUi(Context ctx) {
        SleepNotifier.update(ctx);
        SleepWidget.updateAll(ctx);
    }

    private static void afterChange(Context ctx, Runnable done) {
        refreshUi(ctx);
        SleepPlugin.notifyPendingActions();
        executor.execute(() -> {
            try {
                // Offline: retry as soon as there is a network, even with the app closed.
                if (!syncPending(ctx)) SyncJob.schedule(ctx);
            } finally {
                done.run();
            }
        });
    }

    /** Uploads queued changes. Returns false if some are still left (offline, server down). */
    static boolean syncPending(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String baseUrl = p.getString("base_url", null);
        String token = p.getString("token", null);
        if (baseUrl == null || token == null) return true; // the app syncs once logged in

        JSONArray pending;
        synchronized (SleepState.class) {
            pending = loadPending(ctx);
        }
        for (int i = 0; i < pending.length(); i++) {
            JSONObject rec = pending.optJSONObject(i);
            if (rec == null) continue;
            try {
                upsert(baseUrl, token, rec);
                removePending(ctx, rec.getString("id"));
            } catch (Exception e) {
                Log.w(TAG, "sync failed, will retry", e);
                return false;
            }
        }
        return true;
    }

    private static void upsert(String baseUrl, String token, JSONObject rec) throws Exception {
        String url = baseUrl + "/api/collections/sleeps/records/";
        JSONObject body = new JSONObject()
            .put("start_at", rec.getString("start"))
            .put("end_at", rec.isNull("end") ? "" : rec.getString("end"))
            .put("kind", rec.getString("kind"))
            .put("pauses", rec.optJSONArray("pauses") != null ? rec.getJSONArray("pauses") : new JSONArray());

        Request update = new Request.Builder()
            .url(url + rec.getString("id"))
            .header("Authorization", token)
            .patch(RequestBody.create(body.toString(), JSON))
            .build();
        try (Response res = http.newCall(update).execute()) {
            if (res.isSuccessful()) return;
            if (res.code() != 404) throw new IllegalStateException("update " + res.code());
        }

        body.put("id", rec.getString("id"));
        Request create = new Request.Builder()
            .url(url)
            .header("Authorization", token)
            .post(RequestBody.create(body.toString(), JSON))
            .build();
        try (Response res = http.newCall(create).execute()) {
            if (!res.isSuccessful()) throw new IllegalStateException("create " + res.code());
        }
    }

    private JSONObject runningRecord(long end) {
        try {
            return new JSONObject()
                .put("id", runningId)
                .put("start", iso(runningStart))
                .put("end", end > 0 ? iso(end) : JSONObject.NULL)
                .put("kind", runningKind)
                .put("pauses", new JSONArray(runningPauses.toString()));
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void enqueue(Context ctx, JSONObject rec) {
        JSONArray pending = loadPending(ctx);
        JSONArray next = new JSONArray();
        for (int i = 0; i < pending.length(); i++) {
            JSONObject o = pending.optJSONObject(i);
            if (o != null && !rec.optString("id").equals(o.optString("id"))) next.put(o);
        }
        next.put(rec);
        prefs(ctx).edit().putString("pending", next.toString()).apply();
    }

    private static synchronized void removePending(Context ctx, String id) {
        JSONArray pending = loadPending(ctx);
        JSONArray next = new JSONArray();
        for (int i = 0; i < pending.length(); i++) {
            JSONObject o = pending.optJSONObject(i);
            if (o != null && !id.equals(o.optString("id"))) next.put(o);
        }
        prefs(ctx).edit().putString("pending", next.toString()).apply();
    }

    private static JSONArray loadPending(Context ctx) {
        try {
            return new JSONArray(prefs(ctx).getString("pending", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String iso(long ms) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date(ms));
    }

    static long parseIso(String v) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        try {
            Date d = f.parse(v);
            return d != null ? d.getTime() : 0;
        } catch (java.text.ParseException e) {
            return 0;
        }
    }

    static String time(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.GERMANY).format(new Date(ms));
    }

    private static String defaultKind() {
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        return h >= 18 || h < 6 ? "night" : "nap";
    }

    /** PocketBase-compatible id: 15 chars of [a-z0-9]. */
    private static String newId() {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom rnd = new SecureRandom();
        StringBuilder sb = new StringBuilder(15);
        for (int i = 0; i < 15; i++) sb.append(chars.charAt(rnd.nextInt(chars.length())));
        return sb.toString();
    }
}
