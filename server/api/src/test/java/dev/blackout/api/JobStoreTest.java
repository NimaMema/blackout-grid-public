package dev.blackout.api;
import dev.blackout.shared.JobResult;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;
class JobStoreTest {
    JobStore store;
    @BeforeEach void setup() {
        var ds=new DriverManagerDataSource("jdbc:h2:mem:"+java.util.UUID.randomUUID()+";DB_CLOSE_DELAY=-1","sa","");
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);
        store=new JobStore(new JdbcTemplate(ds),new TransactionTemplate(new DataSourceTransactionManager(ds)));
    }
    @Test void duplicateSubmissionOnlyCreatesOneJobAndOneOutboxEntry() {
        var first=store.submit("same-request","payload");
        var retry=store.submit("same-request","payload");
        assertEquals(first.id(),retry.id()); assertTrue(retry.duplicate());
        assertEquals(1,store.submitted()); assertEquals(1,store.pendingCount());
    }
    @Test void duplicateDeliveryDoesNotOverwriteCommittedResult() {
        var job=store.submit("job","payload");
        assertTrue(store.complete(new JobResult(job.id(),"a".repeat(64),"worker-1",12)));
        assertFalse(store.complete(new JobResult(job.id(),"b".repeat(64),"worker-2",90)));
        assertEquals(1,store.completed());
        assertEquals("a".repeat(64),store.recent().get(0).get("result"));
    }
    @Test void failedPublishStaysInOutboxUntilConfirmed() {
        var job=store.submit("job","payload");
        store.attempted(job.id());
        assertEquals(1,store.pending().size());
        store.published(job.id());
        assertEquals(0,store.pendingCount());
        assertEquals(1,store.submitted());
    }
    @Test void unknownResultCannotCreatePhantomCompletion() {
        assertFalse(store.complete(new JobResult("missing","a".repeat(64),"worker",1)));
        assertEquals(0,store.completed());
    }
    @Test void acceptedOutboxSurvivesDatabaseReopen(@org.junit.jupiter.api.io.TempDir java.nio.file.Path temp) {
        String url="jdbc:h2:file:"+temp.resolve("persistent").toAbsolutePath();
        var firstDs=new DriverManagerDataSource(url,"sa","");
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(firstDs);
        var first=new JobStore(new JdbcTemplate(firstDs),new TransactionTemplate(new DataSourceTransactionManager(firstDs)));
        var accepted=first.submit("persistent-key","payload");
        var secondDs=new DriverManagerDataSource(url,"sa","");
        var reopened=new JobStore(new JdbcTemplate(secondDs),new TransactionTemplate(new DataSourceTransactionManager(secondDs)));
        assertEquals(accepted.id(),reopened.pending().get(0).id());
        assertEquals(1,reopened.pendingCount());
    }
    @Test void concurrentRetriesShareOnePersistentJob() throws Exception {
        var pool=java.util.concurrent.Executors.newFixedThreadPool(8);
        try {
            var tasks=new java.util.ArrayList<java.util.concurrent.Callable<String>>();
            for(int i=0;i<16;i++) tasks.add(()->store.submit("concurrent","payload").id());
            var ids=new java.util.HashSet<String>();
            for(var result:pool.invokeAll(tasks)) ids.add(result.get());
            assertEquals(1,ids.size()); assertEquals(1,store.pendingCount());
        } finally { pool.shutdownNow(); }
    }
}
