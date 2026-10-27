package dev.blackout.api;
import dev.blackout.shared.QueueConfig;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.concurrent.TimeUnit;
@Component
public class OutboxPublisher {
    private final JobStore store;
    private final RabbitTemplate rabbit;
    private final Activity activity;
    private volatile boolean healthy;
    public OutboxPublisher(JobStore store, RabbitTemplate rabbit, Activity activity) {
        this.store=store; this.rabbit=rabbit; this.activity=activity;
    }
    public boolean healthy() { return healthy; }
    @Scheduled(fixedDelay = 1500, initialDelay = 1000)
    public void probe() {
        try {
            rabbit.execute(channel -> channel.queueDeclarePassive(QueueConfig.JOBS).getMessageCount());
            if (!healthy) activity.add("recovered", "RabbitMQ connection established", null);
            healthy = true;
        } catch (Exception e) {
            if (healthy) activity.add("outage", "RabbitMQ unavailable; pending work remains durable", null);
            healthy = false;
        }
    }
    @Scheduled(fixedDelay = 150)
    public void flush() {
        for (var job : store.pending()) {
            try {
                var confirmation = new CorrelationData(job.id());
                rabbit.convertAndSend("", QueueConfig.JOBS, job, confirmation);
                var result = confirmation.getFuture().get(2, TimeUnit.SECONDS);
                if (!result.isAck() || confirmation.getReturned() != null) throw new IllegalStateException("Publish not routed.");
                store.published(job.id());
                if (!healthy) activity.add("recovered", "RabbitMQ connection established", null);
                healthy = true;
            } catch (Exception e) {
                store.attempted(job.id());
                if (healthy) activity.add("outage", "RabbitMQ unavailable; jobs retained in outbox", null);
                healthy = false;
                if (e instanceof InterruptedException) Thread.currentThread().interrupt();
                break;
            }
        }
    }
}
