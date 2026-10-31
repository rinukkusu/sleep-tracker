package io.github.rinukkusu.sleeptracker;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Uploads widget/notification changes made offline once there is a network again. */
public class SyncJob extends JobService {
    private static final int ID = 1;
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    static void schedule(Context ctx) {
        JobInfo job = new JobInfo.Builder(ID, new ComponentName(ctx, SyncJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setBackoffCriteria(30_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
            .setPersisted(false)
            .build();
        ctx.getSystemService(JobScheduler.class).schedule(job);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        executor.execute(() -> jobFinished(params, !SleepState.syncPending(this)));
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true; // retry later
    }
}
