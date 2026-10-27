package dev.blackout.worker;
import dev.blackout.shared.WorkerConfig;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.amqp.rabbit.listener.SimpleMessageListenerContainer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
public class WorkerController {
    private final JobConsumer consumer;
    private final RabbitListenerEndpointRegistry registry;
    private final String token;
    public WorkerController(JobConsumer consumer,RabbitListenerEndpointRegistry registry,@Value("${blackout.internal-token}") String token) {
        this.consumer=consumer; this.registry=registry; this.token=token;
    }
    private void auth(String supplied) {
        if(!MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8),supplied.getBytes(StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    @GetMapping("/internal/state")
    Map<String,Object> state(@RequestHeader(value="X-Internal-Token",defaultValue="") String supplied) {
        auth(supplied);
        return Map.of("online",true,"active",consumer.active(),"config",consumer.config(),"id",consumer.workerId());
    }
    @PostMapping("/internal/control")
    synchronized Map<String,Object> control(@RequestHeader(value="X-Internal-Token",defaultValue="") String supplied,
                                            @RequestBody WorkerConfig next) {
        auth(supplied);
        var container=(SimpleMessageListenerContainer)registry.getListenerContainer("jobs");
        if(container==null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
        container.setMaxConcurrentConsumers(6);
        container.setConcurrentConsumers(next.workers());
        container.setMaxConcurrentConsumers(next.workers());
        consumer.config(next);
        if(next.paused()) container.stop(); else container.start();
        return Map.of("accepted",true);
    }
}
