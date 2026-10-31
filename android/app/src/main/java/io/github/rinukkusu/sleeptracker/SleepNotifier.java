package io.github.rinukkusu.sleeptracker;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/** Ongoing "schläft" notification with a native chronometer that ticks by itself. */
final class SleepNotifier {
    private static final String CHANNEL = "sleep_running";
    private static final int ID = 1;

    static void update(Context ctx) {
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        SleepState s = SleepState.load(ctx);
        if (!s.isRunning()) {
            nm.cancel(ID);
            return;
        }
        if (!nm.areNotificationsEnabled()) return;
        ensureChannel(ctx);

        boolean night = "night".equals(s.runningKind);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_moon)
            .setColor(0xFF6F7DFF)
            .setContentTitle(night ? "🌙 Schläft" : "☀️ Schläft")
            .setContentText((night ? "Nachtschlaf" : "Nickerchen") + " seit " + SleepState.time(s.runningStart))
            .setWhen(s.runningStart)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openApp(ctx))
            .addAction(0, "Aufgewacht", SleepActionReceiver.pendingIntent(ctx, SleepActionReceiver.ACTION_STOP));
        if (Build.VERSION.SDK_INT >= 36) {
            // Android 16 "Live Update": shows the running time as a chip in the status bar.
            Bundle extras = new Bundle();
            // Notification.EXTRA_REQUEST_PROMOTED_ONGOING, not in the compile SDK yet.
            extras.putBoolean("android.requestPromotedOngoing", true);
            b.addExtras(extras);
        }
        try {
            nm.notify(ID, b.build());
        } catch (SecurityException ignored) {
            // notification permission revoked in the meantime
        }
    }

    static PendingIntent openApp(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Laufender Schlaf", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Stoppuhr, solange sie schläft");
        ch.setShowBadge(false);
        ctx.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }
}
