-- Track which user uploaded each photo image
ALTER TABLE photo_images
ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(36) REFERENCES "user"(id);

CREATE INDEX IF NOT EXISTS idx_photo_images_uploaded_by ON photo_images(uploaded_by);
