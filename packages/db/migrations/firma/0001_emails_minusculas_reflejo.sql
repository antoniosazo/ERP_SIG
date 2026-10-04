-- Reflejo de usuarios: emails en minúsculas y sin espacios, como en la plataforma.
UPDATE "usuarios" SET "email" = lower(btrim("email"));
