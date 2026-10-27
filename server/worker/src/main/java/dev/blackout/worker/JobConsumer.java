package dev.blackout.worker;
import com.rabbitmq.client.Channel;
import dev.blackout.shared.*;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
@Component
public class JobConsumer {
    private final RestClient api;
    private final AtomicInteger active=new AtomicInteger();
    private final String workerId="worker-"+UUID.randomUUID().toString().substring(0,8);
    private volatile WorkerConfig config=new WorkerConfig(false,260,2);
    public JobConsumer(@Value("${blackout.api-url}") String url,@Value("${blackout.internal-token}") String token) {
        var factory=new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
        factory.setReadTimeout(Duration.ofSeconds(5));
        api=RestClient.builder().baseUrl(url).requestFactory(factory).defaultHeader("X-Internal-Token",token).build();
    }
    public WorkerConfig config() { return config; }
    public void config(WorkerConfig next) { config=next; }
    public int active() { return active.get(); }
    public String workerId() { return workerId; }
    @RabbitListener(id="jobs",queues=QueueConfig.JOBS)
    public void receive(JobMessage job, Channel channel,@Header(AmqpHeaders.DELIVERY_TAG) long tag) throws Exception {
        active.incrementAndGet();
        try {
            long begin=System.nanoTime();
            String result=Work.digest(job.payload());
            Thread.sleep(config.delayMs());
            long elapsed=(System.nanoTime()-begin)/1_000_000;
            api.post().uri("/internal/complete").body(new JobResult(job.id(),result,workerId,elapsed)).retrieve().toBodilessEntity();
            channel.basicAck(tag,false);
        } catch(Exception e) {
            Thread.sleep(1000);
            channel.basicNack(tag,false,true);
        } finally { active.decrementAndGet(); }
    }
}
