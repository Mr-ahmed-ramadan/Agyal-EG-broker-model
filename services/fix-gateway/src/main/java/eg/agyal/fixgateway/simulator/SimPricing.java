package eg.agyal.fixgateway.simulator;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Simple fixed-income pricing used by the bank simulator to produce realistic
 * quotes. Mirrors the conventions in services/api/src/domain/fixed-income.ts
 * (T-bills Actual/365 discount; bonds compounded at coupon frequency).
 */
final class SimPricing {

    private SimPricing() {}

    static double tbillPrice(double yield, LocalDate settle, LocalDate maturity) {
        long days = ChronoUnit.DAYS.between(settle, maturity);
        return 100 / (1 + yield * days / 365.0);
    }

    record Period(LocalDate previous, LocalDate next, int remaining) {}

    static Period couponPeriod(int freq, LocalDate settle, LocalDate maturity) {
        int step = 12 / freq;
        int i = 0;
        while (maturity.minusMonths((long) step * (i + 1)).isAfter(settle)) i++;
        return new Period(maturity.minusMonths((long) step * (i + 1)), maturity.minusMonths((long) step * i), i + 1);
    }

    static double accrued(double coupon, int freq, LocalDate settle, LocalDate maturity) {
        Period p = couponPeriod(freq, settle, maturity);
        double c = 100 * coupon / freq;
        return c * ChronoUnit.DAYS.between(p.previous(), settle) / ChronoUnit.DAYS.between(p.previous(), p.next());
    }

    static double bondCleanPrice(double coupon, int freq, double yield, LocalDate settle, LocalDate maturity) {
        Period p = couponPeriod(freq, settle, maturity);
        double c = 100 * coupon / freq;
        double w = (double) ChronoUnit.DAYS.between(settle, p.next()) / ChronoUnit.DAYS.between(p.previous(), p.next());
        double base = 1 + yield / freq;
        double pv = 0;
        for (int k = 0; k < p.remaining(); k++) pv += c / Math.pow(base, k + w);
        pv += 100 / Math.pow(base, p.remaining() - 1 + w);
        return pv - accrued(coupon, freq, settle, maturity);
    }
}
