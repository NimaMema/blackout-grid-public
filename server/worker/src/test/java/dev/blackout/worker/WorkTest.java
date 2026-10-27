package dev.blackout.worker;
import dev.blackout.shared.WorkerConfig;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class WorkTest {
    @Test void workIsDeterministicAndInputDependent() {
        assertEquals(Work.digest("hello"),Work.digest("hello"));
        assertNotEquals(Work.digest("hello"),Work.digest("world"));
        assertTrue(Work.digest("hello").matches("[a-f0-9]{64}"));
    }
    @Test void resourceControlsAreBounded() {
        assertThrows(IllegalArgumentException.class,()->new WorkerConfig(false,0,2));
        assertThrows(IllegalArgumentException.class,()->new WorkerConfig(false,120,1000));
        assertDoesNotThrow(()->new WorkerConfig(true,3000,6));
    }
}
