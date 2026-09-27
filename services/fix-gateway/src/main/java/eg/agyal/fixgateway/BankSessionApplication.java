package eg.agyal.fixgateway;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quickfix.Application;
import quickfix.Message;
import quickfix.SessionID;

/**
 * QuickFIX/J callbacks for bank sessions.
 *
 * <p>Placeholder: messages are logged only. Next steps (ADR 0003/0004):
 * persist every message to the raw message store, translate application
 * messages (Quote, ExecutionReport, ...) into FIX-shaped JSON on the inbox,
 * and send QuoteRequest/NewOrderSingle from the outbox.
 */
public class BankSessionApplication implements Application {

    private static final Logger log = LoggerFactory.getLogger(BankSessionApplication.class);

    private final Set<SessionID> loggedOn = ConcurrentHashMap.newKeySet();

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
        log.info("OUT {}: {}", sessionId, message);
    }

    @Override
    public void fromApp(Message message, SessionID sessionId) {
        log.info("IN {}: {}", sessionId, message);
    }
}
