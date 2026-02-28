package dev.aura.aurafarm;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Statement;

import javax.sql.DataSource;

import io.quarkus.runtime.LaunchMode;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;

@ApplicationScoped
public class DevDataLoader {

    @Inject
    DataSource dataSource;

    void onStart(@Observes StartupEvent ev) {
        if (LaunchMode.current() != LaunchMode.DEVELOPMENT) {
            return;
        }

        try (InputStream is = Thread.currentThread().getContextClassLoader().getResourceAsStream("import.sql")) {
            if (is == null) {
                return;
            }
            String sql = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            try (Connection conn = dataSource.getConnection();
                 Statement stmt = conn.createStatement()) {
                stmt.execute(sql);
            }
        } catch (Exception e) {
            io.quarkus.logging.Log.warn("DevDataLoader: failed to run import.sql", e);
        }
    }
}
