-- Annual catalogue prices for future purchases and renewals (365-day terms).
-- Seeds are create-only, so existing default catalogue rows need this update.
-- Match the original defaults to preserve individually edited/negotiated plans.
-- Existing subscriptions, payment records and paid amounts remain untouched.
UPDATE "plans" AS plan
SET "price" = prices.new_price,
    "renewal_price" = prices.new_renewal_price,
    "updated_at" = CURRENT_TIMESTAMP
FROM (VALUES
    ('Starter', 50, 3000, 1000, 4000, 2000),
    ('Basic', 100, 5000, 2000, 6000, 3000),
    ('Standard', 200, 8000, 3000, 9000, 4000)
) AS prices(name, student_limit, old_price, old_renewal_price, new_price, new_renewal_price)
WHERE plan."name" = prices.name
  AND plan."student_limit" = prices.student_limit
  AND plan."duration_days" = 365
  AND plan."deleted_at" IS NULL
  AND plan."price" = prices.old_price
  AND plan."renewal_price" = prices.old_renewal_price;
