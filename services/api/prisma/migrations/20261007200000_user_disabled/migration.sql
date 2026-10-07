-- A staff member can lose access without losing their history: the row stays so
-- the compliance decisions and withdrawal approvals they made still point at a
-- named person.
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);
