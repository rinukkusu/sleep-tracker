package io.github.rinukkusu.sleeptracker;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Handles the widget button and the "Aufgewacht" notification action. */
public class SleepActionReceiver extends BroadcastReceiver {
    static final String ACTION_TOGGLE = "io.github.rinukkusu.sleeptracker.TOGGLE";
    static final String ACTION_STOP = "io.github.rinukkusu.sleeptracker.STOP";
    static final String ACTION_START = "io.github.rinukkusu.sleeptracker.START";
    static final String ACTION_PAUSE = "io.github.rinukkusu.sleeptracker.PAUSE";
    static final String ACTION_RESUME = "io.github.rinukkusu.sleeptracker.RESUME";
    /** Per-minute widget redraw while awake. */
    static final String ACTION_TICK = "io.github.rinukkusu.sleeptracker.TICK";

    static PendingIntent pendingIntent(Context ctx, String action) {
        Intent i = new Intent(ctx, SleepActionReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(ctx, action.hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        // Keep the receiver alive while the change is synced to PocketBase.
        PendingResult result = goAsync();
        Runnable done = result::finish;
        String action = intent.getAction();
        if (ACTION_TICK.equals(action)) {
            SleepWidget.updateAll(ctx);
            done.run();
            return;
        }
        if (ACTION_START.equals(action)) SleepState.start(ctx, done);
        else if (ACTION_STOP.equals(action)) SleepState.stop(ctx, done);
        else if (ACTION_PAUSE.equals(action)) SleepState.pause(ctx, done);
        else if (ACTION_RESUME.equals(action)) SleepState.resume(ctx, done);
        else if (ACTION_TOGGLE.equals(action)) SleepState.toggle(ctx, done);
        else done.run();
    }
}
