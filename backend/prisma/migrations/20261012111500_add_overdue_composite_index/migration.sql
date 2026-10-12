-- CreateIndex
CREATE INDEX "requests_organizationId_dueDate_status_idx" ON "requests"("organizationId", "dueDate", "status");
