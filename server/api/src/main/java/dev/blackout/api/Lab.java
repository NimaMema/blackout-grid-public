package dev.blackout.api;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
@Service
public class Lab {
    private final JobStore store;
    private final WorkerClient worker;
    private final OutboxPublisher publisher;
    private final Activity activity;
    private volatile Control control = Control.initial();
    private volatile Map<String,Object> workerState = Map.of("online", false);
    private final AtomicLong attempts = new AtomicLong(), rejected = new AtomicLong();
    private final Deque<Map<String,Number>> samples = new ArrayDeque<>();
    private final long started = System.currentTimeMillis();
    private long lastSubmitted, lastCompleted;
    private double credits;
    private int sequence;
    public Lab(JobStore store, WorkerClient worker, OutboxPublisher publisher, Activity activity) {
        this.store=store; this.worker=worker; this.publisher=publisher; this.activity=activity;
        activity.add("system","Infrastructure lab initialized",null);
        lastSubmitted=store.submitted(); lastCompleted=store.completed();
    }
    public JobStore.Accepted submit(String key, String payload) {
        attempts.incrementAndGet();
        if (control.gatewayDown() || store.submitted()-store.completed() >= 10000) {
            rejected.incrementAndGet();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Gateway unavailable or queue limit reached.");
        }
        var result = store.submit(key,payload);
        if (!result.duplicate()) activity.add("accepted","Request accepted → durable outbox",result.id());
        return result;
    }
    public synchronized Control configure(Control next) {
        worker.configure(next);
        workerState=worker.state();
        Control previous=control; control=next;
        if (next.paused()!=previous.paused()) activity.add(next.paused()?"outage":"recovered",
                next.paused()?"Worker consumers stopped; queue is accumulating":"Workers resumed; draining queued jobs",null);
        if (next.gatewayDown()!=previous.gatewayDown()) activity.add(next.gatewayDown()?"outage":"recovered",
                next.gatewayDown()?"API gateway now rejects job submissions":"API gateway is accepting requests",null);
        if (next.rate()!=previous.rate()) activity.add("control","Traffic set to "+next.rate()+" requests/sec",null);
        if (next.delayMs()!=previous.delayMs()) activity.add("control","Worker delay set to "+next.delayMs()+"ms",null);
        if (next.workers()!=previous.workers()) activity.add("control","Worker concurrency set to "+next.workers(),null);
        return control;
    }
    @Scheduled(fixedRate=100)
    public synchronized void traffic() {
        credits=Math.min(credits+control.rate()/10.0,3);
        while(credits>=1) {
            credits-=1;
            try { submit(UUID.randomUUID().toString(),"Render city block "+sequence++); }
            catch(ResponseStatusException ignored) { }
        }
    }
    @Scheduled(fixedDelay=1000, initialDelay=1000)
    public void pollWorker() {
        Control observed=control;
        try {
            var fetched=worker.state();
            synchronized(this) {
                workerState=fetched;
                if(control==observed && fetched.get("config") instanceof Map<?,?> c) {
                    control=new Control(control.rate(),Boolean.TRUE.equals(c.get("paused")),
                            ((Number)c.get("delayMs")).intValue(),((Number)c.get("workers")).intValue(),control.gatewayDown());
                }
            }
        }
        catch(Exception e) { workerState=Map.of("online",false); }
    }
    @Scheduled(fixedRate=1000)
    public synchronized void sample() {
        long submitted=store.submitted(), completed=store.completed();
        samples.addLast(Map.of("rps",Math.max(0,submitted-lastSubmitted),"cps",Math.max(0,completed-lastCompleted),
                "queue",submitted-completed,"latency",store.p95(),"success",success()));
        lastSubmitted=submitted; lastCompleted=completed;
        while(samples.size()>60) samples.removeFirst();
    }
    private double success() { return attempts.get()==0?100:100.0*(attempts.get()-rejected.get())/attempts.get(); }
    public synchronized Map<String,Object> snapshot() {
        long submitted=store.submitted(),completed=store.completed();
        var last=samples.isEmpty()?Map.<String,Number>of("rps",0,"cps",0):samples.getLast();
        boolean online=Boolean.TRUE.equals(workerState.get("online"));
        var services=Map.of("gateway",control.gatewayDown()?"offline":"online",
                "queue",publisher.healthy()?"online":"offline",
                "workers",!online?"offline":control.paused()?"offline":control.delayMs()>800?"degraded":"online",
                "database","online");
        var metrics=Map.of("submitted",submitted,"completed",completed,"backlog",submitted-completed,
                "requestsPerSecond",last.get("rps"),"completionsPerSecond",last.get("cps"),
                "p95LatencyMs",store.p95(),"successRate",success(),
                "activeWorkers",online?workerState.getOrDefault("active",0):0,"outbox",store.pendingCount());
        return Map.of("product","BLACKOUT","mode","live","generatedAt",System.currentTimeMillis(),
                "uptimeSec",(System.currentTimeMillis()-started)/1000,"control",control,
                "services",services,"metrics",metrics,"series",List.copyOf(samples),
                "events",activity.recent(),"jobs",store.recent());
    }
}
