-- DropIndex
DROP INDEX "users_email_tenant_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "users_email_tenant_id_role_key" ON "users"("email", "tenant_id", "role");
