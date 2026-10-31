package io.github.rinukkusu.sleeptracker;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

/** Home screen widget: start/stop button plus a chronometer the launcher ticks itself. */
public class SleepWidget extends AppWidgetProvider {

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
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_sleep);

        long since = s.isRunning() ? s.runningStart : s.lastWake;
        boolean night = "night".equals(s.runningKind);
        if (s.isRunning()) {
            v.setTextViewText(R.id.widget_label, night ? "🌙 Schläft" : "☀️ Nickerchen");
            v.setTextViewText(R.id.widget_button, "Aufgewacht");
            v.setInt(R.id.widget_button, "setBackgroundResource", R.drawable.widget_button_wake);
        } else {
            v.setTextViewText(R.id.widget_label, "Wach");
            v.setTextViewText(R.id.widget_button, "Schläft");
            v.setInt(R.id.widget_button, "setBackgroundResource", R.drawable.widget_button_sleep);
        }

        if (since > 0) {
            long base = SystemClock.elapsedRealtime() - (System.currentTimeMillis() - since);
            v.setChronometer(R.id.widget_chrono, base, null, true);
            v.setViewVisibility(R.id.widget_chrono, View.VISIBLE);
            v.setTextViewText(R.id.widget_since, "seit " + SleepState.time(since));
        } else {
            v.setChronometer(R.id.widget_chrono, SystemClock.elapsedRealtime(), null, false);
            v.setViewVisibility(R.id.widget_chrono, View.GONE);
            v.setTextViewText(R.id.widget_since, "noch keine Einträge");
        }

        v.setOnClickPendingIntent(R.id.widget_button, SleepActionReceiver.pendingIntent(ctx, SleepActionReceiver.ACTION_TOGGLE));
        v.setOnClickPendingIntent(R.id.widget_root, SleepNotifier.openApp(ctx));
        manager.updateAppWidget(ids, v);
    }
}
