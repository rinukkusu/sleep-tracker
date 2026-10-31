package io.github.rinukkusu.sleeptracker;

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
            bySize.put(new SizeF(100f, 110f), build(ctx, s, Style.VERTICAL));
            bySize.put(new SizeF(180f, 40f), build(ctx, s, Style.WIDE));
            views = new RemoteViews(bySize);
        } else {
            views = build(ctx, s, Style.WIDE);
        }
        manager.updateAppWidget(ids, views);
    }

    private static RemoteViews build(Context ctx, SleepState s, Style style) {
        int layout = style == Style.COMPACT
            ? R.layout.widget_sleep_compact
            : style == Style.VERTICAL ? R.layout.widget_sleep_vertical : R.layout.widget_sleep;
        RemoteViews v = new RemoteViews(ctx.getPackageName(), layout);

        long since = s.isRunning() ? s.runningStart : s.lastWake;
        boolean night = "night".equals(s.runningKind);

        if (style == Style.COMPACT) {
            v.setTextViewText(R.id.widget_label, s.isRunning() ? (night ? "🌙" : "😴") : s.isPaused() ? "⏸" : "☀️");
            v.setInt(R.id.widget_root, "setBackgroundResource", s.isRunning() ? R.drawable.widget_compact_wake : R.drawable.widget_compact_sleep);
            // The whole 1x1 widget toggles.
            v.setOnClickPendingIntent(R.id.widget_root, SleepActionReceiver.pendingIntent(ctx, SleepActionReceiver.ACTION_TOGGLE));
        } else {
            boolean controls = s.isRunning() || s.isPaused();
            if (s.isRunning()) {
                v.setTextViewText(R.id.widget_label, night ? "🌙 Schläft" : "☀️ Nickerchen");
            } else if (s.isPaused()) {
                v.setTextViewText(R.id.widget_label, "⏸ Pause");
            } else {
                v.setTextViewText(R.id.widget_label, "Wach");
            }
            // Awake: one "Schläft" button. Asleep or paused: pause/resume and stop icons.
            v.setViewVisibility(R.id.widget_button, controls ? View.GONE : View.VISIBLE);
            v.setViewVisibility(R.id.widget_controls, controls ? View.VISIBLE : View.GONE);
            v.setImageViewResource(R.id.widget_pause, s.isPaused() ? R.drawable.ic_widget_play : R.drawable.ic_widget_pause);
            v.setContentDescription(R.id.widget_pause, s.isPaused() ? "Weiter schlafen" : "Pause");
            v.setTextViewText(R.id.widget_since, since > 0 ? "seit " + SleepState.time(since) : "noch keine Einträge");
            v.setOnClickPendingIntent(R.id.widget_button, SleepActionReceiver.pendingIntent(ctx, SleepActionReceiver.ACTION_TOGGLE));
            v.setOnClickPendingIntent(R.id.widget_pause, SleepActionReceiver.pendingIntent(ctx, s.isPaused() ? SleepActionReceiver.ACTION_RESUME : SleepActionReceiver.ACTION_PAUSE));
            v.setOnClickPendingIntent(R.id.widget_stop, SleepActionReceiver.pendingIntent(ctx, SleepActionReceiver.ACTION_STOP));
            v.setOnClickPendingIntent(R.id.widget_root, SleepNotifier.openApp(ctx));
        }

        if (since > 0) {
            long base = SystemClock.elapsedRealtime() - (System.currentTimeMillis() - since);
            v.setChronometer(R.id.widget_chrono, base, null, true);
            v.setViewVisibility(R.id.widget_chrono, View.VISIBLE);
        } else {
            v.setChronometer(R.id.widget_chrono, SystemClock.elapsedRealtime(), null, false);
            v.setViewVisibility(R.id.widget_chrono, style == Style.COMPACT ? View.INVISIBLE : View.GONE);
        }
        return v;
    }
}
