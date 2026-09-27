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

    /**
     * Uses DATABASE_URL (postgres://user:pass@host:port/db, as Render and the
     * API use) when set; otherwise GATEWAY_DB_URL/USER/PASSWORD, defaulting to
     * the local development database.
     */
    public static Database fromEnv() {
        String url = System.getenv("DATABASE_URL");
        if (url != null && !url.isBlank()) {
            String[] parts = fromPostgresUrl(url);
            return new Database(parts[0], parts[1], parts[2]);
        }
        return new Database(
                env("GATEWAY_DB_URL", "jdbc:postgresql://localhost:5432/agyal_broker"),
                env("GATEWAY_DB_USER", "agyal"),
                env("GATEWAY_DB_PASSWORD", "agyal"));
    }

    /** postgres[ql]://user:pass@host[:port]/db[?params] -> {jdbcUrl, user, password}. */
    static String[] fromPostgresUrl(String url) {
        java.net.URI uri = java.net.URI.create(url.replaceFirst("^postgres(ql)?://", "http://"));
        String[] userInfo = uri.getRawUserInfo() == null ? new String[] {"", ""} : uri.getRawUserInfo().split(":", 2);
        String user = java.net.URLDecoder.decode(userInfo[0], java.nio.charset.StandardCharsets.UTF_8);
        String password = userInfo.length > 1
                ? java.net.URLDecoder.decode(userInfo[1], java.nio.charset.StandardCharsets.UTF_8) : "";
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        // Prisma's "schema" parameter is not a JDBC option; other parameters (e.g. sslmode) are kept.
        String query = uri.getRawQuery() == null ? "" : java.util.Arrays.stream(uri.getRawQuery().split("&"))
                .filter(p -> !p.startsWith("schema="))
                .reduce((a, b) -> a + "&" + b).orElse("");
        String jdbc = "jdbc:postgresql://" + uri.getHost() + ":" + port + uri.getRawPath()
                + (query.isEmpty() ? "" : "?" + query);
        return new String[] {jdbc, user, password};
    }

    public Connection connect() throws SQLException {
        return dataSource.getConnection();
    }

    private static String env(String name, String fallback) {
        String v = System.getenv(name);
        return v == null || v.isBlank() ? fallback : v;
    }
}
