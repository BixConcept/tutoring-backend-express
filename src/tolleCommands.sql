-- MADE BY nicht niels
--Ich möchte Nachhilfe:
SELECT
    *
FROM
    nachhilfe.user
WHERE
    user.id = offer.user_id
    AND offer.subject_id = [request.subject:_id]
    AND offer.grade >= [request.grade]
    AND user.auth = 1;

--Ich möchte Nachhilfe geben:
INSERT INTO
    ‘ nachhilfe.offer ‘ (id, user_id, subject_id, grade)
VALUES
    (NULL, [user.id], [subject_id], [grade]);

-- Vergleiche mit request*in:
SELECT
    user.email
FROM
    nachhilfe.user
WHERE
    offer.subject_id = request.subject_id
    AND request.grade <= offer.grade;

-- verifizieren:
UPDATE
    nachhilfe.user
SET
    auth = 1
WHERE
    [user_id];

--Ich möchte keine Nachhilfe mehr geben:
DELETE FROM
    nachhilfe.offer
WHERE
    offer.user_id = [user_id];

--Trag mich IN die Warteliste ein:
INSERT INTO
    nachhilfe.request (id, user_id, subject_id)
VALUES
    (NULL, [user_id], [subject_id]);

--Trag mich aus der Warteliste aus:
DELETE FROM
    nachhilfe.request
WHERE
    request.user_id = [user_id];

-- User Tabelle erzeugen
CREATE TABLE `tutoring`.`user` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(20) NULL,
    `misc` TEXT NULL,
    `password_hash` VARCHAR(128) NULL,
    `auth` INT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    `last_activity` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

-- subjects table
CREATE TABLE `tutoring`.`subject` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`id`)
);

-- offer table
CREATE TABLE `tutoring`.`offer` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `subject_id` INT NOT NULL,
    `max_grade` INT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

-- request table
CREATE TABLE `tutoring`.`request` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `subject_id` INT NOT NULL,
    `grade` INT NOT NULL,
    PRIMARY KEY (`id`)
);