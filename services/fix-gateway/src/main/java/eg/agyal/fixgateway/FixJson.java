package eg.agyal.fixgateway;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import quickfix.FieldMap;
import quickfix.FieldNotFound;
import quickfix.Message;
import quickfix.field.AccruedInterestAmt;
import quickfix.field.ClOrdID;
import quickfix.field.CumQty;
import quickfix.field.ExecID;
import quickfix.field.ExecType;
import quickfix.field.LastPx;
import quickfix.field.LastQty;
import quickfix.field.LeavesQty;
import quickfix.field.MsgType;
import quickfix.field.NetMoney;
import quickfix.field.OfferPx;
import quickfix.field.OfferYield;
import quickfix.field.OrdStatus;
import quickfix.field.OrdType;
import quickfix.field.OrderID;
import quickfix.field.OrderQty;
import quickfix.field.PartyID;
import quickfix.field.PartyIDSource;
import quickfix.field.PartyRole;
import quickfix.field.Price;
import quickfix.field.PriceType;
import quickfix.field.QuoteID;
import quickfix.field.QuoteReqID;
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
 * Maps between FIX 4.4 messages and the platform's FIX-shaped JSON (field
 * names as in packages/shared-types/src/fix.ts). No business logic.
 */
public final class FixJson {

    public static final ObjectMapper JSON = new ObjectMapper();

    private FixJson() {}

    // --- Outbound: JSON -> FIX ----------------------------------------------------

    public static Message toFix(String msgType, JsonNode p) {
        return switch (msgType) {
            case MsgType.QUOTE_REQUEST -> quoteRequest(p);
            case MsgType.ORDER_SINGLE -> newOrderSingle(p);
            default -> throw new IllegalArgumentException("Unsupported outbound MsgType " + msgType);
        };
    }

    static QuoteRequest quoteRequest(JsonNode p) {
        QuoteRequest msg = new QuoteRequest(new QuoteReqID(text(p, "quoteReqId")));
        QuoteRequest.NoRelatedSym sym = new QuoteRequest.NoRelatedSym();
        setInstrument(sym, p.get("instrument"));
        sym.set(new Side(text(p, "side").charAt(0)));
        sym.setDecimal(OrderQty.FIELD, decimal(p, "orderQty"));
        if (p.hasNonNull("settlDate")) sym.set(new SettlDate(text(p, "settlDate")));
        for (JsonNode party : p.path("parties")) {
            QuoteRequest.NoRelatedSym.NoPartyIDs g = new QuoteRequest.NoRelatedSym.NoPartyIDs();
            g.set(new PartyID(text(party, "partyId")));
            g.set(new PartyIDSource(text(party, "partyIdSource").charAt(0)));
            g.set(new PartyRole(party.get("partyRole").asInt()));
            sym.addGroup(g);
        }
        msg.addGroup(sym);
        return msg;
    }

    static NewOrderSingle newOrderSingle(JsonNode p) {
        NewOrderSingle msg = new NewOrderSingle(
                new ClOrdID(text(p, "clOrdId")),
                new Side(text(p, "side").charAt(0)),
                new TransactTime(utc(text(p, "transactTime"))),
                new OrdType(text(p, "ordType").charAt(0)));
        setInstrument(msg, p.get("instrument"));
        msg.setDecimal(OrderQty.FIELD, decimal(p, "orderQty"));
        msg.set(new PriceType(Integer.parseInt(text(p, "priceType"))));
        if (p.hasNonNull("price")) msg.setDecimal(Price.FIELD, decimal(p, "price"));
        if (p.hasNonNull("quoteId")) msg.set(new QuoteID(text(p, "quoteId")));
        if (p.hasNonNull("settlDate")) msg.set(new SettlDate(text(p, "settlDate")));
        for (JsonNode party : p.path("parties")) {
            NewOrderSingle.NoPartyIDs g = new NewOrderSingle.NoPartyIDs();
            g.set(new PartyID(text(party, "partyId")));
            g.set(new PartyIDSource(text(party, "partyIdSource").charAt(0)));
            g.set(new PartyRole(party.get("partyRole").asInt()));
            msg.addGroup(g);
        }
        return msg;
    }

    private static void setInstrument(FieldMap target, JsonNode instrument) {
        target.setField(new Symbol("[N/A]"));
        target.setField(new SecurityID(text(instrument, "securityId")));
        target.setField(new SecurityIDSource(text(instrument, "securityIdSource")));
    }

    // --- Inbound: FIX -> JSON ------------------------------------------------------

    public static ObjectNode fromFix(Message msg) throws FieldNotFound {
        String type = msg.getHeader().getString(MsgType.FIELD);
        ObjectNode o = JSON.createObjectNode().put("msgType", type);
        switch (type) {
            case MsgType.QUOTE -> quote((Quote) msg, o);
            case MsgType.QUOTE_REQUEST_REJECT -> quoteRequestReject((QuoteRequestReject) msg, o);
            case MsgType.EXECUTION_REPORT -> executionReport((ExecutionReport) msg, o);
            default -> throw new IllegalArgumentException("Unsupported inbound MsgType " + type);
        }
        return o;
    }

    private static void quote(Quote m, ObjectNode o) throws FieldNotFound {
        o.put("quoteReqId", m.getString(QuoteReqID.FIELD));
        o.put("quoteId", m.getString(QuoteID.FIELD));
        o.set("instrument", instrument(m));
        o.put("priceType", String.valueOf(m.getInt(PriceType.FIELD)));
        putDecimal(o, "offerPx", m, OfferPx.FIELD);
        putDecimal(o, "offerYield", m, OfferYield.FIELD);
        o.put("validUntilTime", iso(m.getUtcTimeStamp(ValidUntilTime.FIELD)));
        o.put("transactTime", m.isSetField(TransactTime.FIELD)
                ? iso(m.getUtcTimeStamp(TransactTime.FIELD)) : Instant.now().toString());
    }

    private static void quoteRequestReject(QuoteRequestReject m, ObjectNode o) throws FieldNotFound {
        o.put("quoteReqId", m.getString(QuoteReqID.FIELD));
        if (m.isSetField(Text.FIELD)) o.put("text", m.getString(Text.FIELD));
    }

    private static void executionReport(ExecutionReport m, ObjectNode o) throws FieldNotFound {
        o.put("orderId", m.getString(OrderID.FIELD));
        o.put("clOrdId", m.getString(ClOrdID.FIELD));
        o.put("execId", m.getString(ExecID.FIELD));
        o.put("execType", String.valueOf(m.getChar(ExecType.FIELD)));
        o.put("ordStatus", String.valueOf(m.getChar(OrdStatus.FIELD)));
        o.set("instrument", instrument(m));
        o.put("side", String.valueOf(m.getChar(Side.FIELD)));
        putDecimal(o, "orderQty", m, OrderQty.FIELD);
        putDecimal(o, "lastQty", m, LastQty.FIELD);
        putDecimal(o, "lastPx", m, LastPx.FIELD);
        putDecimal(o, "cumQty", m, CumQty.FIELD);
        putDecimal(o, "leavesQty", m, LeavesQty.FIELD);
        putDecimal(o, "accruedInterestAmt", m, AccruedInterestAmt.FIELD);
        putDecimal(o, "netMoney", m, NetMoney.FIELD);
        if (m.isSetField(SettlDate.FIELD)) o.put("settlDate", m.getString(SettlDate.FIELD));
        if (m.isSetField(Text.FIELD)) o.put("text", m.getString(Text.FIELD));
        o.put("transactTime", m.isSetField(TransactTime.FIELD)
                ? iso(m.getUtcTimeStamp(TransactTime.FIELD)) : Instant.now().toString());
    }

    private static ObjectNode instrument(FieldMap m) throws FieldNotFound {
        return JSON.createObjectNode()
                .put("securityId", m.getString(SecurityID.FIELD))
                .put("securityIdSource", m.getString(SecurityIDSource.FIELD));
    }

    // --- helpers -------------------------------------------------------------------

    private static void putDecimal(ObjectNode o, String name, FieldMap m, int tag) throws FieldNotFound {
        if (m.isSetField(tag)) o.put(name, m.getDecimal(tag).toPlainString());
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node == null ? null : node.get(field);
        if (v == null || v.isNull()) throw new IllegalArgumentException("Missing field " + field);
        return v.asText();
    }

    private static BigDecimal decimal(JsonNode node, String field) {
        return new BigDecimal(text(node, field));
    }

    public static LocalDateTime utc(String iso) {
        return LocalDateTime.ofInstant(Instant.parse(iso), ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
    }

    public static String iso(LocalDateTime utc) {
        return utc.toInstant(ZoneOffset.UTC).toString();
    }
}
