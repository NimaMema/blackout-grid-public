package dev.blackout.worker;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
public final class Work {
    private Work() {}
    /** Real deterministic CPU work; latency injection is an additional, explicit lab control. */
    public static String digest(String payload) {
        try {
            var sha=MessageDigest.getInstance("SHA-256");
            byte[] data=payload.getBytes(StandardCharsets.UTF_8);
            for(int i=0;i<8000;i++) data=sha.digest(data);
            return HexFormat.of().formatHex(data);
        } catch(Exception e) { throw new IllegalStateException(e); }
    }
}
