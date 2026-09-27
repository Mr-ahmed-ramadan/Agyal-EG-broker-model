-- Sell side (client sells before maturity through the bank RFQ).

-- Quotes: a sell RFQ is answered with a bid.
ALTER TABLE "Quote" ALTER COLUMN "offerPx" DROP NOT NULL;
ALTER TABLE "Quote" ADD COLUMN "bidPx" DECIMAL(18,8);
ALTER TABLE "Quote" ADD COLUMN "bidYield" DECIMAL(9,6);

-- Orders: sells reserve nominal instead of cash.
ALTER TABLE "Order" ALTER COLUMN "reservedAmount" SET DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "reservedQty" DECIMAL(20,2) NOT NULL DEFAULT 0;

-- Price snapshots: record the side; "totalCost" becomes the side-neutral "netAmount".
ALTER TABLE "PriceSnapshot" ADD COLUMN "side" TEXT NOT NULL DEFAULT 'BUY';
ALTER TABLE "PriceSnapshot" ALTER COLUMN "side" DROP DEFAULT;
ALTER TABLE "PriceSnapshot" RENAME COLUMN "totalCost" TO "netAmount";
