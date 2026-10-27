package dev.blackout.api;
import dev.blackout.shared.WorkerConfig;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
@Component
public class WorkerClient {
    private final RestClient http;
    public WorkerClient(@Value("${blackout.worker-url}") String url,
                        @Value("${blackout.internal-token}") String token) {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build());
        factory.setReadTimeout(Duration.ofSeconds(8));
        http = RestClient.builder().baseUrl(url).requestFactory(factory).defaultHeader("X-Internal-Token",token).build();
    }
    @SuppressWarnings("unchecked")
    public Map<String,Object> state() { return http.get().uri("/internal/state").retrieve().body(Map.class); }
    public void configure(Control c) {
        http.post().uri("/internal/control").body(new WorkerConfig(c.paused(),c.delayMs(),c.workers())).retrieve().toBodilessEntity();
    }
}
