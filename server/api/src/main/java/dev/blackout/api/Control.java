package dev.blackout.api;
import jakarta.validation.constraints.*;
public record Control(@Min(0) @Max(30) int rate, boolean paused,
                      @Min(120) @Max(3000) int delayMs,
                      @Min(1) @Max(6) int workers, boolean gatewayDown) {
    public static Control initial() { return new Control(3, false, 260, 2, false); }
}
