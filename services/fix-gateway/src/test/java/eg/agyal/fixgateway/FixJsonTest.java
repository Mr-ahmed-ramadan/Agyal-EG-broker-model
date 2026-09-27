package eg.agyal.fixgateway;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import quickfix.DataDictionary;
import quickfix.DefaultMessageFactory;
import quickfix.Message;
import quickfix.MessageUtils;
import quickfix.field.AccruedInterestAmt;
import quickfix.field.ClOrdID;
import quickfix.field.CumQty;
import quickfix.field.ExecID;
import quickfix.field.ExecType;
import quickfix.field.LastPx;
import quickfix.field.LastQty;
import quickfix.field.LeavesQty;
import quickfix.field.MsgType;
import quickfix.field.OrdStatus;
import quickfix.field.OrderID;
import quickfix.field.SecurityID;
import quickfix.field.SecurityIDSource;
import quickfix.field.Side;
import quickfix.field.Symbol;
import quickfix.fix44.ExecutionReport;

class FixJsonTest {

    private static final DataDictionary DICT = dictionary();

    private static DataDictionary dictionary() {
        try {
            return new DataDictionary("FIX44.xml");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Serialises with a header, re-parses with the dictionary and validates, as a bank would. */
    private static Message roundTrip(Message msg) throws Exception {
        msg.getHeader().setString(49, "AGYAL");
        msg.getHeader().setString(56, "SIMBANK");
        msg.getHeader().setInt(34, 1);
        msg.getHeader().setUtcTimeStamp(52, java.time.LocalDateTime.now());
        Message parsed = MessageUtils.parse(new DefaultMessageFactory(), DICT, msg.toString());
        DICT.validate(parsed, true);
        return parsed;
    }

    @Test
    void quoteRequestIsValidFix44WithPartiesInsideTheInstrumentGroup() throws Exception {
        JsonNode json = FixJson.JSON.readTree("""
                {"msgType":"R","quoteReqId":"QR1","side":"1","orderQty":"100000.00","settlDate":"20260928",
                 "instrument":{"securityId":"EGT91DEMO012","securityIdSource":"4"},
                 "parties":[{"partyId":"DEMO-SIMBANK","partyIdSource":"D","partyRole":1},
                            {"partyId":"12345678","partyIdSource":"D","partyRole":3}]}""");
        Message parsed = roundTrip(FixJson.toFix(MsgType.QUOTE_REQUEST, json));
        String raw = parsed.toString().replace('\u0001', '|');
        assertEquals(true, raw.contains("|131=QR1|146=1|"));
        assertEquals(true, raw.contains("|453=2|448=DEMO-SIMBANK|447=D|452=1|448=12345678|447=D|452=3|"));
        assertEquals(true, raw.contains("|38=100000.00|"));
    }

    @Test
    void newOrderSingleIsValidFix44() throws Exception {
        JsonNode json = FixJson.JSON.readTree("""
                {"msgType":"D","clOrdId":"O1","quoteId":"Q-1","side":"1","orderQty":"5000.00","ordType":"D",
                 "priceType":"1","price":"98.123456","settlDate":"20260928","transactTime":"2026-09-27T10:00:00.000Z",
                 "instrument":{"securityId":"EGTB3YDEMO12","securityIdSource":"4"},
                 "parties":[{"partyId":"DEMO-SIMBANK","partyIdSource":"D","partyRole":1}]}""");
        String raw = roundTrip(FixJson.toFix(MsgType.ORDER_SINGLE, json)).toString().replace('\u0001', '|');
        assertEquals(true, raw.contains("|44=98.123456|"));
        assertEquals(true, raw.contains("|117=Q-1|"));
        assertEquals(true, raw.contains("|40=D|"));
    }

    @Test
    void executionReportMapsToJsonWithExactDecimals() throws Exception {
        ExecutionReport er = new ExecutionReport();
        er.set(new OrderID("BO-1"));
        er.set(new ExecID("E-1"));
        er.set(new ExecType(ExecType.TRADE));
        er.set(new OrdStatus(OrdStatus.FILLED));
        er.set(new Side(Side.BUY));
        er.set(new ClOrdID("O1"));
        er.set(new Symbol("[N/A]"));
        er.set(new SecurityID("EGT91DEMO012"));
        er.set(new SecurityIDSource("4"));
        er.setDecimal(LeavesQty.FIELD, BigDecimal.ZERO);
        er.setDecimal(CumQty.FIELD, new BigDecimal("100000"));
        er.setDecimal(LastQty.FIELD, new BigDecimal("100000"));
        er.setDecimal(LastPx.FIELD, new BigDecimal("94.132818"));
        er.setDecimal(AccruedInterestAmt.FIELD, new BigDecimal("0.00"));

        JsonNode json = FixJson.fromFix(er);
        assertEquals("8", json.get("msgType").asText());
        assertEquals("F", json.get("execType").asText());
        assertEquals("2", json.get("ordStatus").asText());
        assertEquals("94.132818", json.get("lastPx").asText());
        assertEquals("O1", json.get("clOrdId").asText());
    }
}
