package eg.agyal.fixgateway.simulator;

import eg.agyal.fixgateway.Database;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quickfix.Acceptor;
import quickfix.Application;
import quickfix.DefaultMessageFactory;
import quickfix.FieldNotFound;
import quickfix.MemoryStoreFactory;
import quickfix.Message;
import quickfix.SLF4JLogFactory;
import quickfix.Session;
import quickfix.SessionID;
import quickfix.SessionSettings;
import quickfix.SocketAcceptor;
import quickfix.field.AccruedInterestAmt;
import quickfix.field.AvgPx;
import quickfix.field.BidPx;
import quickfix.field.BidYield;
import quickfix.field.ClOrdID;
import quickfix.field.CumQty;
import quickfix.field.ExecID;
import quickfix.field.ExecType;
import quickfix.field.LastPx;
import quickfix.field.LastQty;
import quickfix.field.LeavesQty;
import quickfix.field.NetMoney;
import quickfix.field.OfferPx;
import quickfix.field.OfferYield;
import quickfix.field.OrdStatus;
import quickfix.field.OrderID;
import quickfix.field.OrderQty;
import quickfix.field.PriceType;
import quickfix.field.QuoteID;
import quickfix.field.QuoteReqID;
import quickfix.field.QuoteRequestRejectReason;
import quickfix.field.SecurityID;
import quickfix.field.SecurityIDSource;
import quickfix.field.SettlDate;
import quickfix.field.Side;
import quickfix.field.Symbol;
import quickfix.field.Text;
import quickfix.field.TransactTime;
import quickfix.field.ValidUntilTime;
import quickfix.fix44.ExecutionReport;
import quickfix.fix44.NewOrderSingle;
import quickfix.fix44.Quote;
import quickfix.fix44.QuoteRequest;
import quickfix.fix44.QuoteRequestReject;

/**
 * A local bank FIX acceptor for development and tests (ADR 0004).
 *
 * <p>Answers QuoteRequest with a firm Quote priced off a flat demo yield per
 * instrument type (each bank session quotes slightly differently): an offer
 * for a buy request, a bid (at a higher yield, i.e. lower price) for a sell
 * request. Fills a NewOrderSingle that references a live quote on the same
 * side with New + Trade execution reports. Unknown or expired quotes are rejected. Instrument data is read
 * from the platform database.
 */
public class BankSimulator extends quickfix.MessageCracker implements Application {

    private static final Logger log = LoggerFactory.getLogger(BankSimulator.class);
    private static final DateTimeFormatter FIX_DATE = DateTimeFormatter.BASIC_ISO_DATE;

    /** Demo offer yields by instrument type. */
    /** A bank buys at a higher yield than it sells: bid/offer spread in yield. */
    private static final double BID_OFFER_SPREAD = 0.003;

    private static final Map<String, Double> BASE_YIELD = Map.of(
            "TREASURY_BILL", 0.265,
            "TREASURY_BOND", 0.245,
            "CORPORATE_BOND", 0.285,
            "SUKUK", 0.275);

    private final Database db;
    private final long quoteValiditySeconds;
    private final Map<String, LiveQuote> quotes = new ConcurrentHashMap<>();

    record LiveQuote(String isin, char side, BigDecimal qty, BigDecimal cleanPx, BigDecimal accruedPer100,
            LocalDate settle, LocalDateTime validUntil) {}

    record InstrumentData(String type, Double couponRate, Integer couponFreq, LocalDate maturity) {}

    public BankSimulator(Database db, long quoteValiditySeconds) {
        this.db = db;
        this.quoteValiditySeconds = quoteValiditySeconds;
    }

    public static void main(String[] args) throws Exception {
        String configPath = args.length > 0 ? args[0] : "simulator.cfg";
        long validity = Long.parseLong(System.getenv().getOrDefault("SIM_QUOTE_VALID_SECONDS", "60"));
        Acceptor acceptor = createAcceptor(loadSettings(configPath), Database.fromEnv(), validity);
        acceptor.start();

        CountDownLatch shutdown = new CountDownLatch(1);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            acceptor.stop();
            shutdown.countDown();
        }));
        shutdown.await();
    }

    public static Acceptor createAcceptor(SessionSettings settings) throws Exception {
        return createAcceptor(settings, null, 60);
    }

    public static Acceptor createAcceptor(SessionSettings settings, Database db, long validity) throws Exception {
        return new SocketAcceptor(
                new BankSimulator(db, validity),
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
    public void fromApp(Message message, SessionID sessionId) throws FieldNotFound, quickfix.IncorrectTagValue,
            quickfix.UnsupportedMessageType {
        crack(message, sessionId);
    }

    // --- RFQ ----------------------------------------------------------------------

    public void onMessage(QuoteRequest request, SessionID session) throws FieldNotFound {
        String quoteReqId = request.getString(QuoteReqID.FIELD);
        QuoteRequest.NoRelatedSym sym = new QuoteRequest.NoRelatedSym();
        request.getGroup(1, sym);
        String isin = sym.getString(SecurityID.FIELD);
        BigDecimal qty = sym.getDecimal(OrderQty.FIELD);
        char side = sym.isSetField(Side.FIELD) ? sym.getChar(Side.FIELD) : Side.BUY;
        LocalDate settle = sym.isSetField(SettlDate.FIELD)
                ? LocalDate.parse(sym.getString(SettlDate.FIELD), FIX_DATE)
                : LocalDate.now(ZoneOffset.UTC).plusDays(1);
        try {
            InstrumentData inst = instrument(isin);
            if (inst == null) {
                reject(session, quoteReqId, "Unknown instrument " + isin);
                return;
            }
            double yield = BASE_YIELD.getOrDefault(inst.type(), 0.25) + bankAdjustment(session)
                    + (side == Side.SELL ? BID_OFFER_SPREAD : 0);
            double clean;
            double accrued;
            if ("TREASURY_BILL".equals(inst.type())) {
                clean = SimPricing.tbillPrice(yield, settle, inst.maturity());
                accrued = 0;
            } else {
                clean = SimPricing.bondCleanPrice(inst.couponRate(), inst.couponFreq(), yield, settle, inst.maturity());
                accrued = SimPricing.accrued(inst.couponRate(), inst.couponFreq(), settle, inst.maturity());
            }
            String quoteId = "Q-" + session.getSenderCompID() + "-" + UUID.randomUUID().toString().substring(0, 8);
            LocalDateTime validUntil = LocalDateTime.now(ZoneOffset.UTC).plusSeconds(quoteValiditySeconds)
                    .truncatedTo(ChronoUnit.MILLIS);
            BigDecimal px = BigDecimal.valueOf(clean).setScale(6, RoundingMode.HALF_UP);
            quotes.put(quoteId, new LiveQuote(isin, side, qty, px, BigDecimal.valueOf(accrued), settle, validUntil));

            Quote quote = new Quote(new QuoteID(quoteId));
            quote.set(new QuoteReqID(quoteReqId));
            quote.set(new Symbol("[N/A]"));
            quote.set(new SecurityID(isin));
            quote.set(new SecurityIDSource(SecurityIDSource.ISIN_NUMBER));
            BigDecimal quotedYield = BigDecimal.valueOf(yield).setScale(6, RoundingMode.HALF_UP);
            if (side == Side.SELL) {
                quote.setDecimal(BidPx.FIELD, px);
                quote.setDecimal(BidYield.FIELD, quotedYield);
            } else {
                quote.setDecimal(OfferPx.FIELD, px);
                quote.setDecimal(OfferYield.FIELD, quotedYield);
            }
            quote.set(new PriceType(PriceType.PERCENTAGE));
            quote.set(new ValidUntilTime(validUntil));
            quote.set(new TransactTime(LocalDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS)));
            Session.sendToTarget(quote, session);
        } catch (Exception e) {
            log.error("Simulator could not price {}", isin, e);
            reject(session, quoteReqId, "Pricing unavailable");
        }
    }

    // --- Orders ---------------------------------------------------------------------

    public void onMessage(NewOrderSingle order, SessionID session) throws FieldNotFound {
        String clOrdId = order.getString(ClOrdID.FIELD);
        String quoteId = order.isSetField(QuoteID.FIELD) ? order.getString(QuoteID.FIELD) : null;
        BigDecimal qty = order.getDecimal(OrderQty.FIELD);
        LiveQuote q = quoteId == null ? null : quotes.remove(quoteId);
        String orderId = "BO-" + UUID.randomUUID().toString().substring(0, 8);

        if (q == null || q.validUntil().isBefore(LocalDateTime.now(ZoneOffset.UTC))
                || q.qty().compareTo(qty) != 0
                || q.side() != order.getChar(Side.FIELD)
                || !q.isin().equals(order.getString(SecurityID.FIELD))) {
            send(session, report(order, orderId, ExecType.REJECTED, OrdStatus.REJECTED, BigDecimal.ZERO, BigDecimal.ZERO,
                    "Quote not found, expired or does not match the order"));
            return;
        }

        send(session, report(order, orderId, ExecType.NEW, OrdStatus.NEW, BigDecimal.ZERO, qty, null));

        BigDecimal accrued = qty.multiply(q.accruedPer100()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal principal = qty.multiply(q.cleanPx()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        ExecutionReport fill = report(order, orderId, ExecType.TRADE, OrdStatus.FILLED, qty, BigDecimal.ZERO, null);
        fill.setDecimal(LastQty.FIELD, qty);
        fill.setDecimal(LastPx.FIELD, q.cleanPx());
        fill.setDecimal(AvgPx.FIELD, q.cleanPx());
        fill.setDecimal(AccruedInterestAmt.FIELD, accrued);
        fill.setDecimal(NetMoney.FIELD, principal.add(accrued));
        fill.set(new SettlDate(q.settle().format(FIX_DATE)));
        send(session, fill);
    }

    private ExecutionReport report(NewOrderSingle order, String orderId, char execType, char ordStatus,
            BigDecimal cumQty, BigDecimal leavesQty, String text) throws FieldNotFound {
        ExecutionReport er = new ExecutionReport();
        er.set(new OrderID(orderId));
        er.set(new ExecID("E-" + UUID.randomUUID().toString().substring(0, 12)));
        er.set(new ExecType(execType));
        er.set(new OrdStatus(ordStatus));
        er.set(new Side(order.getChar(Side.FIELD)));
        er.setDecimal(LeavesQty.FIELD, leavesQty);
        er.setDecimal(CumQty.FIELD, cumQty);
        er.setDecimal(AvgPx.FIELD, BigDecimal.ZERO);
        er.set(new ClOrdID(order.getString(ClOrdID.FIELD)));
        er.set(new Symbol("[N/A]"));
        er.set(new SecurityID(order.getString(SecurityID.FIELD)));
        er.set(new SecurityIDSource(SecurityIDSource.ISIN_NUMBER));
        er.setDecimal(OrderQty.FIELD, order.getDecimal(OrderQty.FIELD));
        er.set(new TransactTime(LocalDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS)));
        if (text != null) er.set(new Text(text));
        return er;
    }

    // --- helpers ----------------------------------------------------------------------

    /** Each simulated bank quotes a slightly different yield so RFQ ranking is visible. */
    private static double bankAdjustment(SessionID session) {
        return "SIMBANK2".equals(session.getSenderCompID()) ? -0.002 : 0.0;
    }

    private InstrumentData instrument(String isin) throws Exception {
        if (db == null) return null;
        try (Connection c = db.connect();
                PreparedStatement ps = c.prepareStatement(
                        "SELECT type::text, \"couponRate\", \"couponFreq\", \"maturityDate\" FROM \"Instrument\" WHERE isin = ?")) {
            ps.setString(1, isin);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                BigDecimal coupon = rs.getBigDecimal(2);
                int freq = rs.getInt(3);
                return new InstrumentData(
                        rs.getString(1),
                        coupon == null ? null : coupon.doubleValue(),
                        rs.wasNull() ? null : freq,
                        rs.getTimestamp(4).toInstant().atZone(ZoneOffset.UTC).toLocalDate());
            }
        }
    }

    private static void reject(SessionID session, String quoteReqId, String text) {
        QuoteRequestReject rej = new QuoteRequestReject(
                new QuoteReqID(quoteReqId), new QuoteRequestRejectReason(QuoteRequestRejectReason.OTHER));
        rej.set(new Text(text));
        send(session, rej);
    }

    private static void send(SessionID session, Message msg) {
        try {
            Session.sendToTarget(msg, session);
        } catch (Exception e) {
            log.error("Simulator send failed", e);
        }
    }
}
