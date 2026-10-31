package io.github.rinukkusu.sleeptracker;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Handles the widget button and the "Aufgewacht" notification action. */
public class SleepActionReceiver extends BroadcastReceiver {
    static final String ACTION_TOGGLE = "io.github.rinukkusu.sleeptracker.TOGGLE";
    static final String ACTION_STOP = "io.github.rinukkusu.sleeptracker.STOP";

    static PendingIntent pendingIntent(Context ctx, String action) {
        Intent i = new Intent(ctx, SleepActionReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(ctx, action.hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        // Keep the receiver alive while the change is synced to PocketBase.
        PendingResult result = goAsync();
        Runnable done = result::finish;
        if (ACTION_STOP.equals(intent.getAction())) SleepState.stop(ctx, done);
        else if (ACTION_TOGGLE.equals(intent.getAction())) SleepState.toggle(ctx, done);
        else done.run();
    }
}
