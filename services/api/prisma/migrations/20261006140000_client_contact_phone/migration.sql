-- A contact number for the client, taken at demo signup. Unverified, and kept
-- apart from User.mobile, which is the authentication factor.
ALTER TABLE "Client" ADD COLUMN "phone" TEXT;
