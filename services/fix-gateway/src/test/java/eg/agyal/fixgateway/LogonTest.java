package eg.agyal.fixgateway;

import static org.junit.jupiter.api.Assertions.assertTrue;

import eg.agyal.fixgateway.simulator.BankSimulator;
import java.io.ByteArrayInputStream;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import quickfix.Acceptor;
import quickfix.Initiator;
import quickfix.SessionID;
import quickfix.SessionSettings;

/** The gateway initiator can log on to the bank simulator over FIX 4.4. */
class LogonTest {

    @Test
    void initiatorLogsOnToSimulator() throws Exception {
        int port;
        try (ServerSocket socket = new ServerSocket(0)) {
            port = socket.getLocalPort();
        }
        Path store = Files.createTempDirectory("fix-store");

        Acceptor acceptor = BankSimulator.createAcceptor(settings("""
                [DEFAULT]
                ConnectionType=acceptor
                StartTime=00:00:00
                EndTime=00:00:00
                HeartBtInt=30
                SocketAcceptPort=%d
                [SESSION]
                BeginString=FIX.4.4
                SenderCompID=SIMBANK
                TargetCompID=AGYAL
                """.formatted(port)));

        BankSessionApplication app = new BankSessionApplication();
        Initiator initiator = GatewayApplication.createInitiator(settings("""
                [DEFAULT]
                ConnectionType=initiator
                StartTime=00:00:00
                EndTime=00:00:00
                HeartBtInt=30
                ReconnectInterval=1
                FileStorePath=%s
                ResetOnLogon=Y
                [SESSION]
                BeginString=FIX.4.4
                SenderCompID=AGYAL
                TargetCompID=SIMBANK
                SocketConnectHost=localhost
                SocketConnectPort=%d
                """.formatted(store, port)), app);

        SessionID sessionId = new SessionID("FIX.4.4", "AGYAL", "SIMBANK");
        acceptor.start();
        initiator.start();
        try {
            long deadline = System.currentTimeMillis() + 10_000;
            while (!app.isLoggedOn(sessionId) && System.currentTimeMillis() < deadline) {
                Thread.sleep(100);
            }
            assertTrue(app.isLoggedOn(sessionId), "expected FIX logon within 10s");
        } finally {
            initiator.stop(true);
            acceptor.stop(true);
        }
    }

    private static SessionSettings settings(String cfg) throws Exception {
        return new SessionSettings(new ByteArrayInputStream(cfg.getBytes(StandardCharsets.UTF_8)));
    }
}
