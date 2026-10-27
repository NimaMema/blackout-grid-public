package dev.blackout.api;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;
@Component
public class Activity {
    public record Event(long id, String type, String message, long at, String jobId) {}
    private final Deque<Event> events = new ArrayDeque<>();
    private final AtomicLong nextId = new AtomicLong();
    public synchronized void add(String type, String message, String jobId) {
        events.addFirst(new Event(nextId.incrementAndGet(), type, message, System.currentTimeMillis(), jobId));
        while (events.size() > 80) events.removeLast();
    }
    public synchronized List<Event> recent() { return List.copyOf(events); }
}
