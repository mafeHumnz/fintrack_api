CREATE UNIQUE INDEX "Account_userId_name_lower_key"
ON "Account" ("userId", LOWER(name));