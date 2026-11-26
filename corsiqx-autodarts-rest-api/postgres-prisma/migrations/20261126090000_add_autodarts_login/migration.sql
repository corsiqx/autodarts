-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_encrypted" TEXT;

-- CreateTable
CREATE TABLE "autodarts_sessions" (
    "user_id" UUID NOT NULL,
    "autodarts_user_id" TEXT NOT NULL,
    "autodarts_username" TEXT,
    "access_token_encrypted" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token_encrypted" TEXT,
    "last_login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autodarts_sessions_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "autodarts_sessions" ADD CONSTRAINT "autodarts_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

