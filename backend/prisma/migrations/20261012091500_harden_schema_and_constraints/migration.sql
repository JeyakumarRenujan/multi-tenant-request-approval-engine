-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activity_logs_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activity_logs_requestId_fkey";

-- DropForeignKey
ALTER TABLE "clients" DROP CONSTRAINT "clients_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "requests" DROP CONSTRAINT "requests_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "requests" DROP CONSTRAINT "requests_clientId_fkey";

-- DropForeignKey
ALTER TABLE "requests" DROP CONSTRAINT "requests_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_clientId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_organizationId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "clients_id_organizationId_key" ON "clients"("id", "organizationId");

-- AddForeignKey (Restrict prevents deleting organizations while clients exist)
ALTER TABLE "clients" ADD CONSTRAINT "clients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Restrict prevents deleting organizations while users exist)
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Restrict prevents deleting clients while client users exist)
ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Restrict prevents deleting organizations while requests exist)
ALTER TABLE "requests" ADD CONSTRAINT "requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite foreign key guarantees client belongs to the exact same organization at the DB level)
ALTER TABLE "requests" ADD CONSTRAINT "requests_clientId_organizationId_fkey" FOREIGN KEY ("clientId", "organizationId") REFERENCES "clients"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Restrict prevents deleting assigned users while requests exist)
ALTER TABLE "requests" ADD CONSTRAINT "requests_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Restrict guarantees activity logs cannot be deleted by organization delete)
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Restrict guarantees activity logs cannot be deleted by request delete)
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database Constraint: Ensure non-PLATFORM_ADMIN users always have an organizationId
ALTER TABLE "users" ADD CONSTRAINT "chk_user_organization"
CHECK ("role" = 'PLATFORM_ADMIN' OR "organizationId" IS NOT NULL);

-- Database Constraint: Ensure CLIENT_USER always has a clientId
ALTER TABLE "users" ADD CONSTRAINT "chk_client_user_client"
CHECK ("role" != 'CLIENT_USER' OR "clientId" IS NOT NULL);
