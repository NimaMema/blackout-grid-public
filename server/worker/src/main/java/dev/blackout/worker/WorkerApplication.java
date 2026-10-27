package dev.blackout.worker;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication(scanBasePackages={"dev.blackout.worker","dev.blackout.shared"})
public class WorkerApplication {
    public static void main(String[] args) { SpringApplication.run(WorkerApplication.class,args); }
}
