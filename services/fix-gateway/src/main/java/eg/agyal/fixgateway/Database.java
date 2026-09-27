package eg.agyal.fixgateway;

import java.sql.Connection;
import java.sql.SQLException;
import org.postgresql.ds.PGSimpleDataSource;

/**
 * JDBC access to the platform database for the outbox/inbox bridge and the raw
 * FIX message store (ADR 0004). Only platform tables are touched; they are not
 * tenant-scoped, so no RLS context is needed.
 */
public final class Database {

    private final PGSimpleDataSource dataSource = new PGSimpleDataSource();

    public Database(String jdbcUrl, String user, String password) {
        dataSource.setUrl(jdbcUrl);
        dataSource.setUser(user);
        dataSource.setPassword(password);
    }

    public static Database fromEnv() {
        return new Database(
                env("GATEWAY_DB_URL", "jdbc:postgresql://localhost:5432/agyal_broker"),
                env("GATEWAY_DB_USER", "agyal"),
                env("GATEWAY_DB_PASSWORD", "agyal"));
    }

    public Connection connect() throws SQLException {
        return dataSource.getConnection();
    }

    private static String env(String name, String fallback) {
        String v = System.getenv(name);
        return v == null || v.isBlank() ? fallback : v;
    }
}
