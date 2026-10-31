package io.github.rinukkusu.sleeptracker;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.os.SystemClock;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import java.util.HashMap;
import java.util.Map;

/**
 * Home screen widget: start/stop button plus a chronometer the launcher ticks itself.
 * On Android 12+ the launcher picks the layout by size: compact 1x1, vertical, or wide.
 */
public class SleepWidget extends AppWidgetProvider {

    private enum Style { WIDE, VERTICAL, COMPACT }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager manager, int[] ids) {
        render(ctx, manager, ids);
    }

    static void updateAll(Context ctx) {
        AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
        render(ctx, manager, manager.getAppWidgetIds(new ComponentName(ctx, SleepWidget.class)));
    }

    private static void render(Context ctx, AppWidgetManager manager, int[] ids) {
        if (ids.length == 0) return;
        SleepState s = SleepState.load(ctx);

        RemoteViews views;
        if (Build.VERSION.SDK_INT >= 31) {
            // Smallest size each layout applies from (in dp).
            Map<SizeF, RemoteViews> bySize = new HashMap<>();
            bySize.put(new SizeF(40f, 40f), build(ctx, s, Style.COMPACT));
            bySize.put(new SizeF(100f, 160f), build(ctx, s, Style.VERTICAL));
            bySize.put(new SizeF(180f, 40f), build(ctx, s, Style.WIDE));
            views = new RemoteViews(bySize);
        } else {
            views = build(ctx, s, Style.WIDE);
        }
        manager.updateAppWidget(ids, views);
        scheduleTick(ctx, s);
    }

    /**
     * Awake shows whole minutes ("15 Min."), so the widget is redrawn once a
     * minute. Not a wakeup alarm: with the screen off nobody looks anyway.
     */
    private static void scheduleTick(Context ctx, SleepState s) {
        AlarmManager alarms = ctx.getSystemService(AlarmManager.class);
        PendingIntent tick = SleepActionReceiver.pendingIntent(ctx, SleepActionReceiver.ACTION_TICK);
        if (s.isRunning() || s.lastWake <= 0) {
            alarms.cancel(tick);
            return;
        }
        long now = System.currentTimeMillis();
        long next = now + 60_000 - ((now - s.lastWake) % 60_000);
        alarms.setWindow(AlarmManager.RTC, next, 5_000, tick);
    }

    /** "15 Min." or "1:05 Std." */
    static String ago(long ms) {
        long m = Math.max(0, ms / 60_000);
        return m < 60 ? m + " Min." : String.format(java.util.Locale.GERMANY, "%d:%02d Std.", m / 60, m % 60);
    }

    private static RemoteViews build(Context ctx, SleepState s, Style style) {
        int layout = style == Style.COMPACT
            ? R.layout.widget_sleep_compact
            : style == Style.VERTICAL ? R.layout.widget_sleep_vertical : R.layout.widget_sleep;
        RemoteViews v = new RemoteViews(ctx.getPackageName(), layout);

        long now = System.currentTimeMillis();
        long pausedSince = s.pausedSince();
        boolean paused = pausedSince > 0;
        boolean night = "night".equals(s.runningKind);

        if (style == Style.COMPACT) {
            v.setTextViewText(R.id.widget_label, paused ? "⏸" : s.isRunning() ? (night ? "🌙" : "😴") : "☀️");
            v.setInt(R.id.widget_root, "setBackgroundResource", s.isRunning() ? R.drawable.widget_compact_wake : R.drawable.widget_compact_sleep);
            // The whole 1x1 widget toggles (during a pause: back to sleep).
            v.setOnClickPendingIntent(R.id.widget_root, SleepActionReceiver.pendingIntent(ctx, SleepActionReceiver.ACTION_TOGGLE));
        } else {
            String since;
            if (paused) {
                v.setTextViewText(R.id.widget_label, "⏸ Kurz wach");
                since = "wach seit " + SleepState.time(pausedSince);
            } else if (s.isRunning()) {
                v.setTextViewText(R.id.widget_label, night ? "🌙 Schläft" : "☀️ Nickerchen");
                since = "seit " + SleepState.time(s.runningStart);
            } else {
                v.setTextViewText(R.id.widget_label, s.lastWake > 0 ? "Schlaf vor" : "Wach");
                since = s.lastWake > 0 ? null : "noch keine Einträge";
            }
            v.setTextViewText(R.id.widget_since, since);
            v.setViewVisibility(R.id.widget_since, since != null ? View.VISIBLE : View.GONE);
            // Awake: round moon button to start. Asleep: pause/resume and stop icons.
            v.setViewVisibility(R.id.widget_moon, s.isRunning() ? View.GONE : View.VISIBLE);
            v.setViewVisibility(R.id.widget_controls, s.isRunning() ? View.VISIBLE : View.GONE);
            v.setImageViewResource(R.id.widget_pause, paused ? R.drawable.ic_widget_play : R.drawable.ic_widget_pause);
            v.setContentDescription(R.id.widget_pause, paused ? "Schläft weiter" : "Kurz wach");
            v.setOnClickPendingIntent(R.id.widget_moon, SleepActionReceiver.pendingIntent(ctx, SleepActionReceiver.ACTION_START));
            v.setOnClickPendingIntent(R.id.widget_pause, SleepActionReceiver.pendingIntent(ctx, paused ? SleepActionReceiver.ACTION_RESUME : SleepActionReceiver.ACTION_PAUSE));
            v.setOnClickPendingIntent(R.id.widget_stop, SleepActionReceiver.pendingIntent(ctx, SleepActionReceiver.ACTION_STOP));
            v.setOnClickPendingIntent(R.id.widget_root, SleepNotifier.openApp(ctx));
        }

        // Asleep: ticking time slept without pauses, frozen during a pause.
        // Awake: minutes since the last sleep ended.
        v.setViewVisibility(R.id.widget_ago, View.GONE);
        if (s.isRunning()) {
            v.setChronometer(R.id.widget_chrono, SystemClock.elapsedRealtime() - s.sleptMs(now), null, !paused);
            v.setViewVisibility(R.id.widget_chrono, View.VISIBLE);
        } else if (s.lastWake > 0) {
            v.setChronometer(R.id.widget_chrono, SystemClock.elapsedRealtime(), null, false);
            v.setViewVisibility(R.id.widget_chrono, View.GONE);
            v.setTextViewText(R.id.widget_ago, ago(now - s.lastWake));
            v.setViewVisibility(R.id.widget_ago, View.VISIBLE);
        } else {
            v.setChronometer(R.id.widget_chrono, SystemClock.elapsedRealtime(), null, false);
            v.setViewVisibility(R.id.widget_chrono, style == Style.COMPACT ? View.INVISIBLE : View.GONE);
        }
        return v;
    }
}
