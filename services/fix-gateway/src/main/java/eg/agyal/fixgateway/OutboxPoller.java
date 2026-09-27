package eg.agyal.fixgateway;

import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quickfix.Message;
import quickfix.Session;
import quickfix.SessionID;

/**
 * Sends messages the API queued in the outbox to the right bank session
 * (ADR 0004). Rows for a session that is not logged on stay PENDING and are
 * retried. Delivery is at-least-once: banks de-duplicate on ClOrdID/QuoteReqID.
 */
public final class OutboxPoller implements AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(OutboxPoller.class);
    private static final String BEGIN_STRING = "FIX.4.4";

    private final Database db;
    private final BankSessionApplication app;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public OutboxPoller(Database db, BankSessionApplication app) {
        this.db = db;
        this.app = app;
    }

    public void start(long intervalMillis) {
        scheduler.scheduleWithFixedDelay(this::pollSafely, intervalMillis, intervalMillis, TimeUnit.MILLISECONDS);
    }

    private void pollSafely() {
        try {
            poll();
        } catch (Exception e) {
            log.error("Outbox poll failed", e);
        }
    }

    /** Sends one batch; returns the number of rows sent. */
    public int poll() throws Exception {
        int sent = 0;
        try (Connection c = db.connect()) {
            c.setAutoCommit(false);
            try (PreparedStatement select = c.prepareStatement(
                    "SELECT id, \"senderCompId\", \"targetCompId\", \"msgType\", payload::text "
                            + "FROM \"FixOutbox\" WHERE status = 'PENDING' ORDER BY id LIMIT 50 "
                            + "FOR UPDATE SKIP LOCKED");
                    ResultSet rs = select.executeQuery()) {
                while (rs.next()) {
                    long id = rs.getLong(1);
                    SessionID session = new SessionID(BEGIN_STRING, rs.getString(2), rs.getString(3));
                    if (!app.isLoggedOn(session)) continue; // retry when the session is up
                    try {
                        JsonNode payload = FixJson.JSON.readTree(rs.getString(5));
                        Message msg = FixJson.toFix(rs.getString(4), payload);
                        if (Session.sendToTarget(msg, session)) {
                            mark(c, id, "SENT", null);
                            sent++;
                        }
                    } catch (Exception e) {
                        log.error("Outbox row {} could not be sent", id, e);
                        mark(c, id, "FAILED", e.getMessage());
                    }
                }
            }
            c.commit();
        }
        return sent;
    }

    private static void mark(Connection c, long id, String status, String error) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                "UPDATE \"FixOutbox\" SET status = ?, error = ?, \"sentAt\" = now() WHERE id = ?")) {
            ps.setString(1, status);
            ps.setString(2, error);
            ps.setLong(3, id);
            ps.executeUpdate();
        }
    }

    @Override
    public void close() {
        scheduler.shutdownNow();
    }
}
