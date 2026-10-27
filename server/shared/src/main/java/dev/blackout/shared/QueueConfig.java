package dev.blackout.shared;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
@Configuration
public class QueueConfig {
    public static final String JOBS = "blackout.jobs";
    @Bean Queue jobsQueue() { return new Queue(JOBS, true); }
    @Bean Jackson2JsonMessageConverter jsonConverter() { return new Jackson2JsonMessageConverter(); }
}
