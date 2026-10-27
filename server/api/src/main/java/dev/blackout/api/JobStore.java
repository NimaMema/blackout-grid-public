package dev.blackout.api;
import dev.blackout.shared.*;
import java.util.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;
@Repository
public class JobStore {
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    public JobStore(JdbcTemplate db, TransactionTemplate tx) { this.db = db; this.tx = tx; }
    public record Accepted(String id, boolean duplicate) {}
    public Accepted submit(String key, String payload) {
        String id = UUID.randomUUID().toString();
        try {
            tx.executeWithoutResult(s -> {
                db.update("INSERT INTO jobs(id,idempotency_key,payload,created_at) VALUES(?,?,?,?)",
                        id, key, payload, System.currentTimeMillis());
                db.update("INSERT INTO outbox(job_id) VALUES(?)", id);
            });
            return new Accepted(id, false);
        } catch (DuplicateKeyException e) {
            String previous = db.queryForObject("SELECT id FROM jobs WHERE idempotency_key=?", String.class, key);
            return new Accepted(previous, true);
        }
    }
    public List<JobMessage> pending() {
        return db.query("SELECT j.id,j.created_at,j.payload FROM jobs j JOIN outbox o ON j.id=o.job_id WHERE o.published=FALSE ORDER BY j.created_at LIMIT 32",
                (r, n) -> new JobMessage(r.getString(1), r.getLong(2), r.getString(3)));
    }
    public void published(String id) { db.update("UPDATE outbox SET published=TRUE WHERE job_id=?", id); }
    public void attempted(String id) { db.update("UPDATE outbox SET attempts=attempts+1 WHERE job_id=?", id); }
    public boolean complete(JobResult r) {
        return db.update("UPDATE jobs SET completed_at=?,result=?,worker_id=?,processing_ms=? WHERE id=? AND completed_at IS NULL",
                System.currentTimeMillis(), r.result(), r.workerId(), r.processingMs(), r.id()) == 1;
    }
    public boolean exists(String id) { return db.queryForObject("SELECT COUNT(*) FROM jobs WHERE id=?", Long.class, id) > 0; }
    public long submitted() { return db.queryForObject("SELECT COUNT(*) FROM jobs", Long.class); }
    public long completed() { return db.queryForObject("SELECT COUNT(*) FROM jobs WHERE completed_at IS NOT NULL", Long.class); }
    public long pendingCount() { return db.queryForObject("SELECT COUNT(*) FROM outbox WHERE published=FALSE", Long.class); }
    public long p95() {
        List<Long> times = db.query("SELECT completed_at-created_at FROM jobs WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 100", (r,n)->r.getLong(1));
        times.sort(Long::compare);
        return times.isEmpty() ? 0 : times.get(Math.min(times.size()-1, (int)Math.ceil(times.size()*0.95)-1));
    }
    public List<Map<String,Object>> recent() {
        return db.query("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 40", (r,n) -> {
            Map<String,Object> j = new LinkedHashMap<>();
            long completed = r.getLong("completed_at");
            j.put("id", r.getString("id")); j.put("createdAt", r.getLong("created_at"));
            j.put("completedAt", completed == 0 ? null : completed);
            j.put("status", completed == 0 ? "QUEUED" : "COMPLETED");
            j.put("result", r.getString("result")); j.put("workerId", r.getString("worker_id"));
            j.put("processingMs", r.getLong("processing_ms"));
            j.put("latencyMs", completed == 0 ? 0 : completed-r.getLong("created_at"));
            return j;
        });
    }
}
