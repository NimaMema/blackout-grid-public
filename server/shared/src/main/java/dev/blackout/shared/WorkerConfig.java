package dev.blackout.shared;
public record WorkerConfig(boolean paused, int delayMs, int workers) {
    public WorkerConfig {
        if (delayMs < 120 || delayMs > 3000 || workers < 1 || workers > 6)
            throw new IllegalArgumentException("Delay must be 120–3000ms; workers must be 1–6.");
    }
}
