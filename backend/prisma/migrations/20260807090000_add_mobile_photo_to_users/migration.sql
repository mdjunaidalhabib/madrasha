-- Self-service profile fields: users can set their own mobile number and
-- avatar (Cloudinary URL, same pattern as branding/student/teacher photos).
-- Both nullable - every existing row keeps working with neither set.
ALTER TABLE "users"
ADD COLUMN "mobile" VARCHAR(20),
ADD COLUMN "photo_url" VARCHAR(500);
