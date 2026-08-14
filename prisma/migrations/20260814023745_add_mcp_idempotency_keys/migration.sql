-- CreateTable
CREATE TABLE "McpIdempotencyKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpIdempotencyKey_userId_idx" ON "McpIdempotencyKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "McpIdempotencyKey_userId_toolName_idempotencyKey_key" ON "McpIdempotencyKey"("userId", "toolName", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "McpIdempotencyKey" ADD CONSTRAINT "McpIdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
