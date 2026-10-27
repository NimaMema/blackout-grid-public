package dev.blackout.api;
import dev.blackout.shared.JobMessage;
import dev.blackout.shared.QueueConfig;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class OutboxPublisherTest {
    @Test void confirmedPublishMarksOutboxOnlyAfterAcknowledgement() {
        var store=mock(JobStore.class); var rabbit=mock(RabbitTemplate.class); var activity=new Activity();
        when(store.pending()).thenReturn(List.of(new JobMessage("id",0,"payload")));
        doAnswer(invocation -> {
            CorrelationData correlation=invocation.getArgument(3);
            correlation.getFuture().complete(new CorrelationData.Confirm(true,null));
            return null;
        }).when(rabbit).convertAndSend(eq(""),eq(QueueConfig.JOBS),any(JobMessage.class),any(CorrelationData.class));
        var publisher=new OutboxPublisher(store,rabbit,activity);
        publisher.flush();
        verify(store).published("id"); verify(store,never()).attempted(anyString());
        assertTrue(publisher.healthy());
    }
    @Test void brokerFailureLeavesJobEligibleForRetry() {
        var store=mock(JobStore.class); var rabbit=mock(RabbitTemplate.class);
        when(store.pending()).thenReturn(List.of(new JobMessage("id",0,"payload")));
        doThrow(new AmqpException("Broker unavailable")).when(rabbit)
                .convertAndSend(eq(""),eq(QueueConfig.JOBS),any(JobMessage.class),any(CorrelationData.class));
        var publisher=new OutboxPublisher(store,rabbit,new Activity());
        publisher.flush();
        verify(store,never()).published(anyString()); verify(store).attempted("id");
        assertFalse(publisher.healthy());
    }
    @Test void negativeConfirmationDoesNotMarkAsPublished() {
        var store=mock(JobStore.class); var rabbit=mock(RabbitTemplate.class);
        when(store.pending()).thenReturn(List.of(new JobMessage("id",0,"payload")));
        doAnswer(invocation -> {
            CorrelationData correlation=invocation.getArgument(3);
            correlation.getFuture().complete(new CorrelationData.Confirm(false,"rejected"));
            return null;
        }).when(rabbit).convertAndSend(eq(""),eq(QueueConfig.JOBS),any(JobMessage.class),any(CorrelationData.class));
        new OutboxPublisher(store,rabbit,new Activity()).flush();
        verify(store,never()).published(anyString());
    }
}
