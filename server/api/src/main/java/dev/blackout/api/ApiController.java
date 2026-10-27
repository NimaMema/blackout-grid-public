package dev.blackout.api;
import dev.blackout.shared.JobResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
public class ApiController {
    private final Lab lab;
    private final JobStore store;
    private final Activity activity;
    private final String token;
    public ApiController(Lab lab, JobStore store, Activity activity, @Value("${blackout.internal-token}") String token) {
        this.lab=lab; this.store=store; this.activity=activity; this.token=token;
    }
    @GetMapping("/api/health") Map<String,Object> health() { return Map.of("product","BLACKOUT","mode","live","status","up"); }
    @GetMapping("/api/snapshot") Map<String,Object> snapshot() { return lab.snapshot(); }
    public record Submit(@Size(max=500) String payload) {}
    @PostMapping("/api/jobs")
    @ResponseStatus(HttpStatus.ACCEPTED)
    JobStore.Accepted submit(@RequestHeader(value="Idempotency-Key",required=false) String key,
                            @Valid @RequestBody(required=false) Submit body) {
        if (key!=null && (key.isBlank()||key.length()>128)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid idempotency key.");
        return lab.submit(key==null?UUID.randomUUID().toString():key, body==null||body.payload()==null?"Render city block":body.payload());
    }
    @PostMapping("/api/control") Control configure(@Valid @RequestBody Control next) {
        try { return lab.configure(next); }
        catch(Exception e) { throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Worker control unavailable. Check the worker service."); }
    }
    @PostMapping("/internal/complete")
    Map<String,Object> complete(@RequestHeader(value="X-Internal-Token",defaultValue="") String supplied,
                                @RequestBody JobResult result) {
        if (!MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8),supplied.getBytes(StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (result.id()==null||!store.exists(result.id())) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (result.result()==null||!result.result().matches("[a-f0-9]{64}")||result.workerId()==null
                ||result.workerId().length()>100||result.processingMs()<0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid job result.");
        boolean changed=store.complete(result);
        if(changed) activity.add("completed","Job committed → acknowledgement allowed",result.id());
        return Map.of("accepted",true,"duplicate",!changed);
    }
}
