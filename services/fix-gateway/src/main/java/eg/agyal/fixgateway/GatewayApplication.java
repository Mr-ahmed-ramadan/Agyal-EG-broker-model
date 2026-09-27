package eg.agyal.fixgateway;

import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import quickfix.DefaultMessageFactory;
import quickfix.FileStoreFactory;
import quickfix.Initiator;
import quickfix.SLF4JLogFactory;
import quickfix.SessionSettings;
import quickfix.SocketInitiator;

/**
 * Entry point for the FIX gateway (ADR 0004).
 *
 * <p>Starts one QuickFIX/J initiator with a session per partner bank and the
 * outbox poller. The gateway owns FIX sessions only; business logic stays in
 * the API, which it talks to through the outbox and inbox tables.
 */
public final class GatewayApplication {

    private GatewayApplication() {}

    public static void main(String[] args) throws Exception {
        String configPath = args.length > 0 ? args[0] : "initiator.cfg";
        SessionSettings settings = loadSettings(configPath);

        Database db = Database.fromEnv();
        BankSessionApplication app = new BankSessionApplication(db);
        Initiator initiator = createInitiator(settings, app);
        OutboxPoller poller = new OutboxPoller(db, app);

        initiator.start();
        poller.start(Long.parseLong(System.getenv().getOrDefault("GATEWAY_OUTBOX_POLL_MS", "200")));

        CountDownLatch shutdown = new CountDownLatch(1);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            poller.close();
            initiator.stop();
            shutdown.countDown();
        }));
        shutdown.await();
    }

    static Initiator createInitiator(SessionSettings settings, BankSessionApplication app)
            throws Exception {
        return new SocketInitiator(
                app,
                new FileStoreFactory(settings),
                settings,
                new SLF4JLogFactory(settings),
                new DefaultMessageFactory());
    }

    static SessionSettings loadSettings(String path) throws Exception {
        InputStream in = GatewayApplication.class.getClassLoader().getResourceAsStream(path);
        if (in != null) {
            try (in) {
                return new SessionSettings(in);
            }
        }
        return new SessionSettings(path);
    }
}
