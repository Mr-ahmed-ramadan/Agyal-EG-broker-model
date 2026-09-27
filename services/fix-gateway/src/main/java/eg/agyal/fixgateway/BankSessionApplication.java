package eg.agyal.fixgateway;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quickfix.Application;
import quickfix.FieldNotFound;
import quickfix.Message;
import quickfix.SessionID;
import quickfix.field.MsgSeqNum;
import quickfix.field.MsgType;

/**
 * QuickFIX/J callbacks for bank sessions (ADR 0004).
 *
 * <p>Every application message in or out is written to the raw message store.
 * Inbound application messages are translated to FIX-shaped JSON and written
 * to the inbox, where the API picks them up. When no database is configured
 * (unit tests) messages are only logged.
 */
public class BankSessionApplication implements Application {

    private static final Logger log = LoggerFactory.getLogger(BankSessionApplication.class);

    private final Database db;
    private final Set<SessionID> loggedOn = ConcurrentHashMap.newKeySet();

    public BankSessionApplication() {
        this(null);
    }

    public BankSessionApplication(Database db) {
        this.db = db;
    }

    public boolean isLoggedOn(SessionID sessionId) {
        return loggedOn.contains(sessionId);
    }

    @Override
    public void onCreate(SessionID sessionId) {
        log.info("Session created: {}", sessionId);
    }

    @Override
    public void onLogon(SessionID sessionId) {
        loggedOn.add(sessionId);
        log.info("Logon: {}", sessionId);
    }

    @Override
    public void onLogout(SessionID sessionId) {
        loggedOn.remove(sessionId);
        log.info("Logout: {}", sessionId);
    }

    @Override
    public void toAdmin(Message message, SessionID sessionId) {}

    @Override
    public void fromAdmin(Message message, SessionID sessionId) {}

    @Override
    public void toApp(Message message, SessionID sessionId) {
        store(sessionId, "OUT", message);
    }

    @Override
    public void fromApp(Message message, SessionID sessionId) {
        store(sessionId, "IN", message);
        if (db == null) {
            log.info("IN {}: {}", sessionId, message);
            return;
        }
        try (Connection c = db.connect();
                PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO \"FixInbox\" (\"senderCompId\", \"msgType\", payload) VALUES (?, ?, ?::jsonb)")) {
            ps.setString(1, sessionId.getTargetCompID());
            ps.setString(2, message.getHeader().getString(MsgType.FIELD));
            ps.setString(3, FixJson.fromFix(message).toString());
            ps.executeUpdate();
        } catch (Exception e) {
            // Not acknowledged to the bank at the application level; ops replay from the raw store.
            log.error("Failed to write inbound message to inbox: {}", message, e);
        }
    }

    private void store(SessionID sessionId, String direction, Message message) {
        if (db == null) return;
        try (Connection c = db.connect();
                PreparedStatement ps = c.prepareStatement(
                        "INSERT INTO \"FixMessage\" (\"sessionId\", direction, \"msgType\", \"seqNum\", raw) VALUES (?, ?, ?, ?, ?)")) {
            ps.setString(1, sessionId.toString());
            ps.setString(2, direction);
            ps.setString(3, message.getHeader().getString(MsgType.FIELD));
            ps.setInt(4, message.getHeader().isSetField(MsgSeqNum.FIELD) ? message.getHeader().getInt(MsgSeqNum.FIELD) : 0);
            ps.setString(5, message.toString().replace('\u0001', '|'));
            ps.executeUpdate();
        } catch (FieldNotFound | java.sql.SQLException e) {
            log.error("Failed to store raw FIX message", e);
        }
    }
}
