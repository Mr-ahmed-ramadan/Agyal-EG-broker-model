package eg.agyal.fixgateway.simulator;

import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quickfix.Acceptor;
import quickfix.Application;
import quickfix.DefaultMessageFactory;
import quickfix.MemoryStoreFactory;
import quickfix.Message;
import quickfix.SLF4JLogFactory;
import quickfix.SessionID;
import quickfix.SessionSettings;
import quickfix.SocketAcceptor;

/**
 * A local bank FIX acceptor for development and tests (ADR 0004).
 *
 * <p>Placeholder: accepts logons and logs messages. Next step: answer
 * QuoteRequest with Quote and NewOrderSingle with ExecutionReport so the full
 * RFQ flow can be tested end to end without a real bank.
 */
public class BankSimulator implements Application {

    private static final Logger log = LoggerFactory.getLogger(BankSimulator.class);

    public static void main(String[] args) throws Exception {
        String configPath = args.length > 0 ? args[0] : "simulator.cfg";
        Acceptor acceptor = createAcceptor(loadSettings(configPath));
        acceptor.start();

        CountDownLatch shutdown = new CountDownLatch(1);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            acceptor.stop();
            shutdown.countDown();
        }));
        shutdown.await();
    }

    public static Acceptor createAcceptor(SessionSettings settings) throws Exception {
        return new SocketAcceptor(
                new BankSimulator(),
                new MemoryStoreFactory(),
                settings,
                new SLF4JLogFactory(settings),
                new DefaultMessageFactory());
    }

    static SessionSettings loadSettings(String path) throws Exception {
        InputStream in = BankSimulator.class.getClassLoader().getResourceAsStream(path);
        if (in != null) {
            try (in) {
                return new SessionSettings(in);
            }
        }
        return new SessionSettings(path);
    }

    @Override
    public void onCreate(SessionID sessionId) {}

    @Override
    public void onLogon(SessionID sessionId) {
        log.info("Simulator logon: {}", sessionId);
    }

    @Override
    public void onLogout(SessionID sessionId) {
        log.info("Simulator logout: {}", sessionId);
    }

    @Override
    public void toAdmin(Message message, SessionID sessionId) {}

    @Override
    public void fromAdmin(Message message, SessionID sessionId) {}

    @Override
    public void toApp(Message message, SessionID sessionId) {}

    @Override
    public void fromApp(Message message, SessionID sessionId) {
        log.info("Simulator IN {}: {}", sessionId, message);
    }
}
